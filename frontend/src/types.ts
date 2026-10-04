export type InquiryDirection = "breaks" | "benefits" | "adapts";

export type WorldNodeActions = {
  canExpand: boolean;
  canRewrite: boolean;
  isBusy: boolean;
  showInquiry: boolean;
  onTrace: () => void;
  onContinue: () => void;
  onRewrite: () => void;
  onExpand: (direction: InquiryDirection) => void;
};

export type WorldNodeData = {
  title: string;
  description: string;
  domain: string;
  nodeType: "rule" | "consequence";
  explorationState?: "origin" | "established" | "frontier";
  actions?: WorldNodeActions;
};

export type OutcomeAlternative = {
  title: string;
  description: string;
  domain: string;
};

export type WorldSummary = {
  id: string;
  name: string;
  rootRule: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  forkedFromWorldId: string | null;
  forkedAt: string | null;
};

export type ComparisonNode = {
  title: string;
  description: string;
  domain: string;
  nodeType: "rule" | "consequence";
  parentTitle: string | null;
};

export type ChangedNode = {
  worldA: ComparisonNode;
  worldB: ComparisonNode;
};

export type WorldComparison = {
  worldA: Pick<WorldSummary, "id" | "name" | "rootRule">;
  worldB: Pick<WorldSummary, "id" | "name" | "rootRule">;
  summary: {
    unchanged: number;
    changed: number;
    onlyInA: number;
    onlyInB: number;
  };
  unchangedNodes: ComparisonNode[];
  changedNodes: ChangedNode[];
  onlyInA: ComparisonNode[];
  onlyInB: ComparisonNode[];
};

export type FaultLineFaction = {
  name: string;
  belief: string;
  goal: string;
  fear: string;
  supportingNodeIds: string[];
};

export type FaultLine = {
  title: string;
  tension: string;
  factionA: FaultLineFaction;
  factionB: FaultLineFaction;
  flashpoint: string;
};

export type FaultLineResponse = {
  faultLines: FaultLine[];
};

export type EverydayObject = {
  name: string;
  description: string;
  before: string;
  now: string;
  whyItChanged: string;
  supportingNodeIds: string[];
};

export type EverydayObjectsResponse = {
  objects: EverydayObject[];
};
