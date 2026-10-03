import {
  startTransition,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Background,
  Controls,
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

  const loadGraph = useCallback(
    async (
      requestedWorldId: string
    ): Promise<LoadedGraph> => {
      const response = await fetch(
        `http://localhost:8080/api/worlds/${requestedWorldId}/graph`
      );

      if (!response.ok) {
        throw new Error("Failed to load world graph");
      }

      const data: GraphApiResponse =
        await response.json();

      const reactFlowNodes: Node<WorldNodeData>[] =
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
        }));

      const laidOutNodes = layoutGraph(
        reactFlowNodes,
        reactFlowEdges
      );

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
      setShowFaultLines(true);
      return;
    }

    setIsAnalyzingFaultLines(true);
    setFaultLineError(null);
    setSelectedNode(null);

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

      if (worldId) {
        await loadGraph(worldId);
      }

      /*
       * World changed, so previous world-level analysis
       * is now potentially stale.
       */
      setFaultLines([]);
      setShowFaultLines(false);
      setSelectedNode(null);
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

      const refreshed =
        await loadGraph(worldId!);

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

  if (selectedNode) {
    selectedPathIds.add(selectedNode.id);

    let currentId = selectedNode.id;

    let parentEdge = edges.find(
      (edge) => edge.target === currentId
    );

    while (parentEdge) {
      selectedPathIds.add(parentEdge.source);

      currentId = parentEdge.source;

      parentEdge = edges.find(
        (edge) => edge.target === currentId
      );
    }
  }

  const displayedNodes = nodes.map(
    (node) => ({
      ...node,
      className:
        selectedNode &&
        !selectedPathIds.has(node.id)
          ? "graph-node-dimmed"
          : selectedNode
            ? "graph-node-on-path"
            : undefined,
    })
  );

  const displayedEdges = edges.map(
    (edge) => ({
      ...edge,
      className:
        selectedNode &&
        selectedPathIds.has(edge.source) &&
        selectedPathIds.has(edge.target)
          ? "graph-edge-on-path"
          : selectedNode
            ? "graph-edge-dimmed"
            : undefined,
    })
  );

  const currentWorld = worldId !== null;

  return (
    <>
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
        </div>
      </div>

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
          {currentWorld && (
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
            onClose={() =>
              setSelectedNode(null)
            }
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
            isExpanding={isExpanding}
            hasChildren={
              selectedNodeHasChildren
            }
          />
        )}

        {showFaultLines && (
          <FaultLinePanel
            faultLines={faultLines}
            onClose={() =>
              setShowFaultLines(false)
            }
          />
        )}
      </div>
    </>
  );
}