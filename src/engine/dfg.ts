import { ProgramNode, StatementNode, ExpressionNode, IdentifierNode, ASTNode } from '../types/ast';
import { ControlFlowGraph, DataFlowGraph, DefUseChain } from '../types/analysis';

export class DFGBuilder {
  public build(ast: ProgramNode, cfg: ControlFlowGraph): DataFlowGraph {
    const varStats: Map<string, {
      assignments: { blockId: number; statementIndex: number; line: number }[];
      reads: { blockId: number; statementIndex: number; line: number }[];
      inConditionCount: number;
    }> = new Map();

    const constantValues: Record<string, number | string | boolean> = {};

    // Walk all CFG blocks and their statements
    for (const block of cfg.blocks) {
      for (let sIdx = 0; sIdx < block.statements.length; sIdx++) {
        const stmt = block.statements[sIdx];
        this.analyzeStatement(stmt, block.id, sIdx, varStats, constantValues);
      }
    }

    // Convert into DefUseChains
    const chains: DefUseChain[] = [];
    const stateCandidates: string[] = [];

    varStats.forEach((stat, varName) => {
      // Heuristic for state variable candidate:
      // 1. Has multiple assignments (> 1) OR reassigned across branches
      // 2. Used in conditions multiple times
      // 3. Name is short or typical (state, B, op, pc, v, _state, IP, nextState)
      const isCandidate = (stat.assignments.length >= 2 && stat.inConditionCount >= 1) ||
        (stat.inConditionCount >= 2 && stat.assignments.length >= 1) ||
        (/^(state|status|pc|ip|opcode|op|b|v|nxt|curr|idx|step|_)/i.test(varName) && stat.assignments.length >= 1);

      if (isCandidate) {
        stateCandidates.push(varName);
      }

      for (const def of stat.assignments) {
        chains.push({
          variable: varName,
          definedAt: def,
          usedAt: stat.reads,
          isStateVariableCandidate: isCandidate,
          assignmentCount: stat.assignments.length,
          readCount: stat.reads.length
        });
      }
    });

    return {
      chains,
      stateVariableCandidates: stateCandidates,
      constantValues
    };
  }

  private analyzeStatement(
    stmt: StatementNode,
    blockId: number,
    statementIndex: number,
    varStats: Map<string, { assignments: any[]; reads: any[]; inConditionCount: number }>,
    constantValues: Record<string, number | string | boolean>
  ) {
    const line = stmt.loc?.start.line || 1;

    switch (stmt.type) {
      case 'LocalAssignment': {
        for (let i = 0; i < stmt.names.length; i++) {
          const name = stmt.names[i].name;
          const valExpr = stmt.values[i];
          this.recordAssignment(name, blockId, statementIndex, line, varStats);

          if (valExpr) {
            this.recordReadsInExpr(valExpr, blockId, statementIndex, line, varStats, false);
            // Constant evaluation
            const constVal = this.tryEvalConstant(valExpr);
            if (constVal !== null) {
              constantValues[name] = constVal;
            }
          }
        }
        break;
      }
      case 'Assignment': {
        for (let i = 0; i < stmt.targets.length; i++) {
          const target = stmt.targets[i];
          const valExpr = stmt.values[i];

          if (target.type === 'Identifier') {
            this.recordAssignment(target.name, blockId, statementIndex, line, varStats);
            if (valExpr) {
              const constVal = this.tryEvalConstant(valExpr);
              if (constVal !== null) {
                constantValues[target.name] = constVal;
              }
            }
          } else {
            this.recordReadsInExpr(target, blockId, statementIndex, line, varStats, false);
          }

          if (valExpr) {
            this.recordReadsInExpr(valExpr, blockId, statementIndex, line, varStats, false);
          }
        }
        break;
      }
      case 'CompoundAssignment': {
        if (stmt.target.type === 'Identifier') {
          this.recordAssignment(stmt.target.name, blockId, statementIndex, line, varStats);
          this.recordReadsInExpr(stmt.target, blockId, statementIndex, line, varStats, false);
        }
        this.recordReadsInExpr(stmt.value, blockId, statementIndex, line, varStats, false);
        break;
      }
      case 'IfStatement': {
        this.recordReadsInExpr(stmt.condition, blockId, statementIndex, line, varStats, true);
        for (const elseif of stmt.elseifs) {
          this.recordReadsInExpr(elseif.condition, blockId, statementIndex, line, varStats, true);
        }
        break;
      }
      case 'WhileStatement':
      case 'RepeatStatement': {
        this.recordReadsInExpr(stmt.condition, blockId, statementIndex, line, varStats, true);
        break;
      }
      case 'CallStatement': {
        this.recordReadsInExpr(stmt.expression, blockId, statementIndex, line, varStats, false);
        break;
      }
      case 'ReturnStatement': {
        for (const val of stmt.values) {
          this.recordReadsInExpr(val, blockId, statementIndex, line, varStats, false);
        }
        break;
      }
    }
  }

