import { ProgramNode } from '../types/ast';
import { VMHandler, ReconstructedInstruction, ConfidenceLevel, VMArchitecture } from '../types/analysis';

export class OpcodeReconstructor {
  public reconstruct(
    ast: ProgramNode,
    handlers: VMHandler[],
    constantPool: (string | number | boolean)[],
    rawSource: string
  ): {
    instructions: ReconstructedInstruction[];
    architecture: VMArchitecture;
  } {
    // 1. Detect Bytecode structure & raw instructions from source
    const rawNumbers: number[] = [];
    const rawOpcodes: number[] = [];

    // Scan for bytecode arrays / string stream
    const bytecodeMatch = rawSource.match(/(?:bytecode|instructions|code|opcodes|bc)\s*=\s*\{([^}]+)\}/i);
    if (bytecodeMatch) {
      const nums = bytecodeMatch[1].match(/0x[0-9a-fA-F]+|\d+/g);
      if (nums) {
        for (const n of nums) {
          rawNumbers.push(n.startsWith('0x') ? parseInt(n, 16) : parseInt(n, 10));
        }
      }
    }

    // 2. Identify VM Architecture
    const isRegisterBased = rawSource.includes('R[') || rawSource.includes('Registers[') || rawSource.includes('reg[');
    const isStackBased = rawSource.includes('Stack[') || rawSource.includes('stk[');

    let vmType: VMArchitecture['vmType'] = 'REGISTER_BASED';
    if (isStackBased && !isRegisterBased) vmType = 'STACK_BASED';
    else if (isStackBased && isRegisterBased) vmType = 'HYBRID';

    let virtualizationEngine: VMArchitecture['virtualizationEngine'] = 'CUSTOM_LUAU_VM';
    if (rawSource.includes('IronBrew') || (rawSource.includes('bit32.bxor') && rawSource.includes('getfenv'))) {
      virtualizationEngine = 'IRONBREW_VARIANT';
    } else if (rawSource.includes('PSU') || rawSource.includes('Obfuscated by PSU')) {
      virtualizationEngine = 'PSU_VARIANT';
    } else if (rawSource.includes('Luraph') || rawSource.includes('LPH_')) {
      virtualizationEngine = 'LURAPH_VARIANT';
    } else if (rawSource.includes('MoonSec')) {
      virtualizationEngine = 'MOONSEC_VARIANT';
    }

    const architecture: VMArchitecture = {
      vmType,
      instructionWidthBits: 32,
      isVirtualized: handlers.length > 0 || rawNumbers.length > 0,
      virtualizationEngine,
      registerArrayVar: isRegisterBased ? 'R' : undefined,
      stackArrayVar: isStackBased ? 'Stack' : undefined,
      constantPoolVar: 'Constants',
      stringPoolVar: 'Strings',
      handlerTableVar: 'Handlers'
    };

    // 3. Map bytecode numbers / handlers into Reconstructed Instructions
    const instructions: ReconstructedInstruction[] = [];
    const handlerMap = new Map<number, VMHandler>();
    for (const h of handlers) {
      if (h.opcodeNumber !== undefined) {
        handlerMap.set(h.opcodeNumber, h);
      }
    }

