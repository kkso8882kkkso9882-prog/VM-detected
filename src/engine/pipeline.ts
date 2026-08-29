import { LuauLexer } from './lexer';
import { LuauParser } from './parser';
import { CFGBuilder } from './cfg';
import { DFGBuilder } from './dfg';
import { SymbolicSimplifier } from './symbolic';
import { StateMachineAnalyzer } from './stateMachine';
import { TableStructureAnalyzer } from './tableAnalyzer';
import { StringPoolAnalyzer } from './stringPool';
import { HandlerClassifier } from './handlerClassifier';
import { OpcodeReconstructor } from './opcodeReconstructor';
import { RobloxAnalyzer } from './robloxAnalyzer';
import { LuauReconstructor } from './reconstruction';
import { PipelineAnalysisResult, AnalysisReport, ConfidenceLevel } from '../types/analysis';

export class LuauAnalysisPipeline {
  private lexer!: LuauLexer;
  private parser!: LuauParser;
  private cfgBuilder = new CFGBuilder();
  private dfgBuilder = new DFGBuilder();
  private simplifier = new SymbolicSimplifier();
  private stateMachineAnalyzer = new StateMachineAnalyzer();
  private tableAnalyzer = new TableStructureAnalyzer();
  private stringPoolAnalyzer = new StringPoolAnalyzer();
  private handlerClassifier = new HandlerClassifier();
  private opcodeReconstructor = new OpcodeReconstructor();
  private robloxAnalyzer = new RobloxAnalyzer();
  private reconstructor = new LuauReconstructor();

  public run(source: string): PipelineAnalysisResult {
    const linesCount = source.split('\n').length;

    // 1. Lexing
    this.lexer = new LuauLexer(source);
    const tokens = this.lexer.tokenize();
    const tokensCount = tokens.length;

    // 2. Parsing into AST
    this.parser = new LuauParser(tokens);
    const ast = this.parser.parse();

    // 3. Control Flow Graph
    const cfg = this.cfgBuilder.build(ast);

    // 4. Data Flow Graph
    const dfg = this.dfgBuilder.build(ast, cfg);

    // 5. Symbolic Simplification & Opaque Predicate detection
    const { simplifiedAst, opaquePredicates, propagatedCount } = this.simplifier.simplify(ast);

    // 6. State Machine Analysis
    const stateMachine = this.stateMachineAnalyzer.analyze(ast, dfg);

    // 7. Table Structures & Function Roles
    const { tables } = this.tableAnalyzer.analyze(ast);

    // 8. String Pool & Entropy Analysis
    const stringPool = this.stringPoolAnalyzer.analyze(ast, source);

    // 9. VM Handler Detection & Semantic Classification
    const handlers = this.handlerClassifier.classify(ast);

    // 10. Constant Pool Extraction
    const constantPool: (string | number | boolean)[] = [];
    for (const k in dfg.constantValues) {
      constantPool.push(dfg.constantValues[k]);
    }
    for (const str of stringPool) {
      if (!constantPool.includes(str.cleanValue)) {
        constantPool.push(str.cleanValue);
      }
    }

    // 11. Opcode & Bytecode Reconstruction
    const { instructions, architecture } = this.opcodeReconstructor.reconstruct(
      ast,
      handlers,
      constantPool,
      source
    );

    // 12. Roblox-Specific API & Remote Telemetry
    const decodedStrings = stringPool.map(s => s.decodedPlaintext || s.cleanValue);
    const robloxCalls = this.robloxAnalyzer.analyze(ast, source, decodedStrings);

    // 13. Pseudo-Luau & Decompiled Luau Reconstruction
    const normalizedSource = this.reconstructor.generateNormalizedSource(ast);
    const simplifiedSource = this.reconstructor.generateNormalizedSource(simplifiedAst);
    const pseudoLuau = this.reconstructor.generatePseudoLuau(instructions, stateMachine, handlers);
    const decompiledLuau = this.reconstructor.generateDecompiledLuau(
      simplifiedAst,
      stateMachine,
      stringPool,
      robloxCalls,
      instructions
    );

    // 14. Report Generation & Metrics
    const report = this.generateReport(
      source,
      tokensCount,
      cfg,
      dfg,
      stateMachine,
      opaquePredicates,
      propagatedCount,
      stringPool,
      handlers,
      instructions,
      robloxCalls,
      architecture
    );

    return {
      originalSource: source,
      normalizedSource,
      simplifiedSource,
      ast,
      tokensCount,
      linesCount,
      cfg,
      dfg,
      stateMachine,
      opaquePredicates,
      constantPool,
      stringPool,
      tables,
      vmArchitecture: architecture,
      handlers,
      instructions,
      pseudoLuau,
      decompiledLuau,
      robloxCalls,
      report,
      timestamp: new Date().toISOString()
    };
  }

