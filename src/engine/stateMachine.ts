import {
  ProgramNode,
  StatementNode,
  IfStatementNode,
  WhileStatementNode,
  ExpressionNode,
  AssignmentNode,
  LocalAssignmentNode
} from '../types/ast';
import { StateMachineInfo, StateTransition } from '../types/analysis';
import { DataFlowGraph } from '../types/analysis';

export class StateMachineAnalyzer {
  public analyze(ast: ProgramNode, dfg: DataFlowGraph): StateMachineInfo {
    // 1. Identify primary state variable
    const stateVar = this.detectPrimaryStateVar(ast, dfg);
    if (!stateVar) {
      return {
        stateVariableName: null,
        initialState: null,
        states: [],
        transitions: [],
        unreachableStates: [],
        equivalentStates: [],
        stateCycles: [],
        dispatcherType: 'UNKNOWN'
      };
    }

    // 2. Find initial state assignment
    const initialState = this.findInitialState(ast, stateVar);

    // 3. Scan for state branches, transitions, and dispatcher loop
    const transitions: StateTransition[] = [];
    const discoveredStates = new Set<number | string>();
    if (initialState !== null) {
      discoveredStates.add(initialState);
    }

    let dispatcherType: StateMachineInfo['dispatcherType'] = 'UNKNOWN';
    let dispatcherLine: number | undefined;

    this.scanDispatcher(ast.body, stateVar, transitions, discoveredStates, (type, line) => {
      dispatcherType = type;
      dispatcherLine = line;
    });

    const statesList = Array.from(discoveredStates);

    // 4. Graph analysis: Unreachable states, Equivalent states, Cycles
    const unreachableStates = this.findUnreachableStates(statesList, initialState, transitions);
    const equivalentStates = this.findEquivalentStates(statesList, transitions);
    const stateCycles = this.findStateCycles(statesList, transitions);

    return {
      stateVariableName: stateVar,
      initialState,
      states: statesList,
      transitions,
      unreachableStates,
      equivalentStates,
      stateCycles,
      dispatcherType,
      dispatcherLocation: dispatcherLine ? { line: dispatcherLine } : undefined
    };
  }

  private detectPrimaryStateVar(ast: ProgramNode, dfg: DataFlowGraph): string | null {
    // Score candidates from DFG
    if (dfg.stateVariableCandidates.length === 0) return null;

    let bestVar: string | null = null;
    let bestScore = -1;

    for (const varName of dfg.stateVariableCandidates) {
      const chain = dfg.chains.find(c => c.variable === varName);
      if (!chain) continue;

      let score = chain.assignmentCount * 2 + chain.readCount;
      if (/^(state|status|b|v|opcode|op|ip|pc|nxt)/i.test(varName)) {
        score += 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestVar = varName;
      }
    }

    return bestVar;
  }

  private findInitialState(ast: ProgramNode, stateVar: string): number | string | null {
    for (const stmt of ast.body) {
      if (stmt.type === 'LocalAssignment') {
        for (let i = 0; i < stmt.names.length; i++) {
          if (stmt.names[i].name === stateVar && stmt.values[i]) {
            const val = this.extractStateLiteral(stmt.values[i]);
            if (val !== null) return val;
          }
        }
      }
      if (stmt.type === 'Assignment') {
        for (let i = 0; i < stmt.targets.length; i++) {
          const t = stmt.targets[i];
          if (t.type === 'Identifier' && t.name === stateVar && stmt.values[i]) {
            const val = this.extractStateLiteral(stmt.values[i]);
            if (val !== null) return val;
          }
        }
      }
    }
    return null;
  }

