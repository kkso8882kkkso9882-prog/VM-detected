import {
  ASTNode,
  ProgramNode,
  StatementNode,
  ExpressionNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  LiteralNumberNode,
  LiteralBooleanNode,
  LiteralStringNode,
  IfStatementNode
} from '../types/ast';
import { OpaquePredicate } from '../types/analysis';

export class SymbolicSimplifier {
  private opaquePredicates: OpaquePredicate[] = [];
  private constantMap: Map<string, number | string | boolean> = new Map();
  private propagatedCount = 0;

  public simplify(ast: ProgramNode): {
    simplifiedAst: ProgramNode;
    opaquePredicates: OpaquePredicate[];
    propagatedCount: number;
  } {
    this.opaquePredicates = [];
    this.constantMap = new Map();
    this.propagatedCount = 0;

    // First pass: collect top-level simple constants
    this.collectKnownConstants(ast.body);

    // Second pass: propagate and fold
    const simplifiedBody = this.simplifyStatements(ast.body);

    return {
      simplifiedAst: {
        type: 'Program',
        body: simplifiedBody,
        loc: ast.loc
      },
      opaquePredicates: this.opaquePredicates,
      propagatedCount: this.propagatedCount
    };
  }

  private collectKnownConstants(stmts: StatementNode[]) {
    for (const stmt of stmts) {
      if (stmt.type === 'LocalAssignment') {
        for (let i = 0; i < stmt.names.length; i++) {
          const valExpr = stmt.values[i];
          if (valExpr) {
            const folded = this.evalExpression(valExpr);
            if (folded !== null) {
              this.constantMap.set(stmt.names[i].name, folded);
            }
          }
        }
      } else if (stmt.type === 'Assignment') {
        for (let i = 0; i < stmt.targets.length; i++) {
          const target = stmt.targets[i];
          const valExpr = stmt.values[i];
          if (target.type === 'Identifier' && valExpr) {
            const folded = this.evalExpression(valExpr);
            if (folded !== null) {
              this.constantMap.set(target.name, folded);
            }
          }
        }
      }
    }
  }

  private simplifyStatements(stmts: StatementNode[]): StatementNode[] {
    const result: StatementNode[] = [];

    for (const stmt of stmts) {
      const simplified = this.simplifyStatement(stmt);
      if (simplified) {
        if (Array.isArray(simplified)) {
          result.push(...simplified);
        } else {
          result.push(simplified);
        }
      }
    }

    return result;
  }

  private simplifyStatement(stmt: StatementNode): StatementNode | StatementNode[] | null {
    switch (stmt.type) {
      case 'IfStatement': {
        return this.simplifyIfStatement(stmt);
      }
      case 'WhileStatement': {
        const condEval = this.evalExpression(stmt.condition);
        const condExpr = this.simplifyExpression(stmt.condition);

        if (condEval === false) {
          // Dead while loop
          this.opaquePredicates.push({
            expression: this.exprToString(stmt.condition),
            evaluatedTruth: false,
            reason: 'While loop condition is constant false (dead loop)',
            line: stmt.loc.start.line,
            loc: stmt.loc
          });
          return null;
        }

        return {
          ...stmt,
          condition: condExpr,
          body: this.simplifyStatements(stmt.body)
        };
      }
      case 'RepeatStatement': {
        return {
          ...stmt,
          condition: this.simplifyExpression(stmt.condition),
          body: this.simplifyStatements(stmt.body)
        };
      }
      case 'ForNumeric': {
        return {
          ...stmt,
          start: this.simplifyExpression(stmt.start),
          end: this.simplifyExpression(stmt.end),
          step: stmt.step ? this.simplifyExpression(stmt.step) : null,
          body: this.simplifyStatements(stmt.body)
        };
      }
      case 'ForGeneric': {
        return {
          ...stmt,
          iterators: stmt.iterators.map(it => this.simplifyExpression(it)),
          body: this.simplifyStatements(stmt.body)
        };
      }
      case 'LocalAssignment': {
        const newValues = stmt.values.map(v => this.simplifyExpression(v));
        // Update constant map
        for (let i = 0; i < stmt.names.length; i++) {
          const folded = this.evalExpression(newValues[i]);
          if (folded !== null) {
            this.constantMap.set(stmt.names[i].name, folded);
            this.propagatedCount++;
          }
        }
        return {
          ...stmt,
          values: newValues
        };
      }
      case 'Assignment': {
        const newValues = stmt.values.map(v => this.simplifyExpression(v));
        for (let i = 0; i < stmt.targets.length; i++) {
          const target = stmt.targets[i];
          if (target.type === 'Identifier') {
            const folded = this.evalExpression(newValues[i]);
            if (folded !== null) {
              this.constantMap.set(target.name, folded);
              this.propagatedCount++;
            }
          }
        }
        return {
          ...stmt,
          values: newValues
        };
      }
      case 'DoBlock': {
        return {
          ...stmt,
          body: this.simplifyStatements(stmt.body)
        };
      }
      case 'ReturnStatement': {
        return {
          ...stmt,
          values: stmt.values.map(v => this.simplifyExpression(v))
        };
      }
      case 'CallStatement': {
        return {
          ...stmt,
          expression: this.simplifyExpression(stmt.expression) as any
        };
      }
      default:
        return stmt;
    }
  }

