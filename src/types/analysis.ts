import { ASTNode, SourceSpan, StatementNode, ExpressionNode } from './ast';

export type ConfidenceLevel = 'CERTAIN' | 'LIKELY' | 'POSSIBLE' | 'UNKNOWN';

export type OpcodeSemantic =
  | 'LOAD'
  | 'MOVE'
  | 'LOAD_CONSTANT'
  | 'LOAD_NIL'
  | 'LOAD_BOOL'
  | 'GET_GLOBAL'
  | 'SET_GLOBAL'
  | 'GET_TABLE'
  | 'SET_TABLE'
  | 'CALL'
  | 'RETURN'
  | 'JUMP'
  | 'CONDITIONAL_JUMP'
  | 'NEW_TABLE'
  | 'CONCAT'
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'IDIV'
  | 'MOD'
  | 'POW'
  | 'BAND'
  | 'BOR'
  | 'BXOR'
  | 'BNOT'
  | 'SHL'
  | 'SHR'
  | 'EQ'
  | 'LT'
  | 'LE'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'CLOSURE'
  | 'VARARG'
  | 'FOR_LOOP'
  | 'GENERIC_FOR'
  | 'SELF'
  | 'CLOSE'
  | 'UNKNOWN';

export interface BasicBlock {
  id: number;
  label: string;
  statements: StatementNode[];
  predecessors: number[];
  successors: number[];
  isEntry: boolean;
  isExit: boolean;
  isDispatchHead?: boolean;
  isHandlerBlock?: boolean;
  stateValue?: number | string;
  loc?: SourceSpan;
}

export interface CFGEdge {
  from: number;
  to: number;
  type: 'unconditional' | 'true-branch' | 'false-branch' | 'dispatch' | 'back-edge' | 'fallthrough';
  condition?: string;
}

export interface ControlFlowGraph {
  blocks: BasicBlock[];
  edges: CFGEdge[];
  entryBlockId: number;
  exitBlockIds: number[];
  cyclomaticComplexity: number;
  loopCount: number;
  deadBlockCount: number;
}

export interface DefUseChain {
  variable: string;
  definedAt: { blockId: number; statementIndex: number; line: number };
  usedAt: { blockId: number; statementIndex: number; line: number }[];
  isStateVariableCandidate: boolean;
  assignmentCount: number;
  readCount: number;
}

export interface DataFlowGraph {
  chains: DefUseChain[];
  stateVariableCandidates: string[];
  constantValues: Record<string, number | string | boolean>;
}

export interface StateTransition {
  fromState: number | string;
  toState: number | string;
  condition?: string;
  isConditional: boolean;
  blockId: number;
  line?: number;
}

export interface StateMachineInfo {
  stateVariableName: string | null;
  initialState: number | string | null;
  states: (number | string)[];
  transitions: StateTransition[];
  unreachableStates: (number | string)[];
  equivalentStates: { stateA: number | string; stateB: number | string; reason: string }[];
  stateCycles: (number | string)[][];
  dispatcherType: 'WHILE_IF_TREE' | 'WHILE_SWITCH' | 'TABLE_DISPATCHER' | 'COMPUTED_GOTO' | 'LINEAR_FALLTHROUGH' | 'UNKNOWN';
  dispatcherLocation?: { line: number };
}

export interface OpaquePredicate {
  expression: string;
  evaluatedTruth: boolean;
  reason: string;
  line: number;
  loc?: SourceSpan;
}

export interface StringPoolEntry {
  raw: string;
  cleanValue: string;
  entropy: number;
  alphabet: 'BASE64' | 'HEX' | 'ASCII_PRINTABLE' | 'BINARY_BLOB' | 'MIXED_ALPHANUM' | 'CUSTOM';
  characterDistribution: Record<string, number>;
  referencedBy: string[];
  decodedPlaintext?: string;
  decodingMethod?: 'XOR' | 'BYTE_SHIFT' | 'CUSTOM_TABLE' | 'BASE64_VARIANT' | 'STRING_SUB_EXTRACTION' | 'NONE';
  isSuspectedEncrypted: boolean;
}

