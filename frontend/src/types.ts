export type WorldNodeData = {
  title: string;
  description: string;
  domain: string;
  nodeType: "rule" | "consequence";
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