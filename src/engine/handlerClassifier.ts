import { StatementNode, ExpressionNode, ProgramNode } from '../types/ast';
import { VMHandler, OpcodeSemantic, ConfidenceLevel } from '../types/analysis';

export class HandlerClassifier {
  public classify(ast: ProgramNode): VMHandler[] {
    const handlers: VMHandler[] = [];
    const discoveredOpCodes = new Set<number | string>();

    // 1. Scan for handlers inside while loop if-else branches
    this.scanASTForHandlers(ast.body, handlers, discoveredOpCodes);

    return handlers;
  }

  private scanASTForHandlers(
    stmts: StatementNode[],
    handlers: VMHandler[],
    seen: Set<number | string>
  ) {
    for (const stmt of stmts) {
      if (stmt.type === 'WhileStatement') {
        this.scanWhileDispatcher(stmt, handlers, seen);
      } else if (stmt.type === 'LocalAssignment' || stmt.type === 'Assignment') {
        // Check for table of handler functions: Handlers[1] = function(inst) ... end
        this.checkHandlerAssignments(stmt, handlers, seen);
      } else if (stmt.type === 'DoBlock') {
        this.scanASTForHandlers(stmt.body, handlers, seen);
      }
    }
  }

  private scanWhileDispatcher(
    whileStmt: any,
    handlers: VMHandler[],
    seen: Set<number | string>
  ) {
    for (const stmt of whileStmt.body) {
      if (stmt.type === 'IfStatement') {
        // If condition handler
        this.classifyIfBranch(stmt.condition, stmt.consequent, handlers, seen, stmt.loc.start.line);

        for (const elseif of stmt.elseifs) {
          this.classifyIfBranch(elseif.condition, elseif.body, handlers, seen, elseif.loc.start.line);
        }

        if (stmt.alternate && stmt.alternate.length > 0) {
          this.classifyIfBranch(null, stmt.alternate, handlers, seen, stmt.loc.end.line);
        }
      }
    }
  }

  private classifyIfBranch(
    condition: ExpressionNode | null,
    body: StatementNode[],
    handlers: VMHandler[],
    seen: Set<number | string>,
    line: number
  ) {
    const opcodeNumber = condition ? this.extractOpcodeFromCondition(condition) : undefined;
    const handlerId = opcodeNumber !== undefined ? `Opcode_${opcodeNumber}` : `Handler_L${line}`;

    if (seen.has(handlerId)) return;
    seen.add(handlerId);

    const { semantic, confidence, description, operands, registersRead, registersWritten, isControlFlow } =
      this.analyzeBlockSemantics(body);

    const associatedStatements = body.map(s => this.stmtToSummary(s)).filter(Boolean);

    handlers.push({
      handlerId,
      opcodeNumber: typeof opcodeNumber === 'number' ? opcodeNumber : undefined,
      opcodeHex: typeof opcodeNumber === 'number' ? `0x${opcodeNumber.toString(16).toUpperCase()}` : undefined,
      semantic,
      confidence,
      description,
      operands,
      associatedStatements,
      targetRegisters: Array.from(registersWritten),
      readRegisters: Array.from(registersRead),
      readConstants: [],
      isControlFlow
    });
  }