export interface TableStructure {
  name: string;
  type: 'OPCODE_TABLE' | 'HANDLER_TABLE' | 'CONSTANT_POOL' | 'STRING_POOL' | 'REGISTER_TABLE' | 'STACK_TABLE' | 'ENVIRONMENT_TABLE' | 'METADATA_TABLE';
  elementCount: number;
  sampleKeys: (string | number)[];
  purpose: string;
  confidence: ConfidenceLevel;
}

export interface VMHandler {
  handlerId: string | number;
  opcodeNumber?: number;
  opcodeHex?: string;
  semantic: OpcodeSemantic;
  confidence: ConfidenceLevel;
  description: string;
  operands: { name: string; type: 'REG' | 'CONST' | 'JUMP_OFFSET' | 'UPVALUE' | 'VARARG'; meaning: string }[];
  associatedStatements: string[];
  targetRegisters: string[];
  readRegisters: string[];
  readConstants: string[];
  isControlFlow: boolean;
}

export interface ReconstructedInstruction {
  index: number;
  pc: number;
  rawHex?: string;
  opcodeName: string;
  semantic: OpcodeSemantic;
  confidence: ConfidenceLevel;
  operands: string[];
  pseudoCode: string;
  robloxApiCall?: string;
  comment?: string;
}

export interface RobloxAPICall {
  category: 'SERVICE' | 'REMOTE' | 'INSTANCE' | 'PLAYER' | 'PHYSICS' | 'TWEEN' | 'DATA_STORE' | 'UNKNOWN';
  apiName: string;
  methodName?: string;
  argumentSummary?: string;
  line?: number;
  potentialRisk: 'BENIGN' | 'SUSPICIOUS' | 'CRITICAL_REMOTE_SPAM' | 'SECURITY_RISK';
  description: string;
}

export interface VMArchitecture {
  vmType: 'REGISTER_BASED' | 'STACK_BASED' | 'HYBRID' | 'TREE_DISPATCHED';
  instructionWidthBits?: number;
  programCounterVar?: string;
  registerArrayVar?: string;
  stackArrayVar?: string;
  constantPoolVar?: string;
  stringPoolVar?: string;
  environmentVar?: string;
  handlerTableVar?: string;
  dispatcherLoopLine?: number;
  isVirtualized: boolean;
  virtualizationEngine?: 'IRONBREW_VARIANT' | 'PSU_VARIANT' | 'LURAPH_VARIANT' | 'MOONSEC_VARIANT' | 'CUSTOM_LUAU_VM';
}

export interface PipelineAnalysisResult {
  originalSource: string;
  normalizedSource: string;
  simplifiedSource: string;
  ast: ASTNode;
  tokensCount: number;
  linesCount: number;
  cfg: ControlFlowGraph;
  dfg: DataFlowGraph;
  stateMachine: StateMachineInfo;
  opaquePredicates: OpaquePredicate[];
  constantPool: (string | number | boolean)[];
  stringPool: StringPoolEntry[];
  tables: TableStructure[];
  vmArchitecture: VMArchitecture;
  handlers: VMHandler[];
  instructions: ReconstructedInstruction[];
  pseudoLuau: string;
  decompiledLuau: string;
  robloxCalls: RobloxAPICall[];
  report: AnalysisReport;
  timestamp: string;
}

export interface AnalysisReport {
  summary: string;
  obfuscationScore: number; // 0 - 100
  deobfuscationConfidence: ConfidenceLevel;
  totalOpaquePredicatesRemoved: number;
  totalConstantsPropagated: number;
  totalStringsDecoded: number;
  totalHandlersMapped: number;
  totalInstructionsReconstructed: number;
  robloxSecurityAlerts: string[];
  findings: { category: string; title: string; detail: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' }[];
}
