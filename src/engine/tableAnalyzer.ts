import {
  ProgramNode,
  StatementNode,
  ExpressionNode,
  TableConstructorNode,
  TableFieldNode
} from '../types/ast';
import { TableStructure } from '../types/analysis';

export class TableStructureAnalyzer {
  public analyze(ast: ProgramNode): {
    tables: TableStructure[];
    functionRoles: Map<string, string>;
  } {
    const tables: TableStructure[] = [];
    const functionRoles: Map<string, string> = new Map();

    // 1. Scan statements for table declarations & constructors
    this.scanStatements(ast.body, tables, functionRoles);

    return { tables, functionRoles };
  }

  private scanStatements(
    stmts: StatementNode[],
    tables: TableStructure[],
    functionRoles: Map<string, string>
  ) {
    for (const stmt of stmts) {
      if (stmt.type === 'LocalAssignment') {
        for (let i = 0; i < stmt.names.length; i++) {
          const name = stmt.names[i].name;
          const valExpr = stmt.values[i];
          if (valExpr && valExpr.type === 'TableConstructor') {
            this.classifyTable(name, valExpr, tables, functionRoles);
          }
        }
      } else if (stmt.type === 'Assignment') {
        for (let i = 0; i < stmt.targets.length; i++) {
          const target = stmt.targets[i];
          const valExpr = stmt.values[i];
          if (target.type === 'Identifier' && valExpr && valExpr.type === 'TableConstructor') {
            this.classifyTable(target.name, valExpr, tables, functionRoles);
          }
        }
      } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'LocalFunctionDeclaration') {
        const fnName = stmt.name.type === 'Identifier' ? stmt.name.name : 'anon_fn';
        const role = this.classifyFunctionRole(stmt.body);
        functionRoles.set(fnName, role);
      } else if (stmt.type === 'WhileStatement') {
        this.scanStatements(stmt.body, tables, functionRoles);
      } else if (stmt.type === 'IfStatement') {
        this.scanStatements(stmt.consequent, tables, functionRoles);
        for (const e of stmt.elseifs) this.scanStatements(e.body, tables, functionRoles);
        if (stmt.alternate) this.scanStatements(stmt.alternate, tables, functionRoles);
      }
    }
  }

  private classifyTable(
    name: string,
    tableNode: TableConstructorNode,
    tables: TableStructure[],
    functionRoles: Map<string, string>
  ) {
    const fieldCount = tableNode.fields.length;
    const sampleKeys: (string | number)[] = [];
    let functionCount = 0;
    let stringCount = 0;
    let numberCount = 0;
    let tableCount = 0;

    for (let idx = 0; idx < tableNode.fields.length; idx++) {
      const field = tableNode.fields[idx];
      if (idx < 8) {
        if (field.key) {
          sampleKeys.push(this.getKeySummary(field.key));
        } else {
          sampleKeys.push(`[${idx + 1}]`);
        }
      }

      if (field.value.type === 'FunctionExpression') {
        functionCount++;
      } else if (field.value.type === 'LiteralString') {
        stringCount++;
      } else if (field.value.type === 'LiteralNumber') {
        numberCount++;
      } else if (field.value.type === 'TableConstructor') {
        tableCount++;
      }
    }

    let type: TableStructure['type'] = 'METADATA_TABLE';
    let purpose = 'General structured data table';
    let confidence: TableStructure['confidence'] = 'LIKELY';

    if (functionCount > 0 && functionCount >= fieldCount * 0.4) {
      type = 'HANDLER_TABLE';
      purpose = 'Virtual Machine opcode handler function dispatch table';
      confidence = 'CERTAIN';
    } else if (stringCount > 0 && stringCount >= fieldCount * 0.6) {
      type = 'STRING_POOL';
      purpose = 'Obfuscated string and symbol pool';
      confidence = 'CERTAIN';
    } else if (numberCount > 0 && numberCount >= fieldCount * 0.7) {
      if (/^(op|code|inst|bytecode|bc|program)/i.test(name)) {
        type = 'OPCODE_TABLE';
        purpose = 'Virtual Machine bytecode and instruction stream';
        confidence = 'CERTAIN';
      } else {
        type = 'CONSTANT_POOL';
        purpose = 'Numeric constant and offset lookup table';
        confidence = 'LIKELY';
      }
    } else if (/^(reg|stack|env|stk|r|env_table|environment)/i.test(name)) {
      if (/^(reg|r)/i.test(name)) {
        type = 'REGISTER_TABLE';
        purpose = 'Virtual CPU Register allocation array (R[0]..R[n])';
        confidence = 'CERTAIN';
      } else if (/^(stack|stk)/i.test(name)) {
        type = 'STACK_TABLE';
        purpose = 'Virtual evaluation stack for expressions and return values';
        confidence = 'CERTAIN';
      } else {
        type = 'ENVIRONMENT_TABLE';
        purpose = 'Global / Closure environment scope mapping';
        confidence = 'LIKELY';
      }
    } else if (tableCount > 0 && tableCount >= fieldCount * 0.5) {
      type = 'METADATA_TABLE';
      purpose = 'Nested prototype hierarchy / instruction descriptor table';
      confidence = 'LIKELY';
    }

    tables.push({
      name,
      type,
      elementCount: fieldCount,
      sampleKeys,
      purpose,
      confidence
    });
  }

  private classifyFunctionRole(stmts: StatementNode[]): string {
    const strRep = JSON.stringify(stmts);

    if (strRep.includes('bit32.bxor') || strRep.includes('string.char') || strRep.includes('string.byte')) {
      return 'string decoder / crypto helper';
    }
    if (strRep.includes('WhileStatement') && strRep.includes('IfStatement')) {
      return 'VM dispatcher loop';
    }
    if (strRep.includes('bit32.band') || strRep.includes('bit32.rshift') || strRep.includes('bit32.extract')) {
      return 'opcode bitfield unpacker';
    }
    if (strRep.includes('GetService') || strRep.includes('FireServer')) {
      return 'Roblox API wrapper';
    }
    return 'VM internal helper';
  }

  private getKeySummary(expr: ExpressionNode): string {
    if (expr.type === 'Identifier') return expr.name;
    if (expr.type === 'LiteralNumber') return expr.raw || expr.value.toString();
    if (expr.type === 'LiteralString') return `"${expr.value.slice(0, 10)}"`;
    return '...';
  }
}