  private generateReport(
    source: string,
    tokensCount: number,
    cfg: any,
    dfg: any,
    stateMachine: any,
    opaquePredicates: any[],
    propagatedCount: number,
    stringPool: any[],
    handlers: any[],
    instructions: any[],
    robloxCalls: any[],
    architecture: any
  ): AnalysisReport {
    // Obfuscation Score (0 to 100)
    let score = 0;
    if (stateMachine.states.length > 3) score += 25;
    if (handlers.length > 2) score += 25;
    if (stringPool.some((s: any) => s.isSuspectedEncrypted)) score += 20;
    if (opaquePredicates.length > 0) score += 15;
    if (cfg.cyclomaticComplexity > 15) score += 15;
    score = Math.min(100, Math.max(5, score));

    // Deobfuscation Confidence
    let deobfuscationConfidence: ConfidenceLevel = 'POSSIBLE';
    if (handlers.length > 0 && stateMachine.states.length > 0) {
      const certainCount = handlers.filter((h: any) => h.confidence === 'CERTAIN').length;
      if (certainCount / handlers.length >= 0.7) {
        deobfuscationConfidence = 'CERTAIN';
      } else {
        deobfuscationConfidence = 'LIKELY';
      }
    } else if (instructions.length > 0) {
      deobfuscationConfidence = 'LIKELY';
    }

    const robloxSecurityAlerts: string[] = [];
    const findings: AnalysisReport['findings'] = [];

    // Roblox Alerts
    const remoteSpam = robloxCalls.filter((c: any) => c.potentialRisk === 'CRITICAL_REMOTE_SPAM');
    if (remoteSpam.length > 0) {
      robloxSecurityAlerts.push(`Critical: Found ${remoteSpam.length} RemoteEvent :FireServer() call(s) inside virtualized payload.`);
      findings.push({
        category: 'ROBLOX_NETWORK',
        title: 'RemoteEvent Network Transmission Detected',
        detail: `The script performs network calls via RemoteEvents (${remoteSpam.map(r => r.apiName).slice(0, 3).join(', ')}).`,
        severity: 'HIGH'
      });
    }

    const playerAccess = robloxCalls.filter((c: any) => c.category === 'PLAYER');
    if (playerAccess.length > 0) {
      robloxSecurityAlerts.push(`Alert: Direct access to LocalPlayer / Character / Humanoid detected.`);
      findings.push({
        category: 'ROBLOX_PLAYER',
        title: 'Player Character Avatar Hooking',
        detail: `Virtual machine accesses client Player / Character properties.`,
        severity: 'MEDIUM'
      });
    }

    if (opaquePredicates.length > 0) {
      findings.push({
        category: 'CONTROL_FLOW_FLATTENING',
        title: 'Opaque Predicates Eliminated',
        detail: `Statically eliminated ${opaquePredicates.length} opaque predicates (e.g. identity comparisons, dead branches).`,
        severity: 'LOW'
      });
    }

    if (stateMachine.stateCycles.length > 0) {
      findings.push({
        category: 'VIRTUALIZATION',
        title: 'State Machine Dispatch Cycles',
        detail: `Detected ${stateMachine.stateCycles.length} cyclic state transitions in dispatcher loop.`,
        severity: 'MEDIUM'
      });
    }

    const decodedCount = stringPool.filter((s: any) => s.decodedPlaintext && s.decodedPlaintext !== s.cleanValue).length;

    return {
      summary: `Static analysis completed for ${source.length} byte Luau script. Identified ${architecture.vmType} VM architecture (${architecture.virtualizationEngine}) with ${handlers.length} semantic opcode handlers and ${stateMachine.states.length} dispatcher states.`,
      obfuscationScore: score,
      deobfuscationConfidence,
      totalOpaquePredicatesRemoved: opaquePredicates.length,
      totalConstantsPropagated: propagatedCount,
      totalStringsDecoded: decodedCount,
      totalHandlersMapped: handlers.length,
      totalInstructionsReconstructed: instructions.length,
      robloxSecurityAlerts,
      findings
    };
  }
}
