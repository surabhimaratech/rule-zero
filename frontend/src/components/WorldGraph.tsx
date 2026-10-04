import {
  startTransition,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";

import type {
  FaultLine,
  FaultLineResponse,
  OutcomeAlternative,
  WorldNodeData,
} from "../types";

import WorldNode from "./WorldNode";
import NodeDetails from "./NodeDetails";
import FaultLinePanel from "./FaultLinePanel";

const nodeTypes = {
  worldNode: WorldNode,
};

type GraphApiResponse = {
  nodes: {
    id: string;
    title: string;
    description: string;
    domain: string;
    nodeType: "rule" | "consequence";
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    relationship: string;
  }[];
};

type LoadedGraph = {
  nodes: Node<WorldNodeData>[];
  edges: Edge[];
};

function shortenRelationship(value: string, maxLength = 56) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

type Props = {
  worldId: string | null;
  onWorldCreated: (worldId: string) => void;
};

const NODE_WIDTH = 210;
const NODE_HEIGHT = 210;

function layoutGraph(
  nodes: Node<WorldNodeData>[],
  edges: Edge[]
): Node<WorldNodeData>[] {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: "LR",
    ranksep: 180,
    nodesep: 96,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);

    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export default function WorldGraph({
  worldId,
  onWorldCreated,
}: Props) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<WorldNodeData>>([]);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] =
    useState<Node<WorldNodeData> | null>(null);

  const [rule, setRule] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [faultLines, setFaultLines] =
    useState<FaultLine[]>([]);

  const [isAnalyzingFaultLines, setIsAnalyzingFaultLines] =
    useState(false);

  const [showFaultLines, setShowFaultLines] =
    useState(false);

  const [faultLineError, setFaultLineError] =
    useState<string | null>(null);

  const [selectedFaultLineIndex, setSelectedFaultLineIndex] =
    useState<number | null>(null);

  const [newNodeIds, setNewNodeIds] =
    useState<Set<string>>(new Set());
  const [rewrittenNodeId, setRewrittenNodeId] =
    useState<string | null>(null);
  const [rewritePreviewNodeId, setRewritePreviewNodeId] =
    useState<string | null>(null);
  const [isPremiseComposerOpen, setIsPremiseComposerOpen] =
    useState(false);
  const [isFaultLineDetailsOpen, setIsFaultLineDetailsOpen] =
    useState(false);

  const loadGraph = useCallback(
    async (
      requestedWorldId: string,
      previousNodes: Node<WorldNodeData>[] = []
    ): Promise<LoadedGraph> => {
      const response = await fetch(
        `http://localhost:8080/api/worlds/${requestedWorldId}/graph`
      );

      if (!response.ok) {
        throw new Error("Failed to load world graph");
      }

      const data: GraphApiResponse =
        await response.json();

      let reactFlowNodes: Node<WorldNodeData>[] =
        data.nodes.map((node) => ({
          id: node.id,
          type: "worldNode",
          position: { x: 0, y: 0 },
          data: {
            title: node.title,
            description: node.description,
            domain: node.domain,
            nodeType: node.nodeType,
          },
        }));

      const reactFlowEdges: Edge[] =
        data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
          },
          data: { relationship: edge.relationship },
        }));

      const nodesWithChildren = new Set(
        reactFlowEdges.map((edge) => edge.source)
      );

      reactFlowNodes = reactFlowNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          explorationState: node.data.nodeType === "rule"
            ? "origin"
            : nodesWithChildren.has(node.id)
              ? "established"
              : "frontier",
        },
      }));

      let laidOutNodes = layoutGraph(
        reactFlowNodes,
        reactFlowEdges
      );

      if (previousNodes.length > 0) {
        const previousPositions = new Map(
          previousNodes.map((node) => [node.id, node.position])
        );

        laidOutNodes = laidOutNodes.map((node) => ({
          ...node,
          position: previousPositions.get(node.id) ?? node.position,
        }));
      }

      setNodes(laidOutNodes);
      setEdges(reactFlowEdges);

      return {
        nodes: laidOutNodes,
        edges: reactFlowEdges,
      };
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    startTransition(() => {
      setSelectedNode(null);
      setShowFaultLines(false);
      setFaultLines([]);
      setFaultLineError(null);
      setSelectedFaultLineIndex(null);
      setNewNodeIds(new Set());
      setRewrittenNodeId(null);
      setRewritePreviewNodeId(null);
      setIsPremiseComposerOpen(false);
      setIsFaultLineDetailsOpen(false);
    });

    if (!worldId) {
      startTransition(() => {
        setError(null);
        setNodes([]);
        setEdges([]);
      });

      return;
    }

    loadGraph(worldId).catch((err) => {
      console.error(err);
      setError("Could not load this world.");
    });
  }, [loadGraph, setEdges, setNodes, worldId]);

  async function createWorld() {
    const trimmedRule = rule.trim();

    if (!trimmedRule || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(
        "http://localhost:8080/api/worlds",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rule: trimmedRule,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create world");
      }

      const data: { worldId: string } =
        await response.json();

      onWorldCreated(data.worldId);
      setRule("");
    } catch (err) {
      console.error(err);

      setError(
        "Something went wrong while simulating the world."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function analyzeFaultLines() {
    if (
      !worldId ||
      isAnalyzingFaultLines
    ) {
      return;
    }

    /*
     * If analysis already exists for this open world,
     * simply reopen it instead of spending another LLM call.
     */
    if (faultLines.length > 0) {
      setSelectedNode(null);
      setRewritePreviewNodeId(null);
      setSelectedFaultLineIndex(0);
      setIsFaultLineDetailsOpen(false);
      setShowFaultLines(true);
      return;
    }

    setIsAnalyzingFaultLines(true);
    setFaultLineError(null);
    setSelectedNode(null);
    setRewritePreviewNodeId(null);

    try {
      const response = await fetch(
        `http://localhost:8080/api/worlds/${worldId}/analysis/fault-lines`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to analyze world fault lines"
        );
      }

      const data: FaultLineResponse =
        await response.json();

      setFaultLines(data.faultLines);
      setSelectedFaultLineIndex(data.faultLines.length > 0 ? 0 : null);
      setIsFaultLineDetailsOpen(false);
      setShowFaultLines(true);
    } catch (err) {
      console.error(err);

      setFaultLineError(
        "Could not analyze this world's fault lines."
      );
    } finally {
      setIsAnalyzingFaultLines(false);
    }
  }

  async function explainNode(
    nodeId: string
  ): Promise<string> {
    const response = await fetch(
      `http://localhost:8080/api/worlds/${worldId}/nodes/${nodeId}/why`
    );

    if (!response.ok) {
      throw new Error("Failed to explain node");
    }

    const data: { explanation: string } =
      await response.json();

    return data.explanation;
  }

  async function loadExistingExplanation(
    nodeId: string
  ): Promise<string | null> {
    const response = await fetch(
      `http://localhost:8080/api/worlds/${worldId}/nodes/${nodeId}/explanation`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to load explanation"
      );
    }

    const data: { explanation?: string } =
      await response.json();

    return data.explanation ?? null;
  }

  async function expandNode(nodeId: string) {
    if (isExpanding) {
      return;
    }

    setIsExpanding(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:8080/api/worlds/${worldId}/nodes/${nodeId}/expand`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to expand node");
      }

      const previousIds = new Set(nodes.map((node) => node.id));
      const refreshed = worldId
        ? await loadGraph(worldId, nodes)
        : null;

      if (refreshed) {
        const arrivedIds = new Set(
          refreshed.nodes
            .filter((node) => !previousIds.has(node.id))
            .map((node) => node.id)
        );

        setNewNodeIds(arrivedIds);
        setSelectedNode(
          refreshed.nodes.find((node) => node.id === nodeId) ?? null
        );

        window.setTimeout(() => setNewNodeIds(new Set()), 12000);
      }

      /*
       * World changed, so previous world-level analysis
       * is now potentially stale.
       */
      setFaultLines([]);
      setShowFaultLines(false);
      setSelectedFaultLineIndex(null);
    } catch (err) {
      console.error(err);

      setError(
        "Could not explore what happens next."
      );
    } finally {
      setIsExpanding(false);
    }
  }

  async function changeOutcome(
    nodeId: string,
    title: string
  ) {
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:8080/api/worlds/${worldId}/nodes/${nodeId}/change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to change outcome"
        );
      }

      const previousIds = new Set(nodes.map((node) => node.id));
      const refreshed =
        await loadGraph(worldId!, nodes);

      const updatedNode =
        refreshed.nodes.find(
          (node) => node.id === nodeId
        ) ?? null;

      /*
       * Rewriting the world invalidates any previously
       * generated world-level analysis.
       */
      setFaultLines([]);
      setShowFaultLines(false);
      setSelectedFaultLineIndex(null);
      setRewritePreviewNodeId(null);
      setRewrittenNodeId(nodeId);
      setNewNodeIds(new Set(
        refreshed.nodes
          .filter((node) => !previousIds.has(node.id))
          .map((node) => node.id)
      ));

      window.setTimeout(() => {
        setRewrittenNodeId(null);
        setNewNodeIds(new Set());
      }, 12000);

      setSelectedNode(updatedNode);
    } catch (err) {
      console.error(err);

      setError(
        "Could not change this outcome."
      );

      throw err;
    }
  }

  async function loadOutcomeAlternatives(
    nodeId: string
  ): Promise<OutcomeAlternative[]> {
    const response = await fetch(
      `http://localhost:8080/api/worlds/${worldId}/nodes/${nodeId}/alternatives`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to generate alternatives"
      );
    }

    const data: {
      alternatives: OutcomeAlternative[];
    } = await response.json();

    return data.alternatives;
  }

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setShowFaultLines(false);
      setSelectedFaultLineIndex(null);
      setRewritePreviewNodeId(null);

      setSelectedNode(
        node as Node<WorldNodeData>
      );
    },
    []
  );

  const selectedNodeHasChildren =
    selectedNode !== null &&
    edges.some(
      (edge) =>
        edge.source === selectedNode.id
    );

  const selectedPathIds = new Set<string>();
  const selectedPathNodes: Node<WorldNodeData>[] = [];

  const selectedFaultLine =
    selectedFaultLineIndex === null
      ? null
      : faultLines[selectedFaultLineIndex] ?? null;

  const factionANodeIds = new Set(
    selectedFaultLine?.factionA.supportingNodeIds ?? []
  );
  const factionBNodeIds = new Set(
    selectedFaultLine?.factionB.supportingNodeIds ?? []
  );

  if (selectedNode) {
    selectedPathIds.add(selectedNode.id);
    selectedPathNodes.unshift(selectedNode);

    let currentId = selectedNode.id;

    let parentEdge = edges.find(
      (edge) => edge.target === currentId
    );

    while (parentEdge) {
      selectedPathIds.add(parentEdge.source);

      const parentNode = nodes.find(
        (node) => node.id === parentEdge?.source
      );

      if (parentNode) {
        selectedPathNodes.unshift(parentNode);
      }

      currentId = parentEdge.source;

      parentEdge = edges.find(
        (edge) => edge.target === currentId
      );
    }
  }

  const rewriteDescendantIds = new Set<string>();

  if (rewritePreviewNodeId) {
    const queue = [rewritePreviewNodeId];

    while (queue.length > 0) {
      const sourceId = queue.shift()!;

      edges
        .filter((edge) => edge.source === sourceId)
        .forEach((edge) => {
          if (!rewriteDescendantIds.has(edge.target)) {
            rewriteDescendantIds.add(edge.target);
            queue.push(edge.target);
          }
        });
    }
  }

  const displayedNodes = nodes.map(
    (node) => {
      const supportsFactionA = factionANodeIds.has(node.id);
      const supportsFactionB = factionBNodeIds.has(node.id);

      const classNames: string[] = [];

      if (selectedFaultLine) {
        classNames.push(supportsFactionA && supportsFactionB
          ? "graph-node-faction-both"
          : supportsFactionA
            ? "graph-node-faction-a"
            : supportsFactionB
              ? "graph-node-faction-b"
              : "graph-node-fault-line-dimmed");
      } else if (rewritePreviewNodeId) {
        classNames.push(
          node.id === rewritePreviewNodeId
            ? "graph-node-rewrite-source"
            : rewriteDescendantIds.has(node.id)
              ? "graph-node-will-rewrite"
              : "graph-node-rewrite-unaffected"
        );
      } else if (selectedNode) {
        classNames.push(selectedPathIds.has(node.id)
          ? "graph-node-on-path"
          : "graph-node-dimmed");
      }

      if (newNodeIds.has(node.id)) {
        classNames.push("graph-node-new");
      }

      if (rewrittenNodeId === node.id) {
        classNames.push("graph-node-rewritten");
      }

      return {
        ...node,
        className: classNames.join(" ") || undefined,
      };
    }
  );

  const displayedEdges = edges.map((edge) => {
    const isOnSelectedPath = Boolean(
      selectedNode &&
      selectedPathIds.has(edge.source) &&
      selectedPathIds.has(edge.target)
    );
    const willBeRewritten = Boolean(
      rewritePreviewNodeId &&
      (edge.source === rewritePreviewNodeId ||
        rewriteDescendantIds.has(edge.source)) &&
      rewriteDescendantIds.has(edge.target)
    );
    const relationship =
      typeof edge.data?.relationship === "string"
        ? edge.data.relationship
        : "";

    return {
      ...edge,
      className: selectedFaultLine
        ? "graph-edge-dimmed"
        : rewritePreviewNodeId
          ? willBeRewritten
            ? "graph-edge-will-rewrite"
            : "graph-edge-dimmed"
          : isOnSelectedPath
            ? "graph-edge-on-path"
            : selectedNode
              ? "graph-edge-dimmed"
              : undefined,
      label: isOnSelectedPath && relationship
        ? shortenRelationship(relationship)
        : undefined,
      labelStyle: {
        fill: "#cdd5e3",
        fontSize: 10,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: "#111620",
        fillOpacity: 0.94,
        stroke: "#394254",
        strokeWidth: 1,
      },
      labelBgPadding: [7, 5] as [number, number],
      labelBgBorderRadius: 5,
    };
  });

  const currentWorld = worldId !== null;
  const foundationalRule = nodes.find(
    (node) => node.data.nodeType === "rule"
  )?.data.title;

  return (
    <>
      {currentWorld && !isPremiseComposerOpen ? (
        <div className="world-context-bar">
          <div className="world-context-orbit" aria-hidden="true" />
          <div className="world-context-copy">
            <span>FOUNDATIONAL TRUTH</span>
            <strong>{foundationalRule ?? "Loading this reality…"}</strong>
          </div>
          <button onClick={() => setIsPremiseComposerOpen(true)}>
            Create another world
          </button>
        </div>
      ) : (
      <div className="rule-input-container">
        <div className="rule-input-copy">
          <div className="rule-input-kicker">
            FOUNDATION / 01
          </div>

          <label htmlFor="world-rule-input">
            What is true in this world?
          </label>

          <p>
            Set the first condition and watch
            its consequences unfold.
          </p>
        </div>

        <div className="rule-input-control">
          <input
            id="world-rule-input"
            value={rule}
            onChange={(event) =>
              setRule(event.target.value)
            }
            placeholder="e.g. Humans no longer need sleep"
            disabled={isCreating}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void createWorld();
              }
            }}
          />

          <button
            onClick={() =>
              void createWorld()
            }
            disabled={
              isCreating || !rule.trim()
            }
          >
            {isCreating
              ? "Simulating..."
              : "Simulate world"}
          </button>

          {currentWorld && (
            <button
              className="rule-input-cancel"
              onClick={() => {
                setRule("");
                setIsPremiseComposerOpen(false);
              }}
              disabled={isCreating}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      )}

      {error && (
        <div className="world-error">
          {error}
        </div>
      )}

      {faultLineError && (
        <div className="world-error">
          {faultLineError}
        </div>
      )}

      <div className="world-layout">
        <div className="graph-container">
          {currentWorld && !showFaultLines && (
            <div className="world-analysis-launcher">
              <span className="world-analysis-label">
                WORLD ANALYSIS
              </span>

              <button
                onClick={() =>
                  void analyzeFaultLines()
                }
                disabled={
                  isAnalyzingFaultLines
                }
              >
                {isAnalyzingFaultLines
                  ? "Analyzing..."
                  : faultLines.length > 0
                    ? "View Fault Lines"
                    : "Find Fault Lines"}
              </button>
            </div>
          )}

          {!currentWorld && (
            <div className="world-empty-state">
              <div className="empty-state-orbit" />

              <div className="eyebrow">
                NO ACTIVE UNIVERSE
              </div>

              <h2>
                Define a rule to begin.
              </h2>

              <p>
                Your first condition will
                become the source of a new
                causal world.
              </p>
            </div>
          )}

          <ReactFlow
            nodes={displayedNodes}
            edges={displayedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{
              padding: 0.18,
              minZoom: 0.45,
            }}
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background
              gap={28}
              size={1}
            />

            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && !showFaultLines && (
          <NodeDetails
            key={`${selectedNode.id}-${selectedNode.data.title}-${selectedNode.data.description}`}
            node={selectedNode}
            onClose={() => {
              setSelectedNode(null);
              setRewritePreviewNodeId(null);
            }}
            onExpand={expandNode}
            onExplain={explainNode}
            onLoadExplanation={
              loadExistingExplanation
            }
            onChangeOutcome={
              changeOutcome
            }
            onLoadAlternatives={
              loadOutcomeAlternatives
            }
            causalPath={selectedPathNodes}
            onFocusNode={(nodeId) => {
              setSelectedNode(
                nodes.find((node) => node.id === nodeId) ?? null
              );
            }}
            rewriteDescendantCount={rewriteDescendantIds.size}
            onRewritePreviewChange={(isPreviewing) => {
              setRewritePreviewNodeId(
                isPreviewing ? selectedNode.id : null
              );
            }}
            isExpanding={isExpanding}
            hasChildren={
              selectedNodeHasChildren
            }
          />
        )}

        {showFaultLines && (
          <FaultLinePanel
            faultLines={faultLines}
            selectedIndex={selectedFaultLineIndex}
            expanded={isFaultLineDetailsOpen}
            onExpandedChange={setIsFaultLineDetailsOpen}
            onSelect={(index) => {
              setSelectedNode(null);
              setSelectedFaultLineIndex(
                selectedFaultLineIndex === index ? null : index
              );
            }}
            onClose={() => {
              setSelectedFaultLineIndex(null);
              setIsFaultLineDetailsOpen(false);
              setShowFaultLines(false)
            }}
          />
        )}
      </div>
    </>
  );
}