  private checkHandlerAssignments(
    stmt: StatementNode,
    handlers: VMHandler[],
    seen: Set<number | string>
  ) {
    // e.g. T.H[1] = function(...) ... end
    if (stmt.type === 'Assignment') {
      for (let i = 0; i < stmt.targets.length; i++) {
        const target = stmt.targets[i];
        const val = stmt.values[i];
        if (target.type === 'IndexExpression' && val && val.type === 'FunctionExpression') {
          const idxVal = target.index.type === 'LiteralNumber' ? target.index.value : `H_${handlers.length + 1}`;
          const handlerId = `Handler_${idxVal}`;
          if (!seen.has(handlerId)) {
            seen.add(handlerId);
            const { semantic, confidence, description, operands, registersRead, registersWritten, isControlFlow } =
              this.analyzeBlockSemantics(val.body);

            handlers.push({
              handlerId,
              opcodeNumber: typeof idxVal === 'number' ? idxVal : undefined,
              opcodeHex: typeof idxVal === 'number' ? `0x${idxVal.toString(16).toUpperCase()}` : undefined,
              semantic,
              confidence,
              description,
              operands,
              associatedStatements: val.body.map(s => this.stmtToSummary(s)),
              targetRegisters: Array.from(registersWritten),
              readRegisters: Array.from(registersRead),
              readConstants: [],
              isControlFlow
            });
          }
        }
      }
    }
  }

