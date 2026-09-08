import { useCallback, useEffect, useState } from "react";
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
  OutcomeAlternative,
  WorldNodeData,
} from "../types";
import WorldNode from "./WorldNode";
import NodeDetails from "./NodeDetails";

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

const NODE_WIDTH = 180;
const NODE_HEIGHT = 180;

function layoutGraph(
  nodes: Node<WorldNodeData>[],
  edges: Edge[]
): Node<WorldNodeData>[] {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: "LR",
    ranksep: 140,
    nodesep: 70,
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

export default function WorldGraph() {
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

  const loadGraph = useCallback(async (): Promise<LoadedGraph> => {
    const response = await fetch(
      "http://localhost:8080/api/world/graph"
    );

    if (!response.ok) {
      throw new Error("Failed to load world graph");
    }

    const data: GraphApiResponse = await response.json();

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
        label: edge.relationship,
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
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadGraph().catch((err) => {
      console.error(err);
      setError("Could not load the current world.");
    });
  }, [loadGraph]);

  async function createWorld() {
    const trimmedRule = rule.trim();

    if (!trimmedRule || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(
        "http://localhost:8080/api/world/create",
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

      await loadGraph();

      setSelectedNode(null);
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

  async function explainNode(
    nodeId: string
  ): Promise<string> {
    const response = await fetch(
      `http://localhost:8080/api/world/nodes/${nodeId}/why`
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
      `http://localhost:8080/api/world/nodes/${nodeId}/explanation`
    );

    if (!response.ok) {
      throw new Error("Failed to load explanation");
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
        `http://localhost:8080/api/world/nodes/${nodeId}/expand`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to expand node");
      }

      await loadGraph();
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
        `http://localhost:8080/api/world/nodes/${nodeId}/change`,
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
        throw new Error("Failed to change outcome");
      }

      const refreshed = await loadGraph();

      const updatedNode =
        refreshed.nodes.find(
          (node) => node.id === nodeId
        ) ?? null;

      setSelectedNode(updatedNode);
    } catch (err) {
      console.error(err);
      setError("Could not change this outcome.");
      throw err;
    }
  }

  async function loadOutcomeAlternatives(
    nodeId: string
  ): Promise<OutcomeAlternative[]> {
    const response = await fetch(
      `http://localhost:8080/api/world/nodes/${nodeId}/alternatives`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error("Failed to generate alternatives");
    }

    const data: { alternatives: OutcomeAlternative[] } =
      await response.json();

    return data.alternatives;
  }

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(
        node as Node<WorldNodeData>
      );
    },
    []
  );

  const selectedNodeHasChildren =
    selectedNode !== null &&
    edges.some(
      (edge) => edge.source === selectedNode.id
    );

  return (
    <>
      <div className="rule-input-container">
        <input
          value={rule}
          onChange={(event) =>
            setRule(event.target.value)
          }
          placeholder="Define a rule of this world..."
          disabled={isCreating}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void createWorld();
            }
          }}
        />

        <button
          onClick={() => void createWorld()}
          disabled={
            isCreating || !rule.trim()
          }
        >
          {isCreating
            ? "Simulating..."
            : "Simulate"}
        </button>
      </div>

      {error && (
        <div className="world-error">
          {error}
        </div>
      )}

      <div className="world-layout">
        <div className="graph-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background gap={28} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && (
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
            onChangeOutcome={changeOutcome}
            onLoadAlternatives={loadOutcomeAlternatives}
            isExpanding={isExpanding}
            hasChildren={
              selectedNodeHasChildren
            }
          />
        )}
      </div>
    </>
  );
}