  private scanDispatcher(
    stmts: StatementNode[],
    stateVar: string,
    transitions: StateTransition[],
    discoveredStates: Set<number | string>,
    onDispatcherFound: (type: StateMachineInfo['dispatcherType'], line: number) => void
  ) {
    for (const stmt of stmts) {
      if (stmt.type === 'WhileStatement') {
        onDispatcherFound('WHILE_IF_TREE', stmt.loc.start.line);
        this.extractTransitionsFromStatements(stmt.body, stateVar, null, transitions, discoveredStates);
      } else if (stmt.type === 'IfStatement') {
        this.extractTransitionsFromIf(stmt, stateVar, transitions, discoveredStates);
      } else if (stmt.type === 'DoBlock') {
        this.scanDispatcher(stmt.body, stateVar, transitions, discoveredStates, onDispatcherFound);
      }
    }
  }

  private extractTransitionsFromIf(
    stmt: IfStatementNode,
    stateVar: string,
    transitions: StateTransition[],
    discoveredStates: Set<number | string>
  ) {
    const mainState = this.extractStateFromCondition(stmt.condition, stateVar);
    if (mainState !== null) {
      discoveredStates.add(mainState);
      this.extractTransitionsFromStatements(stmt.consequent, stateVar, mainState, transitions, discoveredStates);
    } else {
      this.extractTransitionsFromStatements(stmt.consequent, stateVar, null, transitions, discoveredStates);
    }

    for (const elseif of stmt.elseifs) {
      const eState = this.extractStateFromCondition(elseif.condition, stateVar);
      if (eState !== null) {
        discoveredStates.add(eState);
        this.extractTransitionsFromStatements(elseif.body, stateVar, eState, transitions, discoveredStates);
      } else {
        this.extractTransitionsFromStatements(elseif.body, stateVar, null, transitions, discoveredStates);
      }
    }

    if (stmt.alternate) {
      this.extractTransitionsFromStatements(stmt.alternate, stateVar, null, transitions, discoveredStates);
    }
  }

  private extractTransitionsFromStatements(
    stmts: StatementNode[],
    stateVar: string,
    currentState: number | string | null,
    transitions: StateTransition[],
    discoveredStates: Set<number | string>
  ) {
    for (const stmt of stmts) {
      if (stmt.type === 'Assignment' || stmt.type === 'LocalAssignment') {
        const nextState = this.extractAssignedState(stmt, stateVar);
        if (nextState !== null) {
          discoveredStates.add(nextState);
          if (currentState !== null) {
            transitions.push({
              fromState: currentState,
              toState: nextState,
              isConditional: false,
              blockId: 0,
              line: stmt.loc.start.line
            });
          }
        }
      } else if (stmt.type === 'IfStatement') {
        // Nested conditional state transition
        const nestedCond = this.exprToString(stmt.condition);
        for (const subStmt of stmt.consequent) {
          const next = this.extractAssignedState(subStmt, stateVar);
          if (next !== null && currentState !== null) {
            discoveredStates.add(next);
            transitions.push({
              fromState: currentState,
              toState: next,
              condition: nestedCond,
              isConditional: true,
              blockId: 0,
              line: subStmt.loc.start.line
            });
          }
        }
        if (stmt.alternate) {
          for (const subStmt of stmt.alternate) {
            const next = this.extractAssignedState(subStmt, stateVar);
            if (next !== null && currentState !== null) {
              discoveredStates.add(next);
              transitions.push({
                fromState: currentState,
                toState: next,
                condition: `not (${nestedCond})`,
                isConditional: true,
                blockId: 0,
                line: subStmt.loc.start.line
              });
            }
          }
        }
      }
    }
  }

  private extractStateFromCondition(expr: ExpressionNode, stateVar: string): number | string | null {
    if (expr.type === 'BinaryExpression') {
      if (expr.operator === '==' || expr.operator === '<' || expr.operator === '>') {
        if (expr.left.type === 'Identifier' && expr.left.name === stateVar) {
          return this.extractStateLiteral(expr.right);
        }
        if (expr.right.type === 'Identifier' && expr.right.name === stateVar) {
          return this.extractStateLiteral(expr.left);
        }
      }
    }
    return null;
  }