  public analyzeBlockSemantics(body: StatementNode[]): {
    semantic: OpcodeSemantic;
    confidence: ConfidenceLevel;
    description: string;
    operands: VMHandler['operands'];
    registersRead: Set<string>;
    registersWritten: Set<string>;
    isControlFlow: boolean;
  } {
    const jsonStr = JSON.stringify(body);
    const registersRead = new Set<string>();
    const registersWritten = new Set<string>();

    let hasCall = false;
    let hasTableGet = false;
    let hasTableSet = false;
    let hasGlobalGet = false;
    let hasGlobalSet = false;
    let hasAdd = false;
    let hasSub = false;
    let hasMul = false;
    let hasDiv = false;
    let hasMod = false;
    let hasConcat = false;
    let hasBitwise = false;
    let hasComparison = false;
    let hasJump = false;
    let hasReturn = false;
    let hasNewTable = false;
    let hasClosure = false;
    let hasLoadConst = false;

    // Scan statements
    for (const stmt of body) {
      if (stmt.type === 'ReturnStatement') {
        hasReturn = true;
      }
      if (stmt.type === 'CallStatement') {
        hasCall = true;
      }
      if (stmt.type === 'Assignment' || stmt.type === 'LocalAssignment') {
        const stmtStr = JSON.stringify(stmt);

        if (stmtStr.includes('bit32.band') || stmtStr.includes('bit32.bor') || stmtStr.includes('bit32.bxor')) {
          hasBitwise = true;
        }
        if (stmtStr.includes('"operator":"+"') || stmtStr.includes('"operator":"+="')) hasAdd = true;
        if (stmtStr.includes('"operator":"-"') || stmtStr.includes('"operator":"-="')) hasSub = true;
        if (stmtStr.includes('"operator":"*"') || stmtStr.includes('"operator":"*="')) hasMul = true;
        if (stmtStr.includes('"operator":"/"') || stmtStr.includes('"operator":"/="')) hasDiv = true;
        if (stmtStr.includes('"operator":"%"') || stmtStr.includes('"operator":"%="')) hasMod = true;
        if (stmtStr.includes('"operator":".."') || stmtStr.includes('"operator":"..="')) hasConcat = true;
        if (stmtStr.includes('"=="') || stmtStr.includes('"<"') || stmtStr.includes('">"')) hasComparison = true;

        if (stmtStr.includes('TableConstructor')) hasNewTable = true;
        if (stmtStr.includes('FunctionExpression')) hasClosure = true;

        // Register tracking: e.g. R[A] = R[B] + R[C] or Stack[A]
        const regMatches = stmtStr.match(/R\[\w+\]|Stack\[\w+\]|Registers\[\w+\]/g) || [];
        for (const rm of regMatches) {
          registersRead.add(rm);
        }
        if (stmt.type === 'Assignment' && stmt.targets[0]?.type === 'IndexExpression') {
          registersWritten.add(this.exprSummary(stmt.targets[0]));
        }

        // Check if Program counter is modified (Jump)
        if (stmtStr.includes('PC') || stmtStr.includes('ip') || stmtStr.includes('offset')) {
          hasJump = true;
        }

        // Global lookups: _G or getfenv or env[...]
        if (stmtStr.includes('getfenv') || stmtStr.includes('_G') || stmtStr.includes('Env[')) {
          hasGlobalGet = true;
        }

        // Table index operations
        if (stmtStr.includes('IndexExpression') || stmtStr.includes('MemberExpression')) {
          hasTableGet = true;
        }

        if (stmtStr.includes('Const[') || stmtStr.includes('Constants[')) {
          hasLoadConst = true;
        }
      }
    }

    // Semantic Decision Tree based on AST behavior
    if (hasReturn) {
      return {
        semantic: 'RETURN',
        confidence: 'CERTAIN',
        description: 'Returns values from current VM stack frame to caller',
        operands: [{ name: 'A', type: 'REG', meaning: 'Start register' }, { name: 'B', type: 'CONST', meaning: 'Number of return values' }],
        registersRead,
        registersWritten,
        isControlFlow: true
      };
    }

    if (hasCall) {
      return {
        semantic: 'CALL',
        confidence: 'CERTAIN',
        description: 'Invokes closure or Roblox API function with register arguments',
        operands: [{ name: 'A', type: 'REG', meaning: 'Callee register' }, { name: 'B', type: 'CONST', meaning: 'Arg count' }, { name: 'C', type: 'CONST', meaning: 'Ret count' }],
        registersRead,
        registersWritten,
        isControlFlow: true
      };
    }

    if (hasComparison && hasJump) {
      return {
        semantic: 'CONDITIONAL_JUMP',
        confidence: 'CERTAIN',
        description: 'Evaluates conditional expression and conditionally jumps PC offset',
        operands: [{ name: 'A', type: 'REG', meaning: 'Left operand' }, { name: 'B', type: 'REG', meaning: 'Right operand' }, { name: 'sBx', type: 'JUMP_OFFSET', meaning: 'Signed jump offset' }],
        registersRead,
        registersWritten,
        isControlFlow: true
      };
    }

    if (hasJump) {
      return {
        semantic: 'JUMP',
        confidence: 'CERTAIN',
        description: 'Unconditionally updates Program Counter (PC) to target instruction offset',
        operands: [{ name: 'sBx', type: 'JUMP_OFFSET', meaning: 'Relative instruction offset' }],
        registersRead,
        registersWritten,
        isControlFlow: true
      };
    }

    if (hasAdd) {
      return {
        semantic: 'ADD',
        confidence: 'CERTAIN',
        description: 'Performs arithmetic addition: R[A] = R[B] + R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasSub) {
      return {
        semantic: 'SUB',
        confidence: 'CERTAIN',
        description: 'Performs arithmetic subtraction: R[A] = R[B] - R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasMul) {
      return {
        semantic: 'MUL',
        confidence: 'CERTAIN',
        description: 'Performs arithmetic multiplication: R[A] = R[B] * R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasDiv) {
      return {
        semantic: 'DIV',
        confidence: 'CERTAIN',
        description: 'Performs division: R[A] = R[B] / R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasMod) {
      return {
        semantic: 'MOD',
        confidence: 'CERTAIN',
        description: 'Performs modulo operation: R[A] = R[B] % R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasConcat) {
      return {
        semantic: 'CONCAT',
        confidence: 'CERTAIN',
        description: 'Concatenates string register range: R[A] = R[B] .. R[C]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'Start register' }, { name: 'C', type: 'REG', meaning: 'End register' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasBitwise) {
      return {
        semantic: 'BXOR',
        confidence: 'LIKELY',
        description: 'Performs bitwise transformation via bit32 library',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'LHS' }, { name: 'C', type: 'REG', meaning: 'RHS' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasNewTable) {
      return {
        semantic: 'NEW_TABLE',
        confidence: 'CERTAIN',
        description: 'Creates new empty table object in destination register: R[A] = {}',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'CONST', meaning: 'Array size' }, { name: 'C', type: 'CONST', meaning: 'Hash size' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasClosure) {
      return {
        semantic: 'CLOSURE',
        confidence: 'CERTAIN',
        description: 'Instantiates VM prototype function closure and binds upvalues',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'Bx', type: 'CONST', meaning: 'Proto index' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasGlobalGet) {
      return {
        semantic: 'GET_GLOBAL',
        confidence: 'LIKELY',
        description: 'Loads global environment field into virtual register: R[A] = _ENV[K]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'Bx', type: 'CONST', meaning: 'Global name constant' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasLoadConst) {
      return {
        semantic: 'LOAD_CONSTANT',
        confidence: 'CERTAIN',
        description: 'Loads literal constant from pool into register: R[A] = Constants[Bx]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'Bx', type: 'CONST', meaning: 'Constant pool index' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (hasTableGet) {
      return {
        semantic: 'GET_TABLE',
        confidence: 'LIKELY',
        description: 'Indexes table in register with key: R[A] = R[B][R[C] or K[C]]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'Table register' }, { name: 'C', type: 'REG', meaning: 'Key register' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    if (body.length > 0) {
      return {
        semantic: 'MOVE',
        confidence: 'POSSIBLE',
        description: 'Copies value between virtual registers: R[A] = R[B]',
        operands: [{ name: 'A', type: 'REG', meaning: 'Destination' }, { name: 'B', type: 'REG', meaning: 'Source' }],
        registersRead,
        registersWritten,
        isControlFlow: false
      };
    }

    return {
      semantic: 'UNKNOWN',
      confidence: 'UNKNOWN',
      description: 'Unclassified VM instruction handler',
      operands: [],
      registersRead,
      registersWritten,
      isControlFlow: false
    };
  }

  private extractOpcodeFromCondition(expr: ExpressionNode): number | undefined {
    if (expr.type === 'BinaryExpression') {
      if (expr.operator === '==' || expr.operator === '<' || expr.operator === '>') {
        if (expr.right.type === 'LiteralNumber') return expr.right.value;
        if (expr.left.type === 'LiteralNumber') return expr.left.value;
      }
    }
    return undefined;
  }

  private stmtToSummary(stmt: StatementNode): string {
    if (stmt.type === 'Assignment') {
      const targets = stmt.targets.map(t => this.exprSummary(t)).join(', ');
      const values = stmt.values.map(v => this.exprSummary(v)).join(', ');
      return `${targets} = ${values}`;
    }
    if (stmt.type === 'LocalAssignment') {
      const names = stmt.names.map(n => n.name).join(', ');
      const values = stmt.values.map(v => this.exprSummary(v)).join(', ');
      return `local ${names} = ${values}`;
    }
    if (stmt.type === 'CallStatement') {
      return this.exprSummary(stmt.expression);
    }
    if (stmt.type === 'ReturnStatement') {
      return `return ${stmt.values.map(v => this.exprSummary(v)).join(', ')}`;
    }
    return stmt.type;
  }

  private exprSummary(expr: ExpressionNode): string {
    if (!expr) return '';
    if (expr.type === 'Identifier') return expr.name;
    if (expr.type === 'LiteralNumber') return expr.raw || expr.value.toString();
    if (expr.type === 'LiteralString') return `"${expr.value}"`;
    if (expr.type === 'BinaryExpression') return `${this.exprSummary(expr.left)} ${expr.operator} ${this.exprSummary(expr.right)}`;
    if (expr.type === 'MemberExpression') return `${this.exprSummary(expr.base)}.${expr.identifier.name}`;
    if (expr.type === 'IndexExpression') return `${this.exprSummary(expr.base)}[${this.exprSummary(expr.index)}]`;
    if (expr.type === 'CallExpression') return `${this.exprSummary(expr.base)}(...)`;
    if (expr.type === 'MethodCallExpression') return `${this.exprSummary(expr.base)}:${expr.method.name}(...)`;
    return '...';
  }
}
