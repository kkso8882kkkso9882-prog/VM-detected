import {
  Token,
  ProgramNode,
  StatementNode,
  ExpressionNode,
  IdentifierNode,
  TableFieldNode,
  TableConstructorNode,
  SourceSpan,
  MemberExpressionNode,
  IndexExpressionNode,
  CallExpressionNode,
  MethodCallExpressionNode,
  FunctionExpressionNode
} from '../types/ast';

export class LuauParser {
  private tokens: Token[];
  private cursor: number = 0;

  constructor(tokens: Token[]) {
    // Filter out comments from syntactic stream, keep comments if needed
    this.tokens = tokens.filter(t => t.type !== 'COMMENT');
  }

  public parse(): ProgramNode {
    const startLoc = this.currentToken().loc.start;
    const body: StatementNode[] = [];

    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      } else {
        // Recovery: skip token if we cannot parse
        this.advance();
      }
    }

    const endLoc = this.currentToken().loc.end;
    return {
      type: 'Program',
      body,
      loc: { start: startLoc, end: endLoc }
    };
  }

  private isAtEnd(): boolean {
    return this.cursor >= this.tokens.length || this.currentToken().type === 'EOF';
  }

  private currentToken(): Token {
    return this.tokens[this.cursor] || {
      type: 'EOF',
      value: '<EOF>',
      raw: '',
      loc: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
    };
  }

  private peek(offset: number = 1): Token {
    return this.tokens[this.cursor + offset] || this.currentToken();
  }

  private advance(): Token {
    const t = this.currentToken();
    if (!this.isAtEnd()) {
      this.cursor++;
    }
    return t;
  }

  private match(val: string): boolean {
    if (this.currentToken().value === val) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(val: string): Token {
    if (this.currentToken().value === val) {
      return this.advance();
    }
    // Return dummy token on parse error for resilience
    const curr = this.currentToken();
    return {
      type: 'PUNCTUATION',
      value: val,
      raw: val,
      loc: curr.loc
    };
  }

  private parseStatement(): StatementNode | null {
    const tok = this.currentToken();

    // Semicolons
    if (tok.value === ';') {
      this.advance();
      return null;
    }

    if (tok.value === 'local') {
      return this.parseLocalStatement();
    }

    if (tok.value === 'if') {
      return this.parseIfStatement();
    }

    if (tok.value === 'while') {
      return this.parseWhileStatement();
    }

    if (tok.value === 'repeat') {
      return this.parseRepeatStatement();
    }

    if (tok.value === 'for') {
      return this.parseForStatement();
    }

    if (tok.value === 'function') {
      return this.parseFunctionDeclaration();
    }

    if (tok.value === 'return') {
      return this.parseReturnStatement();
    }

    if (tok.value === 'break') {
      const loc = this.advance().loc;
      return { type: 'BreakStatement', loc };
    }

    if (tok.value === 'continue') {
      const loc = this.advance().loc;
      return { type: 'ContinueStatement', loc };
    }

    if (tok.value === 'do') {
      return this.parseDoBlock();
    }

    // Ignore type aliases: type X = ... or export type X = ...
    if (tok.value === 'type' || (tok.value === 'export' && this.peek().value === 'type')) {
      while (!this.isAtEnd() && this.currentToken().loc.start.line === tok.loc.start.line) {
        this.advance();
      }
      return null;
    }

    // Otherwise, expression or assignment statement
    return this.parseAssignmentOrCallStatement();
  }

  private parseLocalStatement(): StatementNode {
    const startTok = this.advance(); // 'local'

    if (this.currentToken().value === 'function') {
      this.advance(); // 'function'
      const name = this.parseIdentifier();
      this.expect('(');
      const { params, isVararg } = this.parseParameterList();
      this.expect(')');
      const body = this.parseBlock(['end']);
      const endTok = this.expect('end');
      return {
        type: 'LocalFunctionDeclaration',
        name,
        params,
        isVararg,
        body,
        loc: { start: startTok.loc.start, end: endTok.loc.end }
      };
    }

    const names: IdentifierNode[] = [];
    names.push(this.parseIdentifier());
    while (this.match(',')) {
      names.push(this.parseIdentifier());
    }

    const values: ExpressionNode[] = [];
    if (this.match('=')) {
      values.push(this.parseExpression());
      while (this.match(',')) {
        values.push(this.parseExpression());
      }
    }

    const lastLoc = values.length > 0
      ? values[values.length - 1].loc.end
      : names[names.length - 1].loc.end;

    return {
      type: 'LocalAssignment',
      names,
      values,
      loc: { start: startTok.loc.start, end: lastLoc }
    };
  }

  private parseIfStatement(): StatementNode {
    const startTok = this.advance(); // 'if'
    const condition = this.parseExpression();
    this.expect('then');
    const consequent = this.parseBlock(['elseif', 'else', 'end']);

    const elseifs: { condition: ExpressionNode; body: StatementNode[]; loc: SourceSpan }[] = [];
    while (this.currentToken().value === 'elseif') {
      const elseifTok = this.advance();
      const elseifCond = this.parseExpression();
      this.expect('then');
      const elseifBody = this.parseBlock(['elseif', 'else', 'end']);
      elseifs.push({
        condition: elseifCond,
        body: elseifBody,
        loc: { start: elseifTok.loc.start, end: this.currentToken().loc.start }
      });
    }

    let alternate: StatementNode[] | null = null;
    if (this.currentToken().value === 'else') {
      this.advance(); // 'else'
      alternate = this.parseBlock(['end']);
    }

    const endTok = this.expect('end');
    return {
      type: 'IfStatement',
      condition,
      consequent,
      elseifs,
      alternate,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseWhileStatement(): StatementNode {
    const startTok = this.advance(); // 'while'
    const condition = this.parseExpression();
    this.expect('do');
    const body = this.parseBlock(['end']);
    const endTok = this.expect('end');

    return {
      type: 'WhileStatement',
      condition,
      body,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseRepeatStatement(): StatementNode {
    const startTok = this.advance(); // 'repeat'
    const body = this.parseBlock(['until']);
    this.expect('until');
    const condition = this.parseExpression();

    return {
      type: 'RepeatStatement',
      condition,
      body,
      loc: { start: startTok.loc.start, end: condition.loc.end }
    };
  }

  private parseForStatement(): StatementNode {
    const startTok = this.advance(); // 'for'
    const var1 = this.parseIdentifier();

    if (this.match('=')) {
      // Numeric for
      const start = this.parseExpression();
      this.expect(',');
      const end = this.parseExpression();
      let step: ExpressionNode | null = null;
      if (this.match(',')) {
        step = this.parseExpression();
      }
      this.expect('do');
      const body = this.parseBlock(['end']);
      const endTok = this.expect('end');

      return {
        type: 'ForNumeric',
        variable: var1,
        start,
        end,
        step,
        body,
        loc: { start: startTok.loc.start, end: endTok.loc.end }
      };
    }

    // Generic for
    const variables: IdentifierNode[] = [var1];
    while (this.match(',')) {
      variables.push(this.parseIdentifier());
    }
    this.expect('in');
    const iterators: ExpressionNode[] = [this.parseExpression()];
    while (this.match(',')) {
      iterators.push(this.parseExpression());
    }
    this.expect('do');
    const body = this.parseBlock(['end']);
    const endTok = this.expect('end');

    return {
      type: 'ForGeneric',
      variables,
      iterators,
      body,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseFunctionDeclaration(): StatementNode {
    const startTok = this.advance(); // 'function'
    let name: IdentifierNode | MemberExpressionNode = this.parseIdentifier();

    while (this.match('.')) {
      const field = this.parseIdentifier();
      name = {
        type: 'MemberExpression',
        base: name,
        identifier: field,
        loc: { start: name.loc.start, end: field.loc.end }
      };
    }

    if (this.match(':')) {
      const method = this.parseIdentifier();
      name = {
        type: 'MemberExpression',
        base: name,
        identifier: method,
        loc: { start: name.loc.start, end: method.loc.end }
      };
    }

    this.expect('(');
    const { params, isVararg } = this.parseParameterList();
    this.expect(')');
    const body = this.parseBlock(['end']);
    const endTok = this.expect('end');

    return {
      type: 'FunctionDeclaration',
      name,
      params,
      isVararg,
      body,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseReturnStatement(): StatementNode {
    const startTok = this.advance(); // 'return'
    const values: ExpressionNode[] = [];

    // Luau return values
    const stopKeywords = ['end', 'else', 'elseif', 'until', ';'];
    if (!stopKeywords.includes(this.currentToken().value) && !this.isAtEnd()) {
      values.push(this.parseExpression());
      while (this.match(',')) {
        values.push(this.parseExpression());
      }
    }

    return {
      type: 'ReturnStatement',
      values,
      loc: {
        start: startTok.loc.start,
        end: values.length > 0 ? values[values.length - 1].loc.end : startTok.loc.end
      }
    };
  }

  private parseDoBlock(): StatementNode {
    const startTok = this.advance(); // 'do'
    const body = this.parseBlock(['end']);
    const endTok = this.expect('end');

    return {
      type: 'DoBlock',
      body,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseAssignmentOrCallStatement(): StatementNode | null {
    const firstExpr = this.parsePrefixExpression();

    // Check for compound assignment (+=, -=, *=, /=, //=, %=, ^=, ..=)
    const compoundOps = ['+=', '-=', '*=', '/=', '//=', '%=', '^=', '..='];
    if (compoundOps.includes(this.currentToken().value)) {
      const op = this.advance().value as any;
      const val = this.parseExpression();
      return {
        type: 'CompoundAssignment',
        operator: op,
        target: firstExpr as any,
        value: val,
        loc: { start: firstExpr.loc.start, end: val.loc.end }
      };
    }

    // Check for standard assignment (=, or comma list)
    if (this.currentToken().value === ',' || this.currentToken().value === '=') {
      const targets = [firstExpr as any];
      while (this.match(',')) {
        targets.push(this.parsePrefixExpression() as any);
      }
      this.expect('=');
      const values: ExpressionNode[] = [this.parseExpression()];
      while (this.match(',')) {
        values.push(this.parseExpression());
      }
      return {
        type: 'Assignment',
        targets,
        values,
        loc: { start: firstExpr.loc.start, end: values[values.length - 1].loc.end }
      };
    }

    // If it is a call expression statement
    if (firstExpr.type === 'CallExpression' || firstExpr.type === 'MethodCallExpression') {
      return {
        type: 'CallStatement',
        expression: firstExpr as CallExpressionNode,
        loc: firstExpr.loc
      };
    }

    return null;
  }

  private parseBlock(stopTokens: string[]): StatementNode[] {
    const body: StatementNode[] = [];
    while (!this.isAtEnd() && !stopTokens.includes(this.currentToken().value)) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    return body;
  }

  private parseParameterList(): { params: IdentifierNode[]; isVararg: boolean } {
    const params: IdentifierNode[] = [];
    let isVararg = false;

    if (this.currentToken().value !== ')') {
      if (this.currentToken().value === '...') {
        this.advance();
        isVararg = true;
      } else {
        params.push(this.parseIdentifier());
        while (this.match(',')) {
          if (this.currentToken().value === '...') {
            this.advance();
            isVararg = true;
            break;
          }
          params.push(this.parseIdentifier());
        }
      }
    }

    return { params, isVararg };
  }

  // Expression Parsing with Operator Precedence
  public parseExpression(): ExpressionNode {
    return this.parseBinaryExpression(0);
  }

  private getPrecedence(op: string): number {
    switch (op) {
      case 'or': return 1;
      case 'and': return 2;
      case '<': case '<=': case '>': case '>=': case '==': case '~=': return 3;
      case '..': return 4;
      case '+': case '-': return 5;
      case '*': case '/': case '//': case '%': return 6;
      case '^': return 8; // right-associative
      default: return 0;
    }
  }

  private parseBinaryExpression(minPrec: number): ExpressionNode {
    let left = this.parseUnaryExpression();

    while (true) {
      const op = this.currentToken().value;
      const prec = this.getPrecedence(op);
      if (prec <= minPrec) break;

      this.advance(); // consume op
      const nextMinPrec = (op === '^' || op === '..') ? prec - 1 : prec;
      const right = this.parseBinaryExpression(nextMinPrec);

      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: { start: left.loc.start, end: right.loc.end }
      };
    }

    return left;
  }

  private parseUnaryExpression(): ExpressionNode {
    const tok = this.currentToken();
    if (tok.value === 'not' || tok.value === '-' || tok.value === '#') {
      this.advance();
      const arg = this.parseUnaryExpression();
      return {
        type: 'UnaryExpression',
        operator: tok.value,
        argument: arg,
        loc: { start: tok.loc.start, end: arg.loc.end }
      };
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): ExpressionNode {
    const tok = this.currentToken();

    if (tok.type === 'NUMBER') {
      this.advance();
      let numVal = parseFloat(tok.value);
      let radix: 10 | 16 | 2 = 10;
      if (tok.raw.startsWith('0x') || tok.raw.startsWith('0X')) radix = 16;
      if (tok.raw.startsWith('0b') || tok.raw.startsWith('0B')) radix = 2;
      return {
        type: 'LiteralNumber',
        value: numVal,
        raw: tok.raw,
        radix,
        loc: tok.loc
      };
    }

    if (tok.type === 'STRING') {
      this.advance();
      return {
        type: 'LiteralString',
        value: tok.value,
        raw: tok.raw,
        loc: tok.loc
      };
    }

    if (tok.value === 'true' || tok.value === 'false') {
      this.advance();
      return {
        type: 'LiteralBoolean',
        value: tok.value === 'true',
        loc: tok.loc
      };
    }

    if (tok.value === 'nil') {
      this.advance();
      return {
        type: 'LiteralNil',
        loc: tok.loc
      };
    }

    if (tok.value === '...') {
      this.advance();
      return {
        type: 'Vararg',
        loc: tok.loc
      };
    }

    if (tok.value === '{') {
      return this.parseTableConstructor();
    }

    if (tok.value === 'function') {
      return this.parseFunctionExpression();
    }

    // Prefix expression (Identifiers, (Expr), calls, index)
    return this.parsePrefixExpression();
  }

  private parsePrefixExpression(): ExpressionNode {
    let base: ExpressionNode;
    const tok = this.currentToken();

    if (tok.value === '(') {
      this.advance();
      base = this.parseExpression();
      this.expect(')');
    } else if (tok.type === 'IDENTIFIER' || tok.type === 'KEYWORD') {
      base = this.parseIdentifier();
    } else {
      this.advance();
      return {
        type: 'LiteralNil',
        loc: tok.loc
      };
    }

    while (true) {
      if (this.currentToken().value === '.') {
        this.advance();
        const id = this.parseIdentifier();
        base = {
          type: 'MemberExpression',
          base,
          identifier: id,
          loc: { start: base.loc.start, end: id.loc.end }
        };
      } else if (this.currentToken().value === '[') {
        this.advance();
        const idx = this.parseExpression();
        const endTok = this.expect(']');
        base = {
          type: 'IndexExpression',
          base,
          index: idx,
          loc: { start: base.loc.start, end: endTok.loc.end }
        };
      } else if (this.currentToken().value === ':') {
        this.advance();
        const method = this.parseIdentifier();
        const args = this.parseFunctionArgs();
        base = {
          type: 'MethodCallExpression',
          base,
          method,
          args,
          loc: { start: base.loc.start, end: this.currentToken().loc.end }
        };
      } else if (this.currentToken().value === '(' || this.currentToken().value === '{' || this.currentToken().type === 'STRING') {
        const args = this.parseFunctionArgs();
        base = {
          type: 'CallExpression',
          base,
          args,
          loc: { start: base.loc.start, end: this.currentToken().loc.end }
        };
      } else {
        break;
      }
    }

    return base;
  }

  private parseFunctionArgs(): ExpressionNode[] {
    const tok = this.currentToken();
    if (tok.value === '(') {
      this.advance();
      const args: ExpressionNode[] = [];
      if (this.currentToken().value !== ')') {
        args.push(this.parseExpression());
        while (this.match(',')) {
          args.push(this.parseExpression());
        }
      }
      this.expect(')');
      return args;
    }
    if (tok.value === '{') {
      return [this.parseTableConstructor()];
    }
    if (tok.type === 'STRING') {
      const s = this.advance();
      return [{
        type: 'LiteralString',
        value: s.value,
        raw: s.raw,
        loc: s.loc
      }];
    }
    return [];
  }

  private parseTableConstructor(): TableConstructorNode {
    const startTok = this.expect('{');
    const fields: TableFieldNode[] = [];

    while (this.currentToken().value !== '}' && !this.isAtEnd()) {
      if (this.currentToken().value === '[') {
        this.advance();
        const key = this.parseExpression();
        this.expect(']');
        this.expect('=');
        const val = this.parseExpression();
        fields.push({
          type: 'TableField',
          key,
          value: val,
          loc: { start: key.loc.start, end: val.loc.end }
        });
      } else if (this.currentToken().type === 'IDENTIFIER' && this.peek().value === '=') {
        const keyId = this.parseIdentifier();
        this.advance(); // '='
        const val = this.parseExpression();
        fields.push({
          type: 'TableField',
          key: keyId,
          value: val,
          loc: { start: keyId.loc.start, end: val.loc.end }
        });
      } else {
        const val = this.parseExpression();
        fields.push({
          type: 'TableField',
          key: null,
          value: val,
          loc: val.loc
        });
      }

      if (this.currentToken().value === ',' || this.currentToken().value === ';') {
        this.advance();
      } else {
        break;
      }
    }

    const endTok = this.expect('}');
    return {
      type: 'TableConstructor',
      fields,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseFunctionExpression(): FunctionExpressionNode {
    const startTok = this.advance(); // 'function'
    this.expect('(');
    const { params, isVararg } = this.parseParameterList();
    this.expect(')');
    const body = this.parseBlock(['end']);
    const endTok = this.expect('end');

    return {
      type: 'FunctionExpression',
      params,
      isVararg,
      body,
      loc: { start: startTok.loc.start, end: endTok.loc.end }
    };
  }

  private parseIdentifier(): IdentifierNode {
    const tok = this.currentToken();
    if (tok.type === 'IDENTIFIER' || tok.type === 'KEYWORD') {
      this.advance();
      return {
        type: 'Identifier',
        name: tok.value,
        loc: tok.loc
      };
    }
    this.advance();
    return {
      type: 'Identifier',
      name: tok.value || '_unknown',
      loc: tok.loc
    };
  }
}
