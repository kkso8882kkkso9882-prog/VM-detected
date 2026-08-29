import { ProgramNode, LiteralStringNode, ASTNode } from '../types/ast';
import { StringPoolEntry } from '../types/analysis';

export class StringPoolAnalyzer {
  public analyze(ast: ProgramNode, rawSource: string): StringPoolEntry[] {
    const rawStrings: { str: string; raw: string; line: number }[] = [];

    // Traverse AST to collect all literal strings
    this.collectStrings(ast, rawStrings);

    const poolEntries: StringPoolEntry[] = [];
    const seen = new Set<string>();

    for (const item of rawStrings) {
      if (seen.has(item.str)) {
        const existing = poolEntries.find(e => e.cleanValue === item.str);
        if (existing) {
          existing.referencedBy.push(`Line ${item.line}`);
        }
        continue;
      }
      seen.add(item.str);

      const entropy = this.calculateShannonEntropy(item.str);
      const alphabet = this.detectAlphabet(item.str);
      const charDist = this.computeCharDistribution(item.str);

      const isSuspectedEncrypted = (item.str.length > 12 && entropy > 3.8) ||
        (alphabet === 'BASE64' && item.str.length > 20) ||
        (alphabet === 'HEX' && item.str.length > 16) ||
        (alphabet === 'BINARY_BLOB');

      // Attempt static deobfuscation/decryption
      const { decodedPlaintext, decodingMethod } = this.attemptDecode(item.str, rawSource);

      poolEntries.push({
        raw: item.raw,
        cleanValue: item.str,
        entropy,
        alphabet,
        characterDistribution: charDist,
        referencedBy: [`Line ${item.line}`],
        decodedPlaintext,
        decodingMethod,
        isSuspectedEncrypted
      });
    }

    return poolEntries;
  }

  private collectStrings(node: ASTNode, out: { str: string; raw: string; line: number }[]) {
    if (!node) return;

    if (node.type === 'LiteralString') {
      out.push({
        str: node.value,
        raw: node.raw,
        line: node.loc.start.line
      });
      return;
    }

    // Traverse children
    for (const key in node) {
      const val = (node as any)[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          for (const child of val) this.collectStrings(child, out);
        } else if (val.type) {
          this.collectStrings(val, out);
        }
      }
    }
  }

  private calculateShannonEntropy(str: string): number {
    if (!str || str.length === 0) return 0;

    const freq: Record<string, number> = {};
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      freq[ch] = (freq[ch] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const ch in freq) {
      const p = freq[ch] / len;
      entropy -= p * Math.log2(p);
    }

    return Number(entropy.toFixed(3));
  }

  private detectAlphabet(str: string): StringPoolEntry['alphabet'] {
    if (!str || str.length === 0) return 'ASCII_PRINTABLE';

    let isHex = /^[0-9a-fA-F]+$/.test(str);
    let isBase64 = /^[A-Za-z0-9+/=_-]+$/.test(str);
    let isAsciiPrintable = true;
    let hasBinary = false;

    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        hasBinary = true;
      }
      if (code > 126) {
        isAsciiPrintable = false;
      }
    }

    if (hasBinary) return 'BINARY_BLOB';
    if (isHex && str.length > 8) return 'HEX';
    if (isBase64 && /[a-z]/.test(str) && /[A-Z]/.test(str) && /[0-9]/.test(str) && str.length > 12) {
      return 'BASE64';
    }
    if (isAsciiPrintable) return 'ASCII_PRINTABLE';
    if (/^[A-Za-z0-9]+$/.test(str)) return 'MIXED_ALPHANUM';

    return 'CUSTOM';
  }

  private computeCharDistribution(str: string): Record<string, number> {
    const dist: Record<string, number> = {};
    const sample = str.slice(0, 100);
    for (let i = 0; i < sample.length; i++) {
      const ch = sample[i];
      const display = ch.charCodeAt(0) < 32 ? `\\x${ch.charCodeAt(0).toString(16)}` : ch;
      dist[display] = (dist[display] || 0) + 1;
    }
    return dist;
  }

  private attemptDecode(
    str: string,
    rawSource: string
  ): { decodedPlaintext?: string; decodingMethod?: StringPoolEntry['decodingMethod'] } {
    if (str.length < 3) return { decodingMethod: 'NONE' };

    // 1. Check for XOR key patterns in source
    const xorMatch = rawSource.match(/bxor\s*\([^,]+,\s*(0x[0-9a-fA-F]+|\d+)\)/) ||
      rawSource.match(/bit32\.bxor\s*\([^,]+,\s*(0x[0-9a-fA-F]+|\d+)\)/) ||
      rawSource.match(/\^\s*(0x[0-9a-fA-F]+|\d+)/);

    if (xorMatch) {
      const keyStr = xorMatch[1];
      const key = keyStr.startsWith('0x') ? parseInt(keyStr, 16) : parseInt(keyStr, 10);
      if (!isNaN(key) && key > 0 && key <= 255) {
        let decoded = '';
        let validPrintableCount = 0;
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i) ^ key;
          if (c >= 32 && c <= 126) validPrintableCount++;
          decoded += String.fromCharCode(c);
        }
        if (validPrintableCount / str.length > 0.75) {
          return { decodedPlaintext: decoded, decodingMethod: 'XOR' };
        }
      }
    }

    // 2. Check for byte shift patterns (e.g. byte - 13, byte + offset)
    const shiftMatch = rawSource.match(/string\.byte\([^)]+\)\s*([+-])\s*(\d+)/);
    if (shiftMatch) {
      const sign = shiftMatch[1];
      const shift = parseInt(shiftMatch[2], 10);
      let decoded = '';
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        code = sign === '+' ? (code - shift) : (code + shift);
        decoded += String.fromCharCode((code + 256) % 256);
      }
      if (/^[a-zA-Z0-9_.,:;!?"'/\-\s]{4,}$/.test(decoded)) {
        return { decodedPlaintext: decoded, decodingMethod: 'BYTE_SHIFT' };
      }
    }

    // 3. Check for standard Base64
    if (/^[A-Za-z0-9+/=]{8,}$/.test(str)) {
      try {
        const decoded = atob(str);
        if (/^[\x20-\x7E\s]{4,}$/.test(decoded)) {
          return { decodedPlaintext: decoded, decodingMethod: 'BASE64_VARIANT' };
        }
      } catch {}
    }

    // 4. Check for Hex ascii encoding
    if (/^[0-9a-fA-F]{8,}$/.test(str) && str.length % 2 === 0) {
      let hexDecoded = '';
      for (let i = 0; i < str.length; i += 2) {
        const byte = parseInt(str.substring(i, i + 2), 16);
        hexDecoded += String.fromCharCode(byte);
      }
      if (/^[\x20-\x7E\s]{4,}$/.test(hexDecoded)) {
        return { decodedPlaintext: hexDecoded, decodingMethod: 'STRING_SUB_EXTRACTION' };
      }
    }

    return { decodingMethod: 'NONE' };
  }
}