  private simplifyIfStatement(stmt: IfStatementNode): StatementNode | StatementNode[] | null {
    // Check main condition
    const condEval = this.evalExpression(stmt.condition);
    const condStr = this.exprToString(stmt.condition);

    // Check for identity opaque predicates: x ~= x, x == x
    if (this.isIdentityOpaque(stmt.condition)) {
      const isAlwaysTrue = this.isIdentityAlwaysTrue(stmt.condition);
      this.opaquePredicates.push({
        expression: condStr,
        evaluatedTruth: isAlwaysTrue,
        reason: `Reflexive identity predicate (${condStr}) statically evaluates to ${isAlwaysTrue}`,
        line: stmt.loc.start.line,
        loc: stmt.loc
      });

      if (isAlwaysTrue) {
        // Consequent always executes
        return this.simplifyStatements(stmt.consequent);
      } else {
        // Fall to elseif or else
        if (stmt.elseifs.length > 0) {
          const firstElseif = stmt.elseifs[0];
          const remainingElseifs = stmt.elseifs.slice(1);
          return this.simplifyIfStatement({
            type: 'IfStatement',
            condition: firstElseif.condition,
            consequent: firstElseif.body,
            elseifs: remainingElseifs,
            alternate: stmt.alternate,
            loc: stmt.loc
          });
        } else if (stmt.alternate) {
          return this.simplifyStatements(stmt.alternate);
        }
        return null;
      }
    }

    if (condEval === true) {
      this.opaquePredicates.push({
        expression: condStr,
        evaluatedTruth: true,
        reason: 'Constant evaluation always yields true (dead branches removed)',
        line: stmt.loc.start.line,
        loc: stmt.loc
      });
      return this.simplifyStatements(stmt.consequent);
    }

    if (condEval === false) {
      this.opaquePredicates.push({
        expression: condStr,
        evaluatedTruth: false,
        reason: 'Constant evaluation always yields false (branch pruned)',
        line: stmt.loc.start.line,
        loc: stmt.loc
      });

      // Try elseifs
      for (let i = 0; i < stmt.elseifs.length; i++) {
        const elseif = stmt.elseifs[i];
        const eEval = this.evalExpression(elseif.condition);
        if (eEval === true) {
          return this.simplifyStatements(elseif.body);
        }
        if (eEval !== false) {
          // Dynamic branch found
          const remaining = stmt.elseifs.slice(i + 1);
          return {
            type: 'IfStatement',
            condition: this.simplifyExpression(elseif.condition),
            consequent: this.simplifyStatements(elseif.body),
            elseifs: remaining.map(r => ({
              condition: this.simplifyExpression(r.condition),
              body: this.simplifyStatements(r.body),
              loc: r.loc
            })),
            alternate: stmt.alternate ? this.simplifyStatements(stmt.alternate) : null,
            loc: stmt.loc
          };
        }
      }

      if (stmt.alternate) {
        return this.simplifyStatements(stmt.alternate);
      }
      return null;
    }

    // Dynamic condition - simplify children
    const simpCond = this.simplifyExpression(stmt.condition);
    const simpConsequent = this.simplifyStatements(stmt.consequent);
    const simpElseifs: { condition: ExpressionNode; body: StatementNode[]; loc: any }[] = [];

    for (const e of stmt.elseifs) {
      const eEval = this.evalExpression(e.condition);
      if (eEval === false) {
        this.opaquePredicates.push({
          expression: this.exprToString(e.condition),
          evaluatedTruth: false,
          reason: 'Elseif condition statically evaluated to false',
          line: e.loc.start.line,
          loc: e.loc
        });
        continue;
      }
      simpElseifs.push({
        condition: this.simplifyExpression(e.condition),
        body: this.simplifyStatements(e.body),
        loc: e.loc
      });
    }

    const simpAlt = stmt.alternate ? this.simplifyStatements(stmt.alternate) : null;

    return {
      type: 'IfStatement',
      condition: simpCond,
      consequent: simpConsequent,
      elseifs: simpElseifs,
      alternate: simpAlt,
      loc: stmt.loc
    };
  }

