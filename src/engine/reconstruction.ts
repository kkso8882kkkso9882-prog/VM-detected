import { ProgramNode, StatementNode, ExpressionNode } from '../types/ast';
import { StateMachineInfo, VMHandler, ReconstructedInstruction, RobloxAPICall, StringPoolEntry } from '../types/analysis';

export class LuauReconstructor {
  public generateNormalizedSource(ast: ProgramNode): string {
    return this.renderStatements(ast.body, 0);
  }

  public generatePseudoLuau(
    instructions: ReconstructedInstruction[],
    stateMachine: StateMachineInfo,
    handlers: VMHandler[]
  ): string {
    const lines: string[] = [];

    lines.push('-- =======================================================');
    lines.push('-- ROBLOX LUAU VM INTERMEDIATE REPRESENTATION (PSEUDO-LUAU)');
    lines.push(`-- Dispatcher Type: ${stateMachine.dispatcherType}`);
    lines.push(`-- State Variable: ${stateMachine.stateVariableName || 'N/A'}`);
    lines.push(`-- Handlers Mapped: ${handlers.length}`);
    lines.push('-- =======================================================\n');

    lines.push('function __luau_vm_entry(...)');
    lines.push('  local R = {} -- Virtual Register Bank');
    lines.push('  local Stack = {} -- Virtual Stack Frame');
    lines.push('  local PC = 0 -- Program Counter\n');

    if (stateMachine.states.length > 0) {
      lines.push('  -- State Machine Control Flow');
      for (const t of stateMachine.transitions) {
        const cond = t.isConditional ? ` [IF ${t.condition}]` : '';
        lines.push(`  State_${t.fromState} --> State_${t.toState}${cond}`);
      }
      lines.push('');
    }

    lines.push('  -- Reconstructed Virtual Bytecode Stream');
    for (const inst of instructions) {
      const hex = inst.rawHex ? `[${inst.rawHex}] ` : '';
      const conf = inst.confidence !== 'CERTAIN' ? ` -- (${inst.confidence})` : '';
      lines.push(`  ${inst.pc.toString().padStart(4, '0')}: ${hex}${inst.pseudoCode}${conf}`);
    }

    lines.push('\n  return R[0]');
    lines.push('end');

    return lines.join('\n');
  }