  private extractAssignedState(stmt: StatementNode, stateVar: string): number | string | null {
    if (stmt.type === 'Assignment') {
      for (let i = 0; i < stmt.targets.length; i++) {
        const target = stmt.targets[i];
        if (target.type === 'Identifier' && target.name === stateVar && stmt.values[i]) {
          return this.extractStateLiteral(stmt.values[i]);
        }
      }
    }
    if (stmt.type === 'LocalAssignment') {
      for (let i = 0; i < stmt.names.length; i++) {
        if (stmt.names[i].name === stateVar && stmt.values[i]) {
          return this.extractStateLiteral(stmt.values[i]);
        }
      }
    }
    return null;
  }

  private extractStateLiteral(expr: ExpressionNode): number | string | null {
    if (!expr) return null;
    if (expr.type === 'LiteralNumber') {
      return expr.raw?.startsWith('0x') ? `0x${expr.value.toString(16).toUpperCase()}` : expr.value;
    }
    if (expr.type === 'LiteralString') return expr.value;
    return null;
  }

  private findUnreachableStates(
    states: (number | string)[],
    initialState: number | string | null,
    transitions: StateTransition[]
  ): (number | string)[] {
    if (initialState === null) return [];

    const reachable = new Set<number | string>([initialState]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const t of transitions) {
        if (reachable.has(t.fromState) && !reachable.has(t.toState)) {
          reachable.add(t.toState);
          changed = true;
        }
      }
    }

    return states.filter(s => !reachable.has(s));
  }

  private findEquivalentStates(
    states: (number | string)[],
    transitions: StateTransition[]
  ): { stateA: number | string; stateB: number | string; reason: string }[] {
    const equiv: { stateA: number | string; stateB: number | string; reason: string }[] = [];

    // Check states that have identical outgoing transition targets
    const outMap = new Map<number | string, (number | string)[]>();
    for (const s of states) {
      const targets = transitions.filter(t => t.fromState === s).map(t => t.toState).sort();
      outMap.set(s, targets);
    }

    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const sA = states[i];
        const sB = states[j];
        const targetsA = outMap.get(sA) || [];
        const targetsB = outMap.get(sB) || [];

        if (targetsA.length > 0 && targetsA.length === targetsB.length &&
            targetsA.every((v, idx) => v === targetsB[idx])) {
          equiv.push({
            stateA: sA,
            stateB: sB,
            reason: `Identical transition destination vector [${targetsA.join(', ')}]`
          });
        }
      }
    }

    return equiv;
  }

  private findStateCycles(states: (number | string)[], transitions: StateTransition[]): (number | string)[][] {
    const cycles: (number | string)[][] = [];
    const adj = new Map<number | string, (number | string)[]>();

    for (const s of states) adj.set(s, []);
    for (const t of transitions) {
      if (!adj.has(t.fromState)) adj.set(t.fromState, []);
      adj.get(t.fromState)!.push(t.toState);
    }

    const visited = new Set<number | string>();
    const recStack: (number | string)[] = [];

    const dfs = (curr: number | string) => {
      visited.add(curr);
      recStack.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const n of neighbors) {
        const idx = recStack.indexOf(n);
        if (idx !== -1) {
          // Cycle found
          const cycle = recStack.slice(idx);
          cycles.push(cycle);
        } else if (!visited.has(n)) {
          dfs(n);
        }
      }

      recStack.pop();
    };

    for (const s of states) {
      if (!visited.has(s)) {
        dfs(s);
      }
    }

    return cycles;
  }

  private exprToString(expr: ExpressionNode): string {
    if (!expr) return '';
    if (expr.type === 'Identifier') return expr.name;
    if (expr.type === 'LiteralNumber') return expr.raw || expr.value.toString();
    if (expr.type === 'LiteralString') return `"${expr.value}"`;
    if (expr.type === 'BinaryExpression') {
      return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
    }
    return '...';
  }
}