  public simplifyExpression(expr: ExpressionNode): ExpressionNode {
    if (!expr) return expr;

    // Try constant folding
    const folded = this.evalExpression(expr);
    if (folded !== null) {
      if (typeof folded === 'number') {
        return {
          type: 'LiteralNumber',
          value: folded,
          raw: folded.toString(),
          loc: expr.loc
        };
      }
      if (typeof folded === 'string') {
        return {
          type: 'LiteralString',
          value: folded,
          raw: `"${folded}"`,
          loc: expr.loc
        };
      }
      if (typeof folded === 'boolean') {
        return {
          type: 'LiteralBoolean',
          value: folded,
          loc: expr.loc
        };
      }
    }

    // Identifier substitution if constant known
    if (expr.type === 'Identifier') {
      const known = this.constantMap.get(expr.name);
      if (known !== undefined) {
        if (typeof known === 'number') {
          return { type: 'LiteralNumber', value: known, raw: known.toString(), loc: expr.loc };
        }
        if (typeof known === 'string') {
          return { type: 'LiteralString', value: known, raw: `"${known}"`, loc: expr.loc };
        }
        if (typeof known === 'boolean') {
          return { type: 'LiteralBoolean', value: known, loc: expr.loc };
        }
      }
      return expr;
    }

    // Binary expressions
    if (expr.type === 'BinaryExpression') {
      const left = this.simplifyExpression(expr.left);
      const right = this.simplifyExpression(expr.right);
      return {
        type: 'BinaryExpression',
        operator: expr.operator,
        left,
        right,
        loc: expr.loc
      };
    }

    // Unary expressions
    if (expr.type === 'UnaryExpression') {
      const arg = this.simplifyExpression(expr.argument);
      return {
        type: 'UnaryExpression',
        operator: expr.operator,
        argument: arg,
        loc: expr.loc
      };
    }

    // Call / Method / Index / Member
    if (expr.type === 'CallExpression') {
      return {
        ...expr,
        base: this.simplifyExpression(expr.base),
        args: expr.args.map(a => this.simplifyExpression(a))
      };
    }

    if (expr.type === 'MethodCallExpression') {
      return {
        ...expr,
        base: this.simplifyExpression(expr.base),
        args: expr.args.map(a => this.simplifyExpression(a))
      };
    }

    if (expr.type === 'IndexExpression') {
      return {
        ...expr,
        base: this.simplifyExpression(expr.base),
        index: this.simplifyExpression(expr.index)
      };
    }

    return expr;
  }

