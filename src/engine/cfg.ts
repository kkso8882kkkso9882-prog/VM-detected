import {
  ProgramNode,
  StatementNode,
  IfStatementNode,
  WhileStatementNode,
  RepeatStatementNode,
  ForNumericNode,
  ForGenericNode,
  ExpressionNode
} from '../types/ast';
import { BasicBlock, CFGEdge, ControlFlowGraph } from '../types/analysis';

export class CFGBuilder {
  private blockIdCounter = 0;
  private blocks: BasicBlock[] = [];
  private edges: CFGEdge[] = [];
  private currentBlock: BasicBlock | null = null;

  public build(ast: ProgramNode): ControlFlowGraph {
    this.blockIdCounter = 0;
    this.blocks = [];
    this.edges = [];

    // Create Entry Block
    const entryBlock = this.createBlock('Entry', true, false);
    this.currentBlock = entryBlock;

    this.processStatements(ast.body);

    // Create Exit Block
    const exitBlock = this.createBlock('Exit', false, true);
    if (this.currentBlock && !this.currentBlock.isExit) {
      this.addEdge(this.currentBlock.id, exitBlock.id, 'fallthrough');
    }

    // Reachability & Dead block analysis
    const reachable = this.computeReachability(entryBlock.id);
    let deadBlockCount = 0;
    for (const b of this.blocks) {
      if (!reachable.has(b.id) && !b.isEntry) {
        deadBlockCount++;
      }
    }

    // Cyclomatic Complexity: E - N + 2
    const N = this.blocks.length;
    const E = this.edges.length;
    const cyclomaticComplexity = Math.max(1, E - N + 2);

    // Loop detection (back-edges)
    const loopCount = this.edges.filter(e => e.type === 'back-edge').length;

    return {
      blocks: this.blocks,
      edges: this.edges,
      entryBlockId: entryBlock.id,
      exitBlockIds: [exitBlock.id],
      cyclomaticComplexity,
      loopCount,
      deadBlockCount
    };
  }

  private createBlock(label: string, isEntry = false, isExit = false): BasicBlock {
    const block: BasicBlock = {
      id: this.blockIdCounter++,
      label,
      statements: [],
      predecessors: [],
      successors: [],
      isEntry,
      isExit
    };
    this.blocks.push(block);
    return block;
  }

  private addEdge(fromId: number, toId: number, type: CFGEdge['type'], condition?: string) {
    // Avoid duplicate edges
    if (!this.edges.some(e => e.from === fromId && e.to === toId && e.type === type)) {
      this.edges.push({ from: fromId, to: toId, type, condition });
    }

    const fromBlock = this.blocks.find(b => b.id === fromId);
    const toBlock = this.blocks.find(b => b.id === toId);

    if (fromBlock && !fromBlock.successors.includes(toId)) {
      fromBlock.successors.push(toId);
    }
    if (toBlock && !toBlock.predecessors.includes(fromId)) {
      toBlock.predecessors.push(fromId);
    }
  }

  private processStatements(stmts: StatementNode[]) {
    for (const stmt of stmts) {
      this.processStatement(stmt);
    }
  }

  private processStatement(stmt: StatementNode) {
    if (!this.currentBlock) {
      this.currentBlock = this.createBlock(`Block_${this.blockIdCounter}`);
    }

    switch (stmt.type) {
      case 'IfStatement':
        this.processIfStatement(stmt);
        break;
      case 'WhileStatement':
        this.processWhileStatement(stmt);
        break;
      case 'RepeatStatement':
        this.processRepeatStatement(stmt);
        break;
      case 'ForNumeric':
      case 'ForGeneric':
        this.processForStatement(stmt);
        break;
      case 'ReturnStatement':
        this.currentBlock.statements.push(stmt);
        this.currentBlock = null; // Unreachable until new block
        break;
      case 'BreakStatement':
        this.currentBlock.statements.push(stmt);
        this.currentBlock = null;
        break;
      case 'ContinueStatement':
        this.currentBlock.statements.push(stmt);
        this.currentBlock = null;
        break;
      case 'DoBlock':
        this.processStatements(stmt.body);
        break;
      default:
        this.currentBlock.statements.push(stmt);
        break;
    }
  }