  private recordAssignment(
    name: string,
    blockId: number,
    statementIndex: number,
    line: number,
    varStats: Map<string, { assignments: any[]; reads: any[]; inConditionCount: number }>
  ) {
    if (!varStats.has(name)) {
      varStats.set(name, { assignments: [], reads: [], inConditionCount: 0 });
    }
    varStats.get(name)!.assignments.push({ blockId, statementIndex, line });
  }

  private recordReadsInExpr(
    expr: ExpressionNode | ASTNode,
    blockId: number,
    statementIndex: number,
    line: number,
    varStats: Map<string, { assignments: any[]; reads: any[]; inConditionCount: number }>,
    isCondition: boolean
  ) {
    if (!expr) return;

    if (expr.type === 'Identifier') {
      const name = (expr as IdentifierNode).name;
      if (!varStats.has(name)) {
        varStats.set(name, { assignments: [], reads: [], inConditionCount: 0 });
      }
      const stat = varStats.get(name)!;
      stat.reads.push({ blockId, statementIndex, line });
      if (isCondition) {
        stat.inConditionCount++;
      }
      return;
    }

    // Traverse child nodes
    switch (expr.type) {
      case 'BinaryExpression':
        this.recordReadsInExpr(expr.left, blockId, statementIndex, line, varStats, isCondition);
        this.recordReadsInExpr(expr.right, blockId, statementIndex, line, varStats, isCondition);
        break;
      case 'UnaryExpression':
        this.recordReadsInExpr(expr.argument, blockId, statementIndex, line, varStats, isCondition);
        break;
      case 'MemberExpression':
        this.recordReadsInExpr(expr.base, blockId, statementIndex, line, varStats, isCondition);
        break;
      case 'IndexExpression':
        this.recordReadsInExpr(expr.base, blockId, statementIndex, line, varStats, isCondition);
        this.recordReadsInExpr(expr.index, blockId, statementIndex, line, varStats, isCondition);
        break;
      case 'CallExpression':
        this.recordReadsInExpr(expr.base, blockId, statementIndex, line, varStats, isCondition);
        for (const arg of expr.args) {
          this.recordReadsInExpr(arg, blockId, statementIndex, line, varStats, isCondition);
        }
        break;
      case 'MethodCallExpression':
        this.recordReadsInExpr(expr.base, blockId, statementIndex, line, varStats, isCondition);
        for (const arg of expr.args) {
          this.recordReadsInExpr(arg, blockId, statementIndex, line, varStats, isCondition);
        }
        break;
      case 'TableConstructor':
        for (const field of expr.fields) {
          if (field.key) this.recordReadsInExpr(field.key, blockId, statementIndex, line, varStats, isCondition);
          this.recordReadsInExpr(field.value, blockId, statementIndex, line, varStats, isCondition);
        }
        break;
    }
  }

  private tryEvalConstant(expr: ExpressionNode): number | string | boolean | null {
    if (expr.type === 'LiteralNumber') return expr.value;
    if (expr.type === 'LiteralString') return expr.value;
    if (expr.type === 'LiteralBoolean') return expr.value;
    return null;
  }
}
