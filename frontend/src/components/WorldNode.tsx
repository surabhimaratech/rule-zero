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

  function runAction(event: React.MouseEvent, action: () => void) {
    event.stopPropagation();
    action();
  }

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

      {selected && data.actions && (
        <div className="node-quick-actions nodrag nopan" onClick={(event) => event.stopPropagation()}>
          <div className="node-quick-actions-primary">
            <button
              onClick={(event) => runAction(event, data.actions!.onTrace)}
              disabled={!data.actions.canRewrite}
              title="Trace why this happened (T)"
            >
              Trace why
            </button>
            <button
              className="continue-action"
              onClick={(event) => runAction(event, data.actions!.onContinue)}
              disabled={!data.actions.canExpand || data.actions.isBusy}
              title="Continue this branch (E)"
            >
              Continue <kbd>E</kbd>
            </button>
            <button
              onClick={(event) => runAction(event, data.actions!.onRewrite)}
              disabled={!data.actions.canRewrite}
              title="Rewrite this outcome (W)"
            >
              Rewrite <kbd>W</kbd>
            </button>
          </div>

          {data.actions.showInquiry && data.actions.canExpand && (
            <div className="node-inquiry-menu">
              <span>FOLLOW THIS CONSEQUENCE</span>
              <button onClick={(event) => runAction(event, () => data.actions!.onExpand("breaks"))}>
                What breaks?
              </button>
              <button onClick={(event) => runAction(event, () => data.actions!.onExpand("benefits"))}>
                Who benefits?
              </button>
              <button onClick={(event) => runAction(event, () => data.actions!.onExpand("adapts"))}>
                How does society adapt?
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