  public evalExpression(expr: ExpressionNode): number | string | boolean | null {
    if (!expr) return null;

    if (expr.type === 'LiteralNumber') return expr.value;
    if (expr.type === 'LiteralString') return expr.value;
    if (expr.type === 'LiteralBoolean') return expr.value;

    if (expr.type === 'Identifier') {
      if (this.constantMap.has(expr.name)) {
        return this.constantMap.get(expr.name)!;
      }
      return null;
    }

    if (expr.type === 'UnaryExpression') {
      const val = this.evalExpression(expr.argument);
      if (val === null) return null;
      if (expr.operator === '-') return typeof val === 'number' ? -val : null;
      if (expr.operator === 'not') return !val;
      if (expr.operator === '#' && typeof val === 'string') return val.length;
      return null;
    }

    if (expr.type === 'BinaryExpression') {
      const left = this.evalExpression(expr.left);
      const right = this.evalExpression(expr.right);

      if (left === null || right === null) {
        // Special case: check for identity x == x or x ~= x
        if (this.exprToString(expr.left) === this.exprToString(expr.right)) {
          if (expr.operator === '==') return true;
          if (expr.operator === '~=') return false;
        }
        return null;
      }

      if (typeof left === 'number' && typeof right === 'number') {
        switch (expr.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return right !== 0 ? left / right : null;
          case '//': return right !== 0 ? Math.floor(left / right) : null;
          case '%': return right !== 0 ? left % right : null;
          case '^': return Math.pow(left, right);
          case '==': return left === right;
          case '~=': return left !== right;
          case '<': return left < right;
          case '<=': return left <= right;
          case '>': return left > right;
          case '>=': return left >= right;
        }
      }

      if (typeof left === 'string' || typeof right === 'string') {
        if (expr.operator === '..') return `${left}${right}`;
        if (expr.operator === '==') return left === right;
        if (expr.operator === '~=') return left !== right;
      }

      if (typeof left === 'boolean' && typeof right === 'boolean') {
        if (expr.operator === 'and') return left && right;
        if (expr.operator === 'or') return left || right;
        if (expr.operator === '==') return left === right;
        if (expr.operator === '~=') return left !== right;
      }
    }

    // Call expressions for bit32 / math
    if (expr.type === 'CallExpression' && expr.base.type === 'MemberExpression') {
      const baseObj = expr.base.base;
      const baseField = expr.base.identifier.name;

      if (baseObj.type === 'Identifier' && (baseObj.name === 'bit32' || baseObj.name === 'bit')) {
        const evaluatedArgs = expr.args.map(a => this.evalExpression(a));
        if (evaluatedArgs.every(a => typeof a === 'number')) {
          const nums = evaluatedArgs as number[];
          if (baseField === 'band' && nums.length >= 2) return nums.reduce((a, b) => a & b);
          if (baseField === 'bor' && nums.length >= 2) return nums.reduce((a, b) => a | b);
          if (baseField === 'bxor' && nums.length >= 2) return nums.reduce((a, b) => a ^ b);
          if (baseField === 'bnot' && nums.length >= 1) return ~nums[0] >>> 0;
          if (baseField === 'rshift' && nums.length >= 2) return (nums[0] >>> nums[1]);
          if (baseField === 'lshift' && nums.length >= 2) return (nums[0] << nums[1]) >>> 0;
          if (baseField === 'extract' && nums.length >= 2) {
            const field = nums[1];
            const width = nums[2] || 1;
            const mask = ((1 << width) - 1);
            return (nums[0] >>> field) & mask;
          }
        }
      }

      if (baseObj.type === 'Identifier' && baseObj.name === 'math') {
        const evaluatedArgs = expr.args.map(a => this.evalExpression(a));
        if (evaluatedArgs.every(a => typeof a === 'number')) {
          const nums = evaluatedArgs as number[];
          if (baseField === 'floor') return Math.floor(nums[0]);
          if (baseField === 'abs') return Math.abs(nums[0]);
          if (baseField === 'min') return Math.min(...nums);
          if (baseField === 'max') return Math.max(...nums);
        }
      }
    }

    return null;
  }

  private isIdentityOpaque(expr: ExpressionNode): boolean {
    if (expr.type === 'BinaryExpression') {
      const leftStr = this.exprToString(expr.left);
      const rightStr = this.exprToString(expr.right);
      if (leftStr && leftStr === rightStr) {
        return expr.operator === '==' || expr.operator === '~=';
      }
    }
    return false;
  }

  private isIdentityAlwaysTrue(expr: ExpressionNode): boolean {
    if (expr.type === 'BinaryExpression') {
      return expr.operator === '==';
    }
    return false;
  }

  public exprToString(expr: ExpressionNode): string {
    if (!expr) return '';
    switch (expr.type) {
      case 'Identifier': return expr.name;
      case 'LiteralNumber': return expr.raw || expr.value.toString();
      case 'LiteralString': return `"${expr.value}"`;
      case 'LiteralBoolean': return expr.value ? 'true' : 'false';
      case 'LiteralNil': return 'nil';
      case 'BinaryExpression': return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
      case 'UnaryExpression': return `${expr.operator}${this.exprToString(expr.argument)}`;
      case 'MemberExpression': return `${this.exprToString(expr.base)}.${expr.identifier.name}`;
      case 'IndexExpression': return `${this.exprToString(expr.base)}[${this.exprToString(expr.index)}]`;
      case 'CallExpression': return `${this.exprToString(expr.base)}(${expr.args.map(a => this.exprToString(a)).join(', ')})`;
      case 'MethodCallExpression': return `${this.exprToString(expr.base)}:${expr.method.name}(${expr.args.map(a => this.exprToString(a)).join(', ')})`;
      default: return '...';
    }
  }
}
