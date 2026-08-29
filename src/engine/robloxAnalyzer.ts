import { ProgramNode, StatementNode, ExpressionNode, CallExpressionNode, MethodCallExpressionNode } from '../types/ast';
import { RobloxAPICall } from '../types/analysis';

export class RobloxAnalyzer {
  public analyze(ast: ProgramNode, rawSource: string, decodedStrings: string[]): RobloxAPICall[] {
    const calls: RobloxAPICall[] = [];
    const seen = new Set<string>();

    // 1. Scan AST nodes for Roblox calls
    this.scanASTForRoblox(ast.body, calls, seen);

    // 2. Scan decoded strings & raw source for Roblox keywords that might have been encrypted
    this.scanDecodedKeywords(decodedStrings, calls, seen);
    this.scanRawKeywords(rawSource, calls, seen);

    return calls;
  }

  private scanASTForRoblox(
    stmts: StatementNode[],
    calls: RobloxAPICall[],
    seen: Set<string>
  ) {
    for (const stmt of stmts) {
      if (stmt.type === 'CallStatement') {
        this.checkExpressionForRoblox(stmt.expression, stmt.loc.start.line, calls, seen);
      } else if (stmt.type === 'Assignment') {
        for (const v of stmt.values) {
          this.checkExpressionForRoblox(v, stmt.loc.start.line, calls, seen);
        }
      } else if (stmt.type === 'LocalAssignment') {
        for (const v of stmt.values) {
          this.checkExpressionForRoblox(v, stmt.loc.start.line, calls, seen);
        }
      } else if (stmt.type === 'IfStatement') {
        this.checkExpressionForRoblox(stmt.condition, stmt.loc.start.line, calls, seen);
        this.scanASTForRoblox(stmt.consequent, calls, seen);
        for (const e of stmt.elseifs) {
          this.checkExpressionForRoblox(e.condition, e.loc.start.line, calls, seen);
          this.scanASTForRoblox(e.body, calls, seen);
        }
        if (stmt.alternate) this.scanASTForRoblox(stmt.alternate, calls, seen);
      } else if (stmt.type === 'WhileStatement') {
        this.scanASTForRoblox(stmt.body, calls, seen);
      } else if (stmt.type === 'DoBlock') {
        this.scanASTForRoblox(stmt.body, calls, seen);
      }
    }
  }

