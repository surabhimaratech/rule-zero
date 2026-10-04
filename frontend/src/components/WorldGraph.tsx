import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
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
  type ReactFlowInstance,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";

import type {
  EverydayObject,
  FaultLine,
  FaultLineResponse,
  InquiryDirection,
  OutcomeAlternative,
  WorldNodeData,
} from "../types";

import WorldNode from "./WorldNode";
import NodeDetails from "./NodeDetails";
import FaultLinePanel from "./FaultLinePanel";
import EverydayObjectsPanel from "./EverydayObjectsPanel";

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

function frameWorldOrigin(
  instance: ReactFlowInstance<Node<WorldNodeData>, Edge>,
  graph: LoadedGraph,
  duration = 0
) {
  const root = graph.nodes.find((node) => node.data.nodeType === "rule");

  if (!root) {
    return;
  }

  const immediateIds = new Set(
    graph.edges
      .filter((edge) => edge.source === root.id)
      .map((edge) => edge.target)
  );
  const openingNodes = graph.nodes.filter(
    (node) => node.id === root.id || immediateIds.has(node.id)
  );

  void instance.fitView({
    nodes: openingNodes,
    padding: 0.24,
    minZoom: 0.7,
    maxZoom: 0.86,
    duration,
  });
}

function frameNodeNeighborhood(
  instance: ReactFlowInstance<Node<WorldNodeData>, Edge>,
  graph: LoadedGraph,
  nodeId: string
) {
  const relatedIds = new Set([nodeId]);

  graph.edges.forEach((edge) => {
    if (edge.target === nodeId) {
      relatedIds.add(edge.source);
    }

    if (edge.source === nodeId) {
      relatedIds.add(edge.target);
    }
  });

  const neighborhood = graph.nodes.filter((node) => relatedIds.has(node.id));

  void instance.fitView({
    nodes: neighborhood,
    padding: 0.34,
    minZoom: 0.72,
    maxZoom: 1,
    duration: 420,
  });
}

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

function getNodeDimensions(node: Node<WorldNodeData>) {
  return node.data.nodeType === "rule"
    ? { width: 240, height: 240 }
    : { width: 244, height: 150 };
}