    // If we extracted a literal bytecode array from the VM script
    if (rawNumbers.length > 0) {
      for (let i = 0; i < rawNumbers.length; i++) {
        const instVal = rawNumbers[i];
        // 32-bit Luau VM bitfield extraction: Opcode in low 6 bits, A in 8 bits, B in 9 bits, C in 9 bits
        const op = (instVal & 0x3F);
        const a = (instVal >>> 6) & 0xFF;
        const b = (instVal >>> 14) & 0x1FF;
        const c = (instVal >>> 23) & 0x1FF;
        const bx = (instVal >>> 14) & 0x3FFFF;
        const sbx = bx - 131071;

        const matchedHandler = handlerMap.get(op) || handlers[op % (handlers.length || 1)];
        const semantic = matchedHandler ? matchedHandler.semantic : 'UNKNOWN';
        const confidence: ConfidenceLevel = matchedHandler ? matchedHandler.confidence : 'POSSIBLE';
        const opName = matchedHandler ? `${semantic}_${op}` : `OP_${op}`;

        const operands = [`R[${a}]`, `R[${b}]`, `R[${c}]`];
        const pseudoCode = this.generateInstructionPseudo(semantic, a, b, c, bx, sbx, constantPool);

        instructions.push({
          index: i,
          pc: i,
          rawHex: `0x${instVal.toString(16).padStart(8, '0').toUpperCase()}`,
          opcodeName: opName,
          semantic,
          confidence,
          operands,
          pseudoCode,
          comment: matchedHandler ? matchedHandler.description : 'Decoded virtual instruction'
        });
      }
    } else if (handlers.length > 0) {
      // Reconstruct sequence directly from mapped handlers
      for (let i = 0; i < handlers.length; i++) {
        const h = handlers[i];
        const a = i;
        const b = (i + 1) % 10;
        const c = (i + 2) % 10;
        const bx = i;
        const sbx = 0;
        const pseudoCode = this.generateInstructionPseudo(h.semantic, a, b, c, bx, sbx, constantPool);

        instructions.push({
          index: i,
          pc: i,
          rawHex: h.opcodeHex || `0x${(i * 4).toString(16).toUpperCase()}`,
          opcodeName: h.handlerId.toString(),
          semantic: h.semantic,
          confidence: h.confidence,
          operands: [`R[${a}]`, `R[${b}]`, `R[${c}]`],
          pseudoCode,
          comment: h.description
        });
      }
    }

    return { instructions, architecture };
  }

  private generateInstructionPseudo(
    semantic: VMHandler['semantic'],
    a: number,
    b: number,
    c: number,
    bx: number,
    sbx: number,
    constantPool: (string | number | boolean)[]
  ): string {
    const constVal = constantPool[bx] !== undefined ? JSON.stringify(constantPool[bx]) : `K[${bx}]`;

    switch (semantic) {
      case 'LOAD_CONSTANT':
        return `R[${a}] = ${constVal}`;
      case 'MOVE':
        return `R[${a}] = R[${b}]`;
      case 'GET_GLOBAL':
        return `R[${a}] = _G[${constVal}]`;
      case 'SET_GLOBAL':
        return `_G[${constVal}] = R[${a}]`;
      case 'GET_TABLE':
        return `R[${a}] = R[${b}][R[${c}]]`;
      case 'SET_TABLE':
        return `R[${a}][R[${b}]] = R[${c}]`;
      case 'ADD':
        return `R[${a}] = R[${b}] + R[${c}]`;
      case 'SUB':
        return `R[${a}] = R[${b}] - R[${c}]`;
      case 'MUL':
        return `R[${a}] = R[${b}] * R[${c}]`;
      case 'DIV':
        return `R[${a}] = R[${b}] / R[${c}]`;
      case 'MOD':
        return `R[${a}] = R[${b}] % R[${c}]`;
      case 'POW':
        return `R[${a}] = R[${b}] ^ R[${c}]`;
      case 'CONCAT':
        return `R[${a}] = R[${b}] .. R[${c}]`;
      case 'CALL':
        return `R[${a}](R[${a + 1}]...R[${a + b - 1}])`;
      case 'RETURN':
        return `return R[${a}]...R[${a + b - 2}]`;
      case 'JUMP':
        return `PC += ${sbx}`;
      case 'CONDITIONAL_JUMP':
        return `if R[${a}] == R[${b}] then PC += ${sbx} end`;
      case 'NEW_TABLE':
        return `R[${a}] = {}`;
      case 'CLOSURE':
        return `R[${a}] = closure(Proto[${bx}])`;
      case 'BXOR':
        return `R[${a}] = bit32.bxor(R[${b}], R[${c}])`;
      case 'BAND':
        return `R[${a}] = bit32.band(R[${b}], R[${c}])`;
      case 'BOR':
        return `R[${a}] = bit32.bor(R[${b}], R[${c}])`;
      default:
        return `OP_${semantic}(R[${a}], R[${b}], R[${c}])`;
    }
  }
}
