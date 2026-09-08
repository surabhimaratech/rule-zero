import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorldNodeData } from "../types";

export default function WorldNode({
  data,
}: NodeProps & { data: WorldNodeData }) {
  const isRoot = data.nodeType === "rule";

  return (
    <div className={`world-node ${isRoot ? "world-node-root" : ""}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="world-handle"
      />

      <div className="world-node-domain">{data.domain}</div>

      <div className="world-node-title">{data.title}</div>

      <Handle
        type="source"
        position={Position.Right}
        className="world-handle"
      />
    </div>
  );
}