function layoutGraph(
  nodes: Node<WorldNodeData>[],
  edges: Edge[]
): Node<WorldNodeData>[] {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: "LR",
    ranksep: 132,
    nodesep: 54,
    marginx: 36,
    marginy: 36,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, getNodeDimensions(node));
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    const dimensions = getNodeDimensions(node);

    return {
      ...node,
      position: {
        x: position.x - dimensions.width / 2,
        y: position.y - dimensions.height / 2,
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

  const [everydayObjects, setEverydayObjects] =
    useState<EverydayObject[]>([]);
  const [showEverydayObjects, setShowEverydayObjects] =
    useState(false);
  const [everydayObjectsError, setEverydayObjectsError] =
    useState<string | null>(null);

  const [newNodeIds, setNewNodeIds] =
    useState<Set<string>>(new Set());
  const [rewrittenNodeId, setRewrittenNodeId] =
    useState<string | null>(null);
  const [rewritePreviewNodeId, setRewritePreviewNodeId] =
    useState<string | null>(null);
  const [isFaultLineDetailsOpen, setIsFaultLineDetailsOpen] =
    useState(false);
  const [inquiryNodeId, setInquiryNodeId] =
    useState<string | null>(null);
  const [detailIntent, setDetailIntent] =
    useState<"default" | "explain" | "rewrite">("default");
  const [detailIntentNonce, setDetailIntentNonce] = useState(0);
  const [ignitionVisibleIds, setIgnitionVisibleIds] =
    useState<Set<string> | null>(null);
  const [ignitionActiveNodeId, setIgnitionActiveNodeId] =
    useState<string | null>(null);
  const [showIgnitionPrompt, setShowIgnitionPrompt] = useState(false);
  const shouldIgniteRef = useRef(false);
  const ignitionRunRef = useRef(0);
  const flowInstanceRef = useRef<ReactFlowInstance<Node<WorldNodeData>, Edge> | null>(null);
  const loadedGraphRef = useRef<LoadedGraph | null>(null);

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

      const loadedGraph = {
        nodes: laidOutNodes,
        edges: reactFlowEdges,
      };

      loadedGraphRef.current = loadedGraph;
      return loadedGraph;
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    const ignitionRun = ++ignitionRunRef.current;

    startTransition(() => {
      setSelectedNode(null);
      setShowFaultLines(false);
      setFaultLines([]);
      setFaultLineError(null);
      setSelectedFaultLineIndex(null);
      setShowEverydayObjects(false);
      setEverydayObjects([]);
      setEverydayObjectsError(null);
      setNewNodeIds(new Set());
      setRewrittenNodeId(null);
      setRewritePreviewNodeId(null);
      setIsFaultLineDetailsOpen(false);
      setInquiryNodeId(null);
      setDetailIntent("default");
      setIgnitionVisibleIds(null);
      setIgnitionActiveNodeId(null);
      setShowIgnitionPrompt(false);
    });

    if (!worldId) {
      startTransition(() => {
        setError(null);
        setNodes([]);
        setEdges([]);
      });

      return;
    }

    loadGraph(worldId)
      .then((graph) => {
        window.requestAnimationFrame(() => {
          if (flowInstanceRef.current) {
            frameWorldOrigin(flowInstanceRef.current, graph, 450);
          }
        });

        if (!shouldIgniteRef.current) {
          return;
        }

        shouldIgniteRef.current = false;

        const rootNode = graph.nodes.find(
          (node) => node.data.nodeType === "rule"
        );
        const consequences = graph.nodes.filter(
          (node) => node.data.nodeType !== "rule"
        );

        if (!rootNode || consequences.length === 0) {
          return;
        }

        const visibleIds = new Set([rootNode.id]);
        setIgnitionVisibleIds(new Set(visibleIds));
        setIgnitionActiveNodeId(rootNode.id);

        consequences.forEach((node, index) => {
          window.setTimeout(() => {
            if (ignitionRunRef.current !== ignitionRun) {
              return;
            }

            visibleIds.add(node.id);
            setIgnitionVisibleIds(new Set(visibleIds));
            setIgnitionActiveNodeId(node.id);
          }, 420 * (index + 1));
        });

        window.setTimeout(() => {
          if (ignitionRunRef.current !== ignitionRun) {
            return;
          }

          setIgnitionActiveNodeId(consequences.at(-1)?.id ?? null);
          setShowIgnitionPrompt(true);
        }, 420 * consequences.length + 520);
      })
      .catch((err) => {
        shouldIgniteRef.current = false;
        console.error(err);
        setError("Could not load this world.");
      });

    return () => {
      if (ignitionRunRef.current === ignitionRun) {
        ignitionRunRef.current += 1;
      }
    };
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

      shouldIgniteRef.current = true;
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
      setShowEverydayObjects(false);
      setSelectedFaultLineIndex(0);
      setIsFaultLineDetailsOpen(false);
      setShowFaultLines(true);
      return;
    }

    setIsAnalyzingFaultLines(true);
    setFaultLineError(null);
    setSelectedNode(null);
    setRewritePreviewNodeId(null);
    setShowEverydayObjects(false);

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

  async function expandNode(
    nodeId: string,
    direction: InquiryDirection
  ) {
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ direction }),
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
        setInquiryNodeId(null);

        window.requestAnimationFrame(() => {
          if (flowInstanceRef.current) {
            frameNodeNeighborhood(flowInstanceRef.current, refreshed, nodeId);
          }
        });

        window.setTimeout(() => setNewNodeIds(new Set()), 12000);
      }

      /*
       * World changed, so previous world-level analysis
       * is now potentially stale.
       */
      setFaultLines([]);
      setShowFaultLines(false);
      setSelectedFaultLineIndex(null);
      setEverydayObjects([]);
      setShowEverydayObjects(false);
      setEverydayObjectsError(null);
    } catch (err) {
      console.error(err);

      setError(
        "This causal path could not be traced."
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
      setEverydayObjects([]);
      setShowEverydayObjects(false);
      setEverydayObjectsError(null);
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
      setShowEverydayObjects(false);
      setRewritePreviewNodeId(null);
      setInquiryNodeId(null);
      setDetailIntent("default");
      ignitionRunRef.current += 1;
      setIgnitionVisibleIds(null);
      setIgnitionActiveNodeId(null);
      setShowIgnitionPrompt(false);

      setSelectedNode(
        node as Node<WorldNodeData>
      );

      window.requestAnimationFrame(() => {
        if (flowInstanceRef.current) {
          frameNodeNeighborhood(
            flowInstanceRef.current,
            { nodes, edges },
            node.id
          );
        }
      });
    },
    [edges, nodes]
  );

  const selectedNodeHasChildren =
    selectedNode !== null &&
    edges.some(
      (edge) =>
        edge.source === selectedNode.id
    );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.matches("input, textarea, select") ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        setSelectedNode(null);
        setRewritePreviewNodeId(null);
        setInquiryNodeId(null);
        setShowFaultLines(false);
        setSelectedFaultLineIndex(null);
        setShowEverydayObjects(false);
        setIsFaultLineDetailsOpen(false);
        ignitionRunRef.current += 1;
        setShowIgnitionPrompt(false);
        setIgnitionVisibleIds(null);

        if (flowInstanceRef.current && loadedGraphRef.current) {
          frameWorldOrigin(flowInstanceRef.current, loadedGraphRef.current, 420);
        }
        return;
      }

      if (!selectedNode || showFaultLines) {
        return;
      }

      if (event.key.toLowerCase() === "e" && !selectedNodeHasChildren) {
        event.preventDefault();
        setInquiryNodeId(selectedNode.id);
      }

      if (
        event.key.toLowerCase() === "w" &&
        selectedNode.data.nodeType !== "rule"
      ) {
        event.preventDefault();
        setRewritePreviewNodeId(selectedNode.id);
        setDetailIntent("rewrite");
        setDetailIntentNonce((value) => value + 1);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedNode, selectedNodeHasChildren, showFaultLines]);

  useEffect(() => {
    if (!showFaultLines || !flowInstanceRef.current || !loadedGraphRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (flowInstanceRef.current && loadedGraphRef.current) {
        frameWorldOrigin(flowInstanceRef.current, loadedGraphRef.current, 520);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showFaultLines]);

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

  function collectFactionPathIds(seedIds: Set<string>) {
    const pathIds = new Set(seedIds);
    const queue = [...seedIds];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const parentEdges = edges.filter((edge) => edge.target === currentId);

      parentEdges.forEach((edge) => {
        if (!pathIds.has(edge.source)) {
          pathIds.add(edge.source);
          queue.push(edge.source);
        }
      });
    }

    return pathIds;
  }

  const factionAPathIds = selectedFaultLine
    ? collectFactionPathIds(factionANodeIds)
    : new Set<string>();
  const factionBPathIds = selectedFaultLine
    ? collectFactionPathIds(factionBNodeIds)
    : new Set<string>();

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

      if (ignitionVisibleIds && !ignitionVisibleIds.has(node.id)) {
        classNames.push("graph-node-ignition-hidden");
      }

      if (ignitionActiveNodeId === node.id) {
        classNames.push("graph-node-ignition-active");
      }

      return {
        ...node,
        data: {
          ...node.data,
          actions: selectedNode?.id === node.id
            ? {
                canExpand: !edges.some((edge) => edge.source === node.id),
                canRewrite: node.data.nodeType !== "rule",
                isBusy: isExpanding,
                showInquiry: inquiryNodeId === node.id,
                onTrace: () => {
                  setDetailIntent("explain");
                  setDetailIntentNonce((value) => value + 1);
                },
                onContinue: () => {
                  setInquiryNodeId((current) => current === node.id ? null : node.id);
                },
                onRewrite: () => {
                  setRewritePreviewNodeId(node.id);
                  setDetailIntent("rewrite");
                  setDetailIntentNonce((value) => value + 1);
                },
                onExpand: (direction: InquiryDirection) => {
                  void expandNode(node.id, direction);
                },
              }
            : undefined,
        },
        position: selectedFaultLine
          ? {
              x: node.position.x,
              y: node.position.y + (
                supportsFactionA && !supportsFactionB
                  ? -115
                  : supportsFactionB && !supportsFactionA
                    ? 115
                    : 0
              ),
            }
          : node.position,
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
    const isIgnitionEdgeHidden = Boolean(
      ignitionVisibleIds && !ignitionVisibleIds.has(edge.target)
    );
    const isFactionAPath =
      factionAPathIds.has(edge.source) &&
      factionAPathIds.has(edge.target);
    const isFactionBPath =
      factionBPathIds.has(edge.source) &&
      factionBPathIds.has(edge.target);

    return {
      ...edge,
      className: isIgnitionEdgeHidden
        ? "graph-edge-ignition-hidden"
        : selectedFaultLine
        ? isFactionAPath && isFactionBPath
          ? "graph-edge-faction-both"
          : isFactionAPath
            ? "graph-edge-faction-a"
            : isFactionBPath
              ? "graph-edge-faction-b"
              : "graph-edge-dimmed"
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

  return (
    <>
      {!currentWorld && (
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
              ? "Establishing reality…"
              : "Simulate world"}
          </button>

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

      {everydayObjectsError && (
        <div className="world-error">
          {everydayObjectsError}
        </div>
      )}

      <div className={`world-layout${showFaultLines ? " field-guide-open" : ""}`}>
        <div className="graph-container">
          {currentWorld && !showFaultLines && (
            <div className="causal-depth-regions" aria-hidden="true">
              <div className="causal-depth-region depth-premise">
                <span>01</span>
                <strong>Premise</strong>
              </div>
              <div className="causal-depth-region depth-immediate">
                <span>02</span>
                <strong>Immediate effects</strong>
              </div>
              <div className="causal-depth-region depth-adaptation">
                <span>03</span>
                <strong>Adaptation</strong>
              </div>
              <div className="causal-depth-region depth-emergence">
                <span>04</span>
                <strong>Emergent world</strong>
              </div>
            </div>
          )}

          {currentWorld && !ignitionVisibleIds && (
            <button
              className="return-to-origin"
              onClick={() => {
                setSelectedNode(null);
                setInquiryNodeId(null);
                setRewritePreviewNodeId(null);

                if (flowInstanceRef.current && loadedGraphRef.current) {
                  frameWorldOrigin(flowInstanceRef.current, loadedGraphRef.current, 420);
                }
              }}
            >
              <span aria-hidden="true">◎</span>
              Return to origin
            </button>
          )}

          {currentWorld && !ignitionVisibleIds && (
            <nav className="world-chapter-bar" aria-label="Field Guide chapters">
              <span className="world-chapter-label">FIELD GUIDE</span>
              <button
                className={!showFaultLines && !showEverydayObjects ? "active" : ""}
                onClick={() => {
                  setShowFaultLines(false);
                  setShowEverydayObjects(false);
                  setSelectedFaultLineIndex(null);
                }}
              >
                World
              </button>
              <button
                className={showFaultLines ? "active" : ""}
                onClick={() => void analyzeFaultLines()}
                disabled={isAnalyzingFaultLines}
              >
                {isAnalyzingFaultLines ? "Finding divisions…" : "Fault Lines"}
                {faultLines.length > 0 && <small>{faultLines.length}</small>}
              </button>
            </nav>
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

          <ReactFlow<Node<WorldNodeData>, Edge>
            className={selectedFaultLine ? "fault-line-flow" : undefined}
            nodes={displayedNodes}
            edges={displayedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onInit={(instance) => {
              flowInstanceRef.current = instance;

              if (loadedGraphRef.current) {
                frameWorldOrigin(instance, loadedGraphRef.current);
              }
            }}
            defaultViewport={{ x: 90, y: 90, zoom: 0.78 }}
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background
              gap={28}
              size={1}
            />

            <Controls />
          </ReactFlow>

          {ignitionVisibleIds && (
            <div className="world-ignition" aria-live="polite">
              <button
                className="world-ignition-skip"
                onClick={() => {
                  ignitionRunRef.current += 1;
                  setIgnitionVisibleIds(null);
                  setIgnitionActiveNodeId(null);
                  setShowIgnitionPrompt(false);
                }}
              >
                Skip reveal
              </button>

              {ignitionActiveNodeId && !showIgnitionPrompt && (
                <div className="world-ignition-causal-note">
                  <span>REALITY PROPAGATES</span>
                  <p>
                    {nodes.find((node) => node.id === ignitionActiveNodeId)?.data.description}
                  </p>
                </div>
              )}

              {showIgnitionPrompt && (
                <div className="world-ignition-prompt">
                  <span>THE WORLD HAS BEGUN</span>
                  <strong>Which consequence should reality follow?</strong>
                  <p>Select an unexplored consequence to continue its branch.</p>
                </div>
              )}
            </div>
          )}

          {showFaultLines && selectedFaultLine && (
            <div className="fault-line-stage" aria-hidden="true">
              <div className="fault-line-territory faction-a-territory">
                <div className="faction-standard">
                  <span>FACTION</span>
                  <strong>{selectedFaultLine.factionA.name}</strong>
                  <p>{selectedFaultLine.factionA.belief}</p>
                </div>
              </div>

              <div className="fault-line-stage-axis">
                <span>IDEOLOGICAL FAULT LINE</span>
              </div>

              <div className="fault-line-territory faction-b-territory">
                <div className="faction-standard">
                  <span>FACTION</span>
                  <strong>{selectedFaultLine.factionB.name}</strong>
                  <p>{selectedFaultLine.factionB.belief}</p>
                </div>
              </div>

              <div className="projected-flashpoint">
                <span>PROJECTED FLASHPOINT</span>
                <strong>{selectedFaultLine.flashpoint}</strong>
              </div>
            </div>
          )}
        </div>

        {selectedNode && !showFaultLines && !showEverydayObjects && (
          <NodeDetails
            key={`${selectedNode.id}-${selectedNode.data.title}-${selectedNode.data.description}-${detailIntentNonce}`}
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
            initialMode={detailIntent}
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

        {showEverydayObjects && (
          <EverydayObjectsPanel
            objects={everydayObjects}
            onClose={() => setShowEverydayObjects(false)}
          />
        )}
      </div>
    </>
  );
}
