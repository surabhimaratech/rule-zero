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