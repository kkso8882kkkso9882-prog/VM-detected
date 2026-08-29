export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'COMMENT'
  | 'EOF';

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
}

export interface Token {
  type: TokenType;
  value: string;
  raw: string;
  loc: SourceSpan;
}

// AST Nodes for Luau

export type ASTNode =
  | ProgramNode
  | StatementNode
  | ExpressionNode
  | TableFieldNode
  | VarNode;

export interface ProgramNode {
  type: 'Program';
  body: StatementNode[];
  loc: SourceSpan;
}

export type StatementNode =
  | LocalAssignmentNode
  | AssignmentNode
  | IfStatementNode
  | WhileStatementNode
  | RepeatStatementNode
  | ForNumericNode
  | ForGenericNode
  | FunctionDeclarationNode
  | LocalFunctionDeclarationNode
  | ReturnStatementNode
  | BreakStatementNode
  | ContinueStatementNode
  | CallStatementNode
  | DoBlockNode
  | CompoundAssignmentNode;

export interface LocalAssignmentNode {
  type: 'LocalAssignment';
  names: IdentifierNode[];
  values: ExpressionNode[];
  loc: SourceSpan;
}

export interface AssignmentNode {
  type: 'Assignment';
  targets: (IdentifierNode | MemberExpressionNode | IndexExpressionNode)[];
  values: ExpressionNode[];
  loc: SourceSpan;
}

export interface CompoundAssignmentNode {
  type: 'CompoundAssignment';
  operator: '+=' | '-=' | '*=' | '/=' | '//=' | '%=' | '^=' | '..=';
  target: IdentifierNode | MemberExpressionNode | IndexExpressionNode;
  value: ExpressionNode;
  loc: SourceSpan;
}

export interface IfStatementNode {
  type: 'IfStatement';
  condition: ExpressionNode;
  consequent: StatementNode[];
  elseifs: { condition: ExpressionNode; body: StatementNode[]; loc: SourceSpan }[];
  alternate: StatementNode[] | null;
  loc: SourceSpan;
}

export interface WhileStatementNode {
  type: 'WhileStatement';
  condition: ExpressionNode;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface RepeatStatementNode {
  type: 'RepeatStatement';
  condition: ExpressionNode;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface ForNumericNode {
  type: 'ForNumeric';
  variable: IdentifierNode;
  start: ExpressionNode;
  end: ExpressionNode;
  step: ExpressionNode | null;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface ForGenericNode {
  type: 'ForGeneric';
  variables: IdentifierNode[];
  iterators: ExpressionNode[];
  body: StatementNode[];
  loc: SourceSpan;
}

export interface FunctionDeclarationNode {
  type: 'FunctionDeclaration';
  name: IdentifierNode | MemberExpressionNode;
  params: IdentifierNode[];
  isVararg: boolean;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface LocalFunctionDeclarationNode {
  type: 'LocalFunctionDeclaration';
  name: IdentifierNode;
  params: IdentifierNode[];
  isVararg: boolean;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface ReturnStatementNode {
  type: 'ReturnStatement';
  values: ExpressionNode[];
  loc: SourceSpan;
}

export interface BreakStatementNode {
  type: 'BreakStatement';
  loc: SourceSpan;
}

export interface ContinueStatementNode {
  type: 'ContinueStatement';
  loc: SourceSpan;
}

export interface CallStatementNode {
  type: 'CallStatement';
  expression: CallExpressionNode;
  loc: SourceSpan;
}

export interface DoBlockNode {
  type: 'DoBlock';
  body: StatementNode[];
  loc: SourceSpan;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | UnaryExpressionNode
  | MemberExpressionNode
  | IndexExpressionNode
  | CallExpressionNode
  | MethodCallExpressionNode
  | TableConstructorNode
  | FunctionExpressionNode
  | IdentifierNode
  | LiteralNumberNode
  | LiteralStringNode
  | LiteralBooleanNode
  | LiteralNilNode
  | VarargNode;

export type VarNode = IdentifierNode | MemberExpressionNode | IndexExpressionNode;

export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
  loc: SourceSpan;
}

export interface UnaryExpressionNode {
  type: 'UnaryExpression';
  operator: string;
  argument: ExpressionNode;
  loc: SourceSpan;
}

export interface MemberExpressionNode {
  type: 'MemberExpression';
  base: ExpressionNode;
  identifier: IdentifierNode;
  loc: SourceSpan;
}

export interface IndexExpressionNode {
  type: 'IndexExpression';
  base: ExpressionNode;
  index: ExpressionNode;
  loc: SourceSpan;
}

export interface CallExpressionNode {
  type: 'CallExpression';
  base: ExpressionNode;
  args: ExpressionNode[];
  loc: SourceSpan;
}

export interface MethodCallExpressionNode {
  type: 'MethodCallExpression';
  base: ExpressionNode;
  method: IdentifierNode;
  args: ExpressionNode[];
  loc: SourceSpan;
}

export interface TableFieldNode {
  type: 'TableField';
  key: ExpressionNode | null; // null for array items
  value: ExpressionNode;
  loc: SourceSpan;
}

export interface TableConstructorNode {
  type: 'TableConstructor';
  fields: TableFieldNode[];
  loc: SourceSpan;
}

export interface FunctionExpressionNode {
  type: 'FunctionExpression';
  params: IdentifierNode[];
  isVararg: boolean;
  body: StatementNode[];
  loc: SourceSpan;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
  loc: SourceSpan;
}

export interface LiteralNumberNode {
  type: 'LiteralNumber';
  value: number;
  raw: string;
  radix?: 10 | 16 | 2 | 8;
  loc: SourceSpan;
}

export interface LiteralStringNode {
  type: 'LiteralString';
  value: string;
  raw: string;
  isLongString?: boolean;
  loc: SourceSpan;
}

export interface LiteralBooleanNode {
  type: 'LiteralBoolean';
  value: boolean;
  loc: SourceSpan;
}

export interface LiteralNilNode {
  type: 'LiteralNil';
  loc: SourceSpan;
}

export interface VarargNode {
  type: 'Vararg';
  loc: SourceSpan;
}