  public generateDecompiledLuau(
    ast: ProgramNode,
    stateMachine: StateMachineInfo,
    stringPool: StringPoolEntry[],
    robloxCalls: RobloxAPICall[],
    instructions: ReconstructedInstruction[]
  ): string {
    const lines: string[] = [];

    lines.push('-- Decompiled and Reconstructed Luau Script');
    lines.push('-- Static Deobfuscation Engine Analysis\n');

    // 1. Recovered Roblox Service headers
    const services = new Set<string>();
    for (const call of robloxCalls) {
      if (call.category === 'SERVICE' && call.argumentSummary) {
        const cleanName = call.argumentSummary.replace(/["']/g, '');
        services.add(cleanName);
      }
    }

    if (services.size > 0) {
      lines.push('-- Recovered Roblox Services');
      for (const s of services) {
        lines.push(`local ${s} = game:GetService("${s}")`);
      }
      lines.push('');
    }

    // 2. Decoded String Pool mapping
    const decodedStrings = stringPool.filter(s => s.decodedPlaintext && s.decodedPlaintext !== s.cleanValue);
    if (decodedStrings.length > 0) {
      lines.push('-- Statically Decrypted String Pool');
      for (let i = 0; i < decodedStrings.length; i++) {
        const entry = decodedStrings[i];
        lines.push(`local _STR_${i + 1} = ${JSON.stringify(entry.decodedPlaintext)} -- Method: ${entry.decodingMethod}`);
      }
      lines.push('');
    }

    // 3. High-level reconstructed logic
    lines.push('-- Reconstructed High-Level Logic');

    if (robloxCalls.some(c => c.category === 'PLAYER')) {
      lines.push('local Players = game:GetService("Players")');
      lines.push('local LocalPlayer = Players.LocalPlayer');
      lines.push('local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()');
      lines.push('local Humanoid = Character:WaitForChild("Humanoid")\n');
    }

    // Reconstruct calls or expressions
    let hasBody = false;
    for (const call of robloxCalls) {
      if (call.category === 'REMOTE') {
        lines.push(`-- Network Remote Invocations`);
        lines.push(`${call.apiName}`);
        hasBody = true;
      }
    }

    if (!hasBody) {
      // Reconstruct from state machine or AST
      if (ast.body.length > 0) {
        lines.push(this.renderStatements(ast.body, 0));
      } else {
        lines.push('-- VM logic cleanly disassembled into instructions:');
        for (const inst of instructions) {
          lines.push(`${inst.pseudoCode}`);
        }
      }
    }

    return lines.join('\n');
  }

  public renderStatements(stmts: StatementNode[], indent: number): string {
    const space = '  '.repeat(indent);
    const lines: string[] = [];

    for (const stmt of stmts) {
      switch (stmt.type) {
        case 'LocalAssignment': {
          const names = stmt.names.map(n => n.name).join(', ');
          const values = stmt.values.map(v => this.renderExpression(v)).join(', ');
          lines.push(`${space}local ${names}${values ? ' = ' + values : ''}`);
          break;
        }
        case 'Assignment': {
          const targets = stmt.targets.map(t => this.renderExpression(t)).join(', ');
          const values = stmt.values.map(v => this.renderExpression(v)).join(', ');
          lines.push(`${space}${targets} = ${values}`);
          break;
        }
        case 'CompoundAssignment': {
          lines.push(`${space}${this.renderExpression(stmt.target)} ${stmt.operator} ${this.renderExpression(stmt.value)}`);
          break;
        }
        case 'IfStatement': {
          lines.push(`${space}if ${this.renderExpression(stmt.condition)} then`);
          lines.push(this.renderStatements(stmt.consequent, indent + 1));
          for (const elseif of stmt.elseifs) {
            lines.push(`${space}elseif ${this.renderExpression(elseif.condition)} then`);
            lines.push(this.renderStatements(elseif.body, indent + 1));
          }
          if (stmt.alternate && stmt.alternate.length > 0) {
            lines.push(`${space}else`);
            lines.push(this.renderStatements(stmt.alternate, indent + 1));
          }
          lines.push(`${space}end`);
          break;
        }
        case 'WhileStatement': {
          lines.push(`${space}while ${this.renderExpression(stmt.condition)} do`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
        case 'RepeatStatement': {
          lines.push(`${space}repeat`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}until ${this.renderExpression(stmt.condition)}`);
          break;
        }
        case 'ForNumeric': {
          const stepStr = stmt.step ? `, ${this.renderExpression(stmt.step)}` : '';
          lines.push(`${space}for ${stmt.variable.name} = ${this.renderExpression(stmt.start)}, ${this.renderExpression(stmt.end)}${stepStr} do`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
        case 'ForGeneric': {
          const vars = stmt.variables.map(v => v.name).join(', ');
          const iters = stmt.iterators.map(it => this.renderExpression(it)).join(', ');
          lines.push(`${space}for ${vars} in ${iters} do`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
        case 'FunctionDeclaration': {
          const name = this.renderExpression(stmt.name);
          const params = stmt.params.map(p => p.name).join(', ');
          lines.push(`${space}function ${name}(${params}${stmt.isVararg ? (params ? ', ...' : '...') : ''})`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
        case 'LocalFunctionDeclaration': {
          const params = stmt.params.map(p => p.name).join(', ');
          lines.push(`${space}local function ${stmt.name.name}(${params}${stmt.isVararg ? (params ? ', ...' : '...') : ''})`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
        case 'ReturnStatement': {
          const vals = stmt.values.map(v => this.renderExpression(v)).join(', ');
          lines.push(`${space}return ${vals}`);
          break;
        }
        case 'BreakStatement': {
          lines.push(`${space}break`);
          break;
        }
        case 'ContinueStatement': {
          lines.push(`${space}continue`);
          break;
        }
        case 'CallStatement': {
          lines.push(`${space}${this.renderExpression(stmt.expression)}`);
          break;
        }
        case 'DoBlock': {
          lines.push(`${space}do`);
          lines.push(this.renderStatements(stmt.body, indent + 1));
          lines.push(`${space}end`);
          break;
        }
      }
    }

    return lines.join('\n');
  }

  public renderExpression(expr: ExpressionNode): string {
    if (!expr) return '';
    switch (expr.type) {
      case 'Identifier': return expr.name;
      case 'LiteralNumber': return expr.raw || expr.value.toString();
      case 'LiteralString': return expr.raw || `"${expr.value}"`;
      case 'LiteralBoolean': return expr.value ? 'true' : 'false';
      case 'LiteralNil': return 'nil';
      case 'Vararg': return '...';
      case 'BinaryExpression': return `${this.renderExpression(expr.left)} ${expr.operator} ${this.renderExpression(expr.right)}`;
      case 'UnaryExpression': return `${expr.operator}${expr.operator === 'not' ? ' ' : ''}${this.renderExpression(expr.argument)}`;
      case 'MemberExpression': return `${this.renderExpression(expr.base)}.${expr.identifier.name}`;
      case 'IndexExpression': return `${this.renderExpression(expr.base)}[${this.renderExpression(expr.index)}]`;
      case 'CallExpression': return `${this.renderExpression(expr.base)}(${expr.args.map(a => this.renderExpression(a)).join(', ')})`;
      case 'MethodCallExpression': return `${this.renderExpression(expr.base)}:${expr.method.name}(${expr.args.map(a => this.renderExpression(a)).join(', ')})`;
      case 'TableConstructor': {
        if (expr.fields.length === 0) return '{}';
        const fieldsStr = expr.fields.map(f => {
          if (f.key) {
            const kStr = f.key.type === 'Identifier' ? f.key.name : `[${this.renderExpression(f.key)}]`;
            return `${kStr} = ${this.renderExpression(f.value)}`;
          }
          return this.renderExpression(f.value);
        }).join(', ');
        return `{ ${fieldsStr} }`;
      }
      case 'FunctionExpression': {
        const params = expr.params.map(p => p.name).join(', ');
        return `function(${params}${expr.isVararg ? (params ? ', ...' : '...') : ''}) ... end`;
      }
      default: return '...';
    }
  }
}
