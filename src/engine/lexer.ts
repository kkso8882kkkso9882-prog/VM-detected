import { Token, TokenType, SourceLocation, SourceSpan } from '../types/ast';

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while', 'continue', 'type', 'export'
]);

export class LuauLexer {
  private input: string;
  private length: number;
  private cursor: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.cursor < this.length) {
      this.skipWhitespace();
      if (this.cursor >= this.length) break;

      const char = this.input[this.cursor];
      const nextChar = this.cursor + 1 < this.length ? this.input[this.cursor + 1] : '';

      // Comments
      if (char === '-' && nextChar === '-') {
        const commentToken = this.readComment();
        if (commentToken) {
          // We can record or omit comments (we can include them for analysis)
          tokens.push(commentToken);
        }
        continue;
      }

      // Strings (single, double, or long string [[ ]])
      if (char === '"' || char === "'") {
        tokens.push(this.readShortString(char));
        continue;
      }

      if (char === '[' && (nextChar === '[' || nextChar === '=')) {
        const longStr = this.tryReadLongString();
        if (longStr) {
          tokens.push(longStr);
          continue;
        }
      }

      // Numbers (hex 0x, bin 0b, oct 0o, decimal, float)
      if (this.isDigit(char) || (char === '.' && this.isDigit(nextChar))) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers & Keywords
      if (this.isIdentifierStart(char)) {
        tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      // Compound & Multi-char operators
      const opToken = this.readOperatorOrPunctuation();
      if (opToken) {
        tokens.push(opToken);
        continue;
      }

      // If unknown char, advance
      const startLoc = this.getLocation();
      this.advance();
      tokens.push({
        type: 'PUNCTUATION',
        value: char,
        raw: char,
        loc: { start: startLoc, end: this.getLocation() }
      });
    }

    tokens.push({
      type: 'EOF',
      value: '<EOF>',
      raw: '',
      loc: { start: this.getLocation(), end: this.getLocation() }
    });

    return tokens;
  }

  private getLocation(): SourceLocation {
    return { line: this.line, column: this.column, offset: this.cursor };
  }

  private advance(): string {
    const ch = this.input[this.cursor];
    this.cursor++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private peek(offset: number = 0): string {
    const idx = this.cursor + offset;
    return idx < this.length ? this.input[idx] : '';
  }

  private skipWhitespace() {
    while (this.cursor < this.length) {
      const ch = this.input[this.cursor];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private readComment(): Token | null {
    const startLoc = this.getLocation();
    this.advance(); // -
    this.advance(); // -

    // Check if multiline comment --[[ ]] or --[==[ ]==]
    if (this.peek() === '[') {
      let eqCount = 0;
      let p = 1;
      while (this.peek(p) === '=') {
        eqCount++;
        p++;
      }
      if (this.peek(p) === '[') {
        // Multi-line comment
        for (let i = 0; i <= p; i++) this.advance();
        const closePattern = ']' + '='.repeat(eqCount) + ']';
        let rawContent = '';
        while (this.cursor < this.length) {
          if (this.input.startsWith(closePattern, this.cursor)) {
            for (let i = 0; i < closePattern.length; i++) this.advance();
            break;
          }
          rawContent += this.advance();
        }
        return {
          type: 'COMMENT',
          value: rawContent,
          raw: '--[' + '='.repeat(eqCount) + '[' + rawContent + closePattern,
          loc: { start: startLoc, end: this.getLocation() }
        };
      }
    }

    // Single line comment
    let content = '';
    while (this.cursor < this.length && this.peek() !== '\n') {
      content += this.advance();
    }
    return {
      type: 'COMMENT',
      value: content.trim(),
      raw: '--' + content,
      loc: { start: startLoc, end: this.getLocation() }
    };
  }

  private readShortString(quote: string): Token {
    const startLoc = this.getLocation();
    this.advance(); // Opening quote
    let value = '';
    let raw = quote;

    while (this.cursor < this.length) {
      const ch = this.peek();
      if (ch === quote) {
        raw += this.advance();
        break;
      }
      if (ch === '\\') {
        raw += this.advance();
        if (this.cursor >= this.length) break;
        const esc = this.advance();
        raw += esc;
        if (esc === 'n') value += '\n';
        else if (esc === 'r') value += '\r';
        else if (esc === 't') value += '\t';
        else if (esc === '\\') value += '\\';
        else if (esc === '"') value += '"';
        else if (esc === "'") value += "'";
        else if (esc === 'z') {
          // Luau \z ignores all following whitespace
          this.skipWhitespace();
        } else if (esc === 'x') {
          // \xHH
          const hex = this.input.substring(this.cursor, this.cursor + 2);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            this.advance();
            this.advance();
            raw += hex;
            value += String.fromCharCode(parseInt(hex, 16));
          } else {
            value += '\\x';
          }
        } else if (esc === 'u') {
          // \u{HHHH}
          if (this.peek() === '{') {
            this.advance();
            let hexStr = '';
            while (this.cursor < this.length && this.peek() !== '}') {
              hexStr += this.advance();
            }
            if (this.peek() === '}') this.advance();
            const codePoint = parseInt(hexStr, 16);
            if (!isNaN(codePoint)) {
              value += String.fromCodePoint(codePoint);
            }
          }
        } else if (this.isDigit(esc)) {
          // \ddd decimal
          let numStr = esc;
          for (let i = 0; i < 2 && this.isDigit(this.peek()); i++) {
            numStr += this.advance();
          }
          raw += numStr.slice(1);
          value += String.fromCharCode(parseInt(numStr, 10));
        } else {
          value += esc;
        }
      } else {
        value += this.advance();
        raw += ch;
      }
    }

    return {
      type: 'STRING',
      value,
      raw,
      loc: { start: startLoc, end: this.getLocation() }
    };
  }

  private tryReadLongString(): Token | null {
    const startLoc = this.getLocation();
    if (this.peek() !== '[') return null;

    let eqCount = 0;
    let p = 1;
    while (this.peek(p) === '=') {
      eqCount++;
      p++;
    }
    if (this.peek(p) !== '[') return null;

    for (let i = 0; i <= p; i++) this.advance();
    const closePattern = ']' + '='.repeat(eqCount) + ']';
    let value = '';

    // If first char after [[ is newline, Luau discards it
    if (this.peek() === '\n') {
      this.advance();
    }

    while (this.cursor < this.length) {
      if (this.input.startsWith(closePattern, this.cursor)) {
        for (let i = 0; i < closePattern.length; i++) this.advance();
        break;
      }
      value += this.advance();
    }

    return {
      type: 'STRING',
      value,
      raw: '[' + '='.repeat(eqCount) + '[' + value + closePattern,
      loc: { start: startLoc, end: this.getLocation() }
    };
  }

  private readNumber(): Token {
    const startLoc = this.getLocation();
    let raw = '';

    // Check Hex / Binary / Octal
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      raw += this.advance(); // 0
      raw += this.advance(); // x
      while (this.cursor < this.length && /[0-9a-fA-F_]/.test(this.peek())) {
        const c = this.advance();
        if (c !== '_') raw += c;
      }
      const cleanHex = raw.slice(2).replace(/_/g, '');
      const numVal = parseInt(cleanHex, 16) || 0;
      return {
        type: 'NUMBER',
        value: numVal.toString(),
        raw,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    if (this.peek() === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
      raw += this.advance(); // 0
      raw += this.advance(); // b
      while (this.cursor < this.length && /[01_]/.test(this.peek())) {
        const c = this.advance();
        if (c !== '_') raw += c;
      }
      const cleanBin = raw.slice(2).replace(/_/g, '');
      const numVal = parseInt(cleanBin, 2) || 0;
      return {
        type: 'NUMBER',
        value: numVal.toString(),
        raw,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    // Decimal float / int
    let hasDot = false;
    let hasExp = false;

    while (this.cursor < this.length) {
      const ch = this.peek();
      if (this.isDigit(ch) || ch === '_') {
        raw += this.advance();
      } else if (ch === '.' && !hasDot && !hasExp && this.peek(1) !== '.') {
        hasDot = true;
        raw += this.advance();
      } else if ((ch === 'e' || ch === 'E') && !hasExp) {
        hasExp = true;
        raw += this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          raw += this.advance();
        }
      } else {
        break;
      }
    }

    const cleanDec = raw.replace(/_/g, '');
    const numVal = parseFloat(cleanDec) || 0;

    return {
      type: 'NUMBER',
      value: numVal.toString(),
      raw,
      loc: { start: startLoc, end: this.getLocation() }
    };
  }

  private readIdentifierOrKeyword(): Token {
    const startLoc = this.getLocation();
    let name = '';

    while (this.cursor < this.length && this.isIdentifierPart(this.peek())) {
      name += this.advance();
    }

    const isKw = KEYWORDS.has(name);
    return {
      type: isKw ? 'KEYWORD' : 'IDENTIFIER',
      value: name,
      raw: name,
      loc: { start: startLoc, end: this.getLocation() }
    };
  }

  private readOperatorOrPunctuation(): Token | null {
    const startLoc = this.getLocation();
    const threeChars = this.input.substring(this.cursor, this.cursor + 3);
    const twoChars = this.input.substring(this.cursor, this.cursor + 2);
    const oneChar = this.input[this.cursor];

    // Three-char ops
    if (threeChars === '...' || threeChars === '//=' || threeChars === '..=') {
      for (let i = 0; i < 3; i++) this.advance();
      return {
        type: threeChars === '...' ? 'PUNCTUATION' : 'OPERATOR',
        value: threeChars,
        raw: threeChars,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    // Two-char ops
    const twoOps = ['==', '~=', '<=', '>=', '//', '..', '::', '+=', '-=', '*=', '/=', '%=', '^=', '->'];
    if (twoOps.includes(twoChars)) {
      this.advance();
      this.advance();
      return {
        type: twoChars === '::' || twoChars === '->' ? 'PUNCTUATION' : 'OPERATOR',
        value: twoChars,
        raw: twoChars,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    // Single-char
    const singlePunc = ['(', ')', '{', '}', '[', ']', ';', ':', ',', '.'];
    const singleOps = ['+', '-', '*', '/', '%', '^', '#', '<', '>', '='];

    if (singlePunc.includes(oneChar)) {
      this.advance();
      return {
        type: 'PUNCTUATION',
        value: oneChar,
        raw: oneChar,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    if (singleOps.includes(oneChar)) {
      this.advance();
      return {
        type: 'OPERATOR',
        value: oneChar,
        raw: oneChar,
        loc: { start: startLoc, end: this.getLocation() }
      };
    }

    return null;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentifierStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentifierPart(ch: string): boolean {
    return this.isIdentifierStart(ch) || this.isDigit(ch);
  }
}
