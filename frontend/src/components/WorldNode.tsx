import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorldNodeData } from "../types";

export default function WorldNode({
  data,
  selected,
}: NodeProps & { data: WorldNodeData }) {
  const isRoot = data.nodeType === "rule";
  const isFrontier = data.explorationState === "frontier";
  const isEstablished = data.explorationState === "established";
  const domainClass = data.domain.toLowerCase().replaceAll(" ", "-");

  return (
    <div
      className={`world-node ${
        isRoot ? "world-node-root" : ""
      } ${isFrontier ? "world-node-frontier" : ""} ${
        isEstablished ? "world-node-established" : ""
      } ${selected ? "world-node-selected" : ""}`}
      data-domain={domainClass}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="world-handle"
      />

      <div className="world-node-domain">{data.domain}</div>

      <div className="world-node-title">{data.title}</div>

      {!isRoot && (
        <div className="world-node-signal">
          {isFrontier && <span>UNEXPLORED</span>}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="world-handle"
      />
    </div>
  );
}