  private checkExpressionForRoblox(
    expr: ExpressionNode,
    line: number,
    calls: RobloxAPICall[],
    seen: Set<string>
  ) {
    if (!expr) return;

    // Method calls: game:GetService("Players"), Remote:FireServer(...), etc.
    if (expr.type === 'MethodCallExpression') {
      const methodName = expr.method.name;
      const baseStr = this.exprToString(expr.base);

      if (methodName === 'GetService' || methodName === 'FindService') {
        const argStr = expr.args.length > 0 ? this.exprToString(expr.args[0]) : '';
        const callKey = `GetService_${argStr}_${line}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            category: 'SERVICE',
            apiName: `game:${methodName}(${argStr})`,
            methodName,
            argumentSummary: argStr,
            line,
            potentialRisk: 'BENIGN',
            description: `Retrieves Roblox singleton service ${argStr}`
          });
        }
      } else if (methodName === 'FireServer' || methodName === 'Fire') {
        const argStr = expr.args.map(a => this.exprToString(a)).join(', ');
        const callKey = `FireServer_${baseStr}_${line}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            category: 'REMOTE',
            apiName: `${baseStr}:${methodName}(${argStr})`,
            methodName,
            argumentSummary: argStr,
            line,
            potentialRisk: 'CRITICAL_REMOTE_SPAM',
            description: `Transmits network packet to Roblox game server via RemoteEvent`
          });
        }
      } else if (methodName === 'InvokeServer' || methodName === 'Invoke') {
        const argStr = expr.args.map(a => this.exprToString(a)).join(', ');
        const callKey = `InvokeServer_${baseStr}_${line}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            category: 'REMOTE',
            apiName: `${baseStr}:${methodName}(${argStr})`,
            methodName,
            argumentSummary: argStr,
            line,
            potentialRisk: 'SUSPICIOUS',
            description: `Synchronously requests data from server via RemoteFunction`
          });
        }
      } else if (methodName === 'Destroy' || methodName === 'Clone' || methodName === 'ClearAllChildren') {
        const callKey = `${methodName}_${baseStr}_${line}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            category: 'INSTANCE',
            apiName: `${baseStr}:${methodName}()`,
            methodName,
            line,
            potentialRisk: 'BENIGN',
            description: `Manipulates Roblox DataModel instance hierarchy`
          });
        }
      }
    }

    // Call Expression: Instance.new("Part"), CFrame.new(...), Vector3.new(...)
    if (expr.type === 'CallExpression' && expr.base.type === 'MemberExpression') {
      const baseObj = expr.base.base;
      const method = expr.base.identifier.name;

      if (baseObj.type === 'Identifier') {
        const objName = baseObj.name;
        if (objName === 'Instance' && method === 'new') {
          const argStr = expr.args.map(a => this.exprToString(a)).join(', ');
          const key = `Instance_new_${argStr}_${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            calls.push({
              category: 'INSTANCE',
              apiName: `Instance.new(${argStr})`,
              methodName: 'new',
              argumentSummary: argStr,
              line,
              potentialRisk: 'BENIGN',
              description: `Instantiates Roblox engine object of type ${argStr}`
            });
          }
        } else if ((objName === 'Vector3' || objName === 'CFrame' || objName === 'Color3') && method === 'new') {
          const argStr = expr.args.map(a => this.exprToString(a)).join(', ');
          const key = `${objName}_new_${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            calls.push({
              category: 'PHYSICS',
              apiName: `${objName}.new(${argStr})`,
              methodName: 'new',
              argumentSummary: argStr,
              line,
              potentialRisk: 'BENIGN',
              description: `Constructs 3D spatial/math vector or coordinate frame`
            });
          }
        }
      }
    }

    // Member expressions: game.Players.LocalPlayer, workspace.CurrentCamera
    if (expr.type === 'MemberExpression') {
      const field = expr.identifier.name;
      if (field === 'LocalPlayer') {
        const key = `LocalPlayer_${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({
            category: 'PLAYER',
            apiName: `Players.LocalPlayer`,
            line,
            potentialRisk: 'SUSPICIOUS',
            description: `Accesses client Player instance (frequent target for character injection)`
          });
        }
      } else if (field === 'Humanoid' || field === 'Character') {
        const key = `${field}_${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({
            category: 'PLAYER',
            apiName: `Player.${field}`,
            line,
            potentialRisk: 'SUSPICIOUS',
            description: `Interacts with player character avatar and physics controller`
          });
        }
      }
    }
  }

  private scanDecodedKeywords(decodedStrings: string[], calls: RobloxAPICall[], seen: Set<string>) {
    const robloxKeywords: { word: string; category: RobloxAPICall['category']; desc: string; risk: RobloxAPICall['potentialRisk'] }[] = [
      { word: 'Players', category: 'SERVICE', desc: 'Roblox Players Service', risk: 'BENIGN' },
      { word: 'ReplicatedStorage', category: 'SERVICE', desc: 'Shared network storage container', risk: 'BENIGN' },
      { word: 'HttpService', category: 'SERVICE', desc: 'Outbound HTTP communication engine', risk: 'SECURITY_RISK' },
      { word: 'TeleportService', category: 'SERVICE', desc: 'Cross-place teleportation pipeline', risk: 'SUSPICIOUS' },
      { word: 'RunService', category: 'SERVICE', desc: 'Heartbeat & RenderStepped loop coordinator', risk: 'BENIGN' },
      { word: 'UserInputService', category: 'SERVICE', desc: 'Keyboard & Mouse input hook listener', risk: 'BENIGN' },
      { word: 'FireServer', category: 'REMOTE', desc: 'Obfuscated RemoteEvent server trigger', risk: 'CRITICAL_REMOTE_SPAM' },
      { word: 'InvokeServer', category: 'REMOTE', desc: 'Obfuscated RemoteFunction invocation', risk: 'SUSPICIOUS' },
      { word: 'LocalPlayer', category: 'PLAYER', desc: 'Local player instance pointer', risk: 'SUSPICIOUS' },
      { word: 'HumanoidRootPart', category: 'PHYSICS', desc: 'Character root CFrame coordinate point', risk: 'SUSPICIOUS' },
    ];

    for (const str of decodedStrings) {
      for (const kw of robloxKeywords) {
        if (str.includes(kw.word)) {
          const key = `Decoded_${kw.word}`;
          if (!seen.has(key)) {
            seen.add(key);
            calls.push({
              category: kw.category,
              apiName: `[Decoded String Pool] "${str}"`,
              potentialRisk: kw.risk,
              description: `Recovered plaintext reference: ${kw.desc}`
            });
          }
        }
      }
    }
  }

  private scanRawKeywords(rawSource: string, calls: RobloxAPICall[], seen: Set<string>) {
    const patterns = [
      { regex: /game:GetService\(["'](\w+)["']\)/g, cat: 'SERVICE' as const, risk: 'BENIGN' as const },
      { regex: /(\w+):FireServer\(([^)]*)\)/g, cat: 'REMOTE' as const, risk: 'CRITICAL_REMOTE_SPAM' as const },
      { regex: /(\w+):InvokeServer\(([^)]*)\)/g, cat: 'REMOTE' as const, risk: 'SUSPICIOUS' as const },
      { regex: /Instance\.new\(["'](\w+)["']\)/g, cat: 'INSTANCE' as const, risk: 'BENIGN' as const },
      { regex: /workspace\.(\w+)/g, cat: 'INSTANCE' as const, risk: 'BENIGN' as const },
    ];

    for (const p of patterns) {
      let match: RegExpExecArray | null;
      while ((match = p.regex.exec(rawSource)) !== null) {
        const full = match[0];
        const key = `Raw_${full}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({
            category: p.cat,
            apiName: full,
            potentialRisk: p.risk,
            description: `Direct Roblox API call detected in source text`
          });
        }
      }
    }
  }

  private exprToString(expr: ExpressionNode): string {
    if (!expr) return '';
    if (expr.type === 'Identifier') return expr.name;
    if (expr.type === 'LiteralString') return `"${expr.value}"`;
    if (expr.type === 'LiteralNumber') return expr.raw || expr.value.toString();
    if (expr.type === 'MemberExpression') return `${this.exprToString(expr.base)}.${expr.identifier.name}`;
    if (expr.type === 'IndexExpression') return `${this.exprToString(expr.base)}[${this.exprToString(expr.index)}]`;
    return '...';
  }
}