  private processIfStatement(stmt: IfStatementNode) {
    const headBlock = this.currentBlock!;
    const condStr = this.exprToString(stmt.condition);

    // Consequent block
    const thenBlock = this.createBlock(`Then_L${stmt.loc.start.line}`);
    this.addEdge(headBlock.id, thenBlock.id, 'true-branch', condStr);

    this.currentBlock = thenBlock;
    this.processStatements(stmt.consequent);
    const thenEndBlock = this.currentBlock;

    // Follow-up merge block
    const mergeBlock = this.createBlock(`IfMerge_L${stmt.loc.end.line}`);

    if (thenEndBlock) {
      this.addEdge(thenEndBlock.id, mergeBlock.id, 'unconditional');
    }

    let prevCondBlock = headBlock;

    // Elseifs
    for (const elseif of stmt.elseifs) {
      const elseifCondBlock = this.createBlock(`ElseifCond_L${elseif.loc.start.line}`);
      this.addEdge(prevCondBlock.id, elseifCondBlock.id, 'false-branch');

      const elseifThenBlock = this.createBlock(`ElseifThen_L${elseif.loc.start.line}`);
      const elseifCondStr = this.exprToString(elseif.condition);
      this.addEdge(elseifCondBlock.id, elseifThenBlock.id, 'true-branch', elseifCondStr);

      this.currentBlock = elseifThenBlock;
      this.processStatements(elseif.body);
      if (this.currentBlock) {
        this.addEdge(this.currentBlock.id, mergeBlock.id, 'unconditional');
      }

      prevCondBlock = elseifCondBlock;
    }

    // Else
    if (stmt.alternate && stmt.alternate.length > 0) {
      const elseBlock = this.createBlock(`Else_L${stmt.loc.start.line}`);
      this.addEdge(prevCondBlock.id, elseBlock.id, 'false-branch');

      this.currentBlock = elseBlock;
      this.processStatements(stmt.alternate);
      if (this.currentBlock) {
        this.addEdge(this.currentBlock.id, mergeBlock.id, 'unconditional');
      }
    } else {
      // Direct false-branch to merge if no else
      this.addEdge(prevCondBlock.id, mergeBlock.id, 'false-branch');
    }

    this.currentBlock = mergeBlock;
  }

  private processWhileStatement(stmt: WhileStatementNode) {
    const prevBlock = this.currentBlock!;
    const headerBlock = this.createBlock(`WhileHead_L${stmt.loc.start.line}`);
    headerBlock.isDispatchHead = true;
    this.addEdge(prevBlock.id, headerBlock.id, 'unconditional');

    const condStr = this.exprToString(stmt.condition);
    const bodyBlock = this.createBlock(`WhileBody_L${stmt.loc.start.line}`);
    this.addEdge(headerBlock.id, bodyBlock.id, 'true-branch', condStr);

    this.currentBlock = bodyBlock;
    this.processStatements(stmt.body);

    if (this.currentBlock) {
      this.addEdge(this.currentBlock.id, headerBlock.id, 'back-edge');
    }

    const exitBlock = this.createBlock(`WhileExit_L${stmt.loc.end.line}`);
    this.addEdge(headerBlock.id, exitBlock.id, 'false-branch');

    this.currentBlock = exitBlock;
  }

  private processRepeatStatement(stmt: RepeatStatementNode) {
    const prevBlock = this.currentBlock!;
    const bodyBlock = this.createBlock(`RepeatBody_L${stmt.loc.start.line}`);
    this.addEdge(prevBlock.id, bodyBlock.id, 'unconditional');

    this.currentBlock = bodyBlock;
    this.processStatements(stmt.body);

    const condStr = this.exprToString(stmt.condition);
    if (this.currentBlock) {
      this.addEdge(this.currentBlock.id, bodyBlock.id, 'back-edge', `not (${condStr})`);
    }

    const exitBlock = this.createBlock(`RepeatExit_L${stmt.loc.end.line}`);
    if (this.currentBlock) {
      this.addEdge(this.currentBlock.id, exitBlock.id, 'true-branch', condStr);
    }

    this.currentBlock = exitBlock;
  }

  private processForStatement(stmt: ForNumericNode | ForGenericNode) {
    const prevBlock = this.currentBlock!;
    const headBlock = this.createBlock(`ForHead_L${stmt.loc.start.line}`);
    this.addEdge(prevBlock.id, headBlock.id, 'unconditional');

    const bodyBlock = this.createBlock(`ForBody_L${stmt.loc.start.line}`);
    this.addEdge(headBlock.id, bodyBlock.id, 'true-branch');

    this.currentBlock = bodyBlock;
    this.processStatements(stmt.body);

    if (this.currentBlock) {
      this.addEdge(this.currentBlock.id, headBlock.id, 'back-edge');
    }

    const exitBlock = this.createBlock(`ForExit_L${stmt.loc.end.line}`);
    this.addEdge(headBlock.id, exitBlock.id, 'false-branch');

    this.currentBlock = exitBlock;
  }

  private computeReachability(startId: number): Set<number> {
    const visited = new Set<number>();
    const queue = [startId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const blk = this.blocks.find(b => b.id === curr);
      if (blk) {
        for (const succ of blk.successors) {
          if (!visited.has(succ)) queue.push(succ);
        }
      }
    }

    return visited;
  }

  private exprToString(expr: ExpressionNode): string {
    if (!expr) return '';
    switch (expr.type) {
      case 'Identifier': return expr.name;
      case 'LiteralNumber': return expr.raw || expr.value.toString();
      case 'LiteralString': return `"${expr.value}"`;
      case 'LiteralBoolean': return expr.value ? 'true' : 'false';
      case 'LiteralNil': return 'nil';
      case 'BinaryExpression': return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
      case 'UnaryExpression': return `${expr.operator} ${this.exprToString(expr.argument)}`;
      case 'MemberExpression': return `${this.exprToString(expr.base)}.${expr.identifier.name}`;
      case 'IndexExpression': return `${this.exprToString(expr.base)}[${this.exprToString(expr.index)}]`;
      case 'CallExpression': return `${this.exprToString(expr.base)}(...)`;
      case 'MethodCallExpression': return `${this.exprToString(expr.base)}:${expr.method.name}(...)`;
      default: return '...';
    }
  }
}
