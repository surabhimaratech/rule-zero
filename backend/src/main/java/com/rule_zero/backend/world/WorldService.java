package com.rule_zero.backend.world;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WorldService {

    private final Neo4jClient neo4jClient;
    private final OpenRouterService openRouterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WorldService(
            Neo4jClient neo4jClient,
            OpenRouterService openRouterService
    ) {
        this.neo4jClient = neo4jClient;
        this.openRouterService = openRouterService;
    }

    public CreateWorldResponse createWorld(String rule) {
        String trimmedRule = rule == null ? "" : rule.trim();

        if (trimmedRule.isBlank()) {
            throw new IllegalArgumentException("World rule is required");
        }

        GeneratedWorldResponse generated =
                openRouterService.generateConsequences(trimmedRule);

        String worldId = UUID.randomUUID().toString();
        String rootId = UUID.randomUUID().toString();
        String now = Instant.now().toString();
        String worldName = trimmedRule.length() > 80
                ? trimmedRule.substring(0, 77) + "..."
                : trimmedRule;

        neo4jClient.query("""
                CREATE (world:World {
                    id: $worldId,
                    name: $name,
                    rootRule: $rootRule,
                    createdAt: $createdAt,
                    updatedAt: $updatedAt
                })
                CREATE (root:WorldNode {
                    id: $rootId,
                    title: $title,
                    description: $description,
                    domain: $domain,
                    nodeType: $nodeType,
                    generationOrder: -1
                })
                CREATE (world)-[:HAS_NODE]->(root)
                """)
                .bind(worldId).to("worldId")
                .bind(worldName).to("name")
                .bind(trimmedRule).to("rootRule")
                .bind(now).to("createdAt")
                .bind(now).to("updatedAt")
                .bind(rootId).to("rootId")
                .bind(trimmedRule).to("title")
                .bind("Foundational rule for this world.").to("description")
                .bind("Rule").to("domain")
                .bind("rule").to("nodeType")
                .run();

        int consequenceOrder = 0;

        for (GeneratedConsequence consequence : generated.consequences()) {
            String consequenceId = UUID.randomUUID().toString();

            neo4jClient.query("""
                    MATCH (world:World {id: $worldId})
                    MATCH (root:WorldNode {id: $rootId})
                    CREATE (child:WorldNode {
                        id: $id,
                        title: $title,
                        description: $description,
                        domain: $domain,
                        nodeType: $nodeType,
                        generationOrder: $generationOrder
                    })
                    CREATE (world)-[:HAS_NODE]->(child)
                    CREATE (root)-[:CAUSES]->(child)
                    """)
                    .bind(worldId).to("worldId")
                    .bind(rootId).to("rootId")
                    .bind(consequenceId).to("id")
                    .bind(consequence.title()).to("title")
                    .bind(consequence.description()).to("description")
                    .bind(consequence.domain()).to("domain")
                    .bind("consequence").to("nodeType")
                    .bind(consequenceOrder++).to("generationOrder")
                    .run();
        }

        return new CreateWorldResponse(worldId);
    }

    public List<WorldSummary> getWorlds() {
        return neo4jClient.query("""
                MATCH (world:World)
                OPTIONAL MATCH (world)-[:HAS_NODE]->(node:WorldNode)
                RETURN
                    world.id AS id,
                    world.name AS name,
                    world.rootRule AS rootRule,
                    world.createdAt AS createdAt,
                    world.updatedAt AS updatedAt,
                    count(node) AS nodeCount,
                    world.forkedFromWorldId AS forkedFromWorldId,
                    world.forkedAt AS forkedAt
                ORDER BY world.updatedAt DESC
                """)
                .fetch()
                .all()
                .stream()
                .map(this::mapWorldSummary)
                .toList();
    }

    public WorldSummary getWorld(String worldId) {
        return neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                OPTIONAL MATCH (world)-[:HAS_NODE]->(node:WorldNode)
                RETURN
                    world.id AS id,
                    world.name AS name,
                    world.rootRule AS rootRule,
                    world.createdAt AS createdAt,
                    world.updatedAt AS updatedAt,
                    count(node) AS nodeCount,
                    world.forkedFromWorldId AS forkedFromWorldId,
                    world.forkedAt AS forkedAt
                """)
                .bind(worldId).to("worldId")
                .fetch()
                .one()
                .map(this::mapWorldSummary)
                .orElseThrow(() -> new RuntimeException("World not found"));
    }

    public WorldSummary renameWorld(String worldId, RenameWorldRequest request) {
        String name = request.name() == null ? "" : request.name().trim();

        if (name.isBlank()) {
            throw new IllegalArgumentException("World name is required");
        }

        neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                SET world.name = $name, world.updatedAt = $updatedAt
                RETURN world.id AS id
                """)
                .bind(worldId).to("worldId")
                .bind(name).to("name")
                .bind(Instant.now().toString()).to("updatedAt")
                .fetch()
                .one()
                .orElseThrow(() -> new RuntimeException("World not found"));

        return getWorld(worldId);
    }

        public WorldSummary forkWorld(String worldId, ForkWorldRequest request) {
        WorldSummary source = getWorld(worldId);
        String now = Instant.now().toString();
        String name = request == null || request.name() == null
            || request.name().trim().isBlank()
            ? source.name() + " - Fork"
            : request.name().trim();
        String newWorldId = UUID.randomUUID().toString();

        List<ForkNode> sourceNodes = neo4jClient.query("""
            MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode)
            RETURN node.id AS id, node.title AS title,
                   node.description AS description, node.domain AS domain,
                   node.nodeType AS nodeType
            """)
            .bind(worldId).to("worldId")
            .fetch()
            .all()
            .stream()
            .map(row -> new ForkNode(
                row.get("id").toString(),
                row.get("title").toString(),
                row.get("description").toString(),
                row.get("domain").toString(),
                row.get("nodeType").toString()
            ))
            .toList();

        List<ForkRelationship> sourceRelationships = neo4jClient.query("""
            MATCH (world:World {id: $worldId})-[:HAS_NODE]->(source:WorldNode)
                  -[r:CAUSES]->(target:WorldNode)
            WHERE (world)-[:HAS_NODE]->(target)
            RETURN source.id AS sourceId, target.id AS targetId,
                   r.explanation AS explanation
            """)
            .bind(worldId).to("worldId")
            .fetch()
            .all()
            .stream()
            .map(row -> new ForkRelationship(
                row.get("sourceId").toString(),
                row.get("targetId").toString(),
                row.get("explanation") == null
                    ? null : row.get("explanation").toString()
            ))
            .toList();

        neo4jClient.query("""
            CREATE (world:World {
                id: $worldId,
                name: $name,
                rootRule: $rootRule,
                createdAt: $createdAt,
                updatedAt: $updatedAt,
                forkedFromWorldId: $forkedFromWorldId,
                forkedAt: $forkedAt
            })
            """)
            .bind(newWorldId).to("worldId")
            .bind(name).to("name")
            .bind(source.rootRule()).to("rootRule")
            .bind(now).to("createdAt")
            .bind(now).to("updatedAt")
            .bind(worldId).to("forkedFromWorldId")
            .bind(now).to("forkedAt")
            .run();

        Map<String, String> nodeIds = new HashMap<>();

        for (ForkNode sourceNode : sourceNodes) {
            String newNodeId = UUID.randomUUID().toString();
            nodeIds.put(sourceNode.id(), newNodeId);

            neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                CREATE (node:WorldNode {
                id: $nodeId,
                title: $title,
                description: $description,
                domain: $domain,
                nodeType: $nodeType
                })
                CREATE (world)-[:HAS_NODE]->(node)
                """)
                .bind(newWorldId).to("worldId")
                .bind(newNodeId).to("nodeId")
                .bind(sourceNode.title()).to("title")
                .bind(sourceNode.description()).to("description")
                .bind(sourceNode.domain()).to("domain")
                .bind(sourceNode.nodeType()).to("nodeType")
                .run();
        }

        for (ForkRelationship relationship : sourceRelationships) {
            String newSourceId = nodeIds.get(relationship.sourceId());
            String newTargetId = nodeIds.get(relationship.targetId());

            if (newSourceId == null || newTargetId == null) {
            throw new RuntimeException("Fork relationship references an unknown node");
            }

                if (relationship.explanation() == null) {
                neo4jClient.query("""
                    MATCH (source:WorldNode {id: $sourceId})
                    MATCH (target:WorldNode {id: $targetId})
                    CREATE (source)-[:CAUSES]->(target)
                    """)
                    .bind(newSourceId).to("sourceId")
                    .bind(newTargetId).to("targetId")
                    .run();
                } else {
                neo4jClient.query("""
                    MATCH (source:WorldNode {id: $sourceId})
                    MATCH (target:WorldNode {id: $targetId})
                    CREATE (source)-[r:CAUSES]->(target)
                    SET r.explanation = $explanation
                    """)
                    .bind(newSourceId).to("sourceId")
                    .bind(newTargetId).to("targetId")
                    .bind(relationship.explanation()).to("explanation")
                    .run();
                }
        }

        return getWorld(newWorldId);
        }

    public WorldComparisonResponse compareWorlds(
            String worldId,
            String otherWorldId
    ) {
        WorldSummary worldA = getWorld(worldId);
        WorldSummary worldB = getWorld(otherWorldId);

        List<ComparisonNode> nodesA = getComparisonNodes(worldId);
        List<ComparisonNode> nodesB = getComparisonNodes(otherWorldId);
        List<ComparisonNode> unmatchedA = new java.util.ArrayList<>(nodesA);
        List<ComparisonNode> unmatchedB = new java.util.ArrayList<>(nodesB);
        List<ComparisonNode> unchanged = new java.util.ArrayList<>();
        List<ChangedNode> changed = new java.util.ArrayList<>();

        for (int index = unmatchedA.size() - 1; index >= 0; index--) {
            ComparisonNode nodeA = unmatchedA.get(index);
            int matchIndex = findExactMatch(nodeA, unmatchedB);

            if (matchIndex >= 0) {
                unchanged.add(nodeA);
                unmatchedA.remove(index);
                unmatchedB.remove(matchIndex);
            }
        }

        for (int index = unmatchedA.size() - 1; index >= 0; index--) {
            ComparisonNode nodeA = unmatchedA.get(index);
            int matchIndex = findPositionMatch(nodeA, unmatchedB);

            if (matchIndex >= 0) {
                changed.add(new ChangedNode(nodeA, unmatchedB.remove(matchIndex)));
                unmatchedA.remove(index);
            }
        }

        return new WorldComparisonResponse(
                new ComparedWorld(worldA.id(), worldA.name(), worldA.rootRule()),
                new ComparedWorld(worldB.id(), worldB.name(), worldB.rootRule()),
                new ComparisonSummary(
                        unchanged.size(),
                        changed.size(),
                        unmatchedA.size(),
                        unmatchedB.size()
                ),
                unchanged,
                changed,
                unmatchedA,
                unmatchedB
        );
    }

    private List<ComparisonNode> getComparisonNodes(String worldId) {
        return neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode)
                OPTIONAL MATCH (parent:WorldNode)-[:CAUSES]->(node)
                WHERE (world)-[:HAS_NODE]->(parent)
                RETURN
                    node.title AS title,
                    node.description AS description,
                    node.domain AS domain,
                    node.nodeType AS nodeType,
                    collect(parent.title)[0] AS parentTitle
                ORDER BY node.nodeType, parentTitle, node.title
                """)
                .bind(worldId).to("worldId")
                .fetch()
                .all()
                .stream()
                .map(row -> new ComparisonNode(
                        row.get("title").toString(),
                        row.get("description").toString(),
                        row.get("domain").toString(),
                        row.get("nodeType").toString(),
                        row.get("parentTitle") == null
                                ? null : row.get("parentTitle").toString()
                ))
                .toList();
    }

    private int findExactMatch(
            ComparisonNode candidate,
            List<ComparisonNode> nodes
    ) {
        for (int index = 0; index < nodes.size(); index++) {
            if (sameContent(candidate, nodes.get(index))) {
                return index;
            }
        }

        return -1;
    }

    private int findPositionMatch(
            ComparisonNode candidate,
            List<ComparisonNode> nodes
    ) {
        for (int index = 0; index < nodes.size(); index++) {
            ComparisonNode other = nodes.get(index);

            if (java.util.Objects.equals(candidate.parentTitle(), other.parentTitle())
                    && candidate.nodeType().equals(other.nodeType())) {
                return index;
            }
        }

        return -1;
    }

    private boolean sameContent(
            ComparisonNode first,
            ComparisonNode second
    ) {
        return java.util.Objects.equals(first.title(), second.title())
                && java.util.Objects.equals(first.description(), second.description())
                && java.util.Objects.equals(first.domain(), second.domain())
                && java.util.Objects.equals(first.nodeType(), second.nodeType())
                && java.util.Objects.equals(first.parentTitle(), second.parentTitle());
    }

    public void deleteWorld(String worldId) {
        neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                OPTIONAL MATCH (world)-[:HAS_NODE]->(node:WorldNode)
                WITH world, collect(node) AS nodes
                FOREACH (node IN nodes | DETACH DELETE node)
                DETACH DELETE world
                """)
                .bind(worldId).to("worldId")
                .run();
    }

    public GraphResponse getGraph(String worldId) {
        getWorld(worldId);

        List<GraphResponse.GraphNode> nodes =
                neo4jClient.query("""
                        MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode)
                        RETURN
                            node.id AS id,
                            node.title AS title,
                            node.description AS description,
                            node.domain AS domain,
                            node.nodeType AS nodeType
                        ORDER BY
                            CASE node.nodeType WHEN 'rule' THEN 0 ELSE 1 END,
                            coalesce(node.generationOrder, 999999),
                            node.title
                        """)
                        .bind(worldId).to("worldId")
                        .fetchAs(GraphResponse.GraphNode.class)
                        .mappedBy((typeSystem, record) ->
                                new GraphResponse.GraphNode(
                                        record.get("id").asString(),
                                        record.get("title").asString(),
                                        record.get("description").asString(),
                                        record.get("domain").asString(),
                                        record.get("nodeType").asString()
                                )
                        )
                        .all()
                        .stream()
                        .toList();

        List<GraphResponse.GraphEdge> edges =
                neo4jClient.query("""
                        MATCH (world:World {id: $worldId})-[:HAS_NODE]->(source:WorldNode)
                              -[r:CAUSES]->(target:WorldNode)
                        WHERE (world)-[:HAS_NODE]->(target)
                        RETURN source.id AS source, target.id AS target, type(r) AS relationship
                        """)
                        .bind(worldId).to("worldId")
                        .fetch()
                        .all()
                        .stream()
                        .map(row -> {
                            String source = row.get("source").toString();
                            String target = row.get("target").toString();
                            String relationship = row.get("relationship").toString();
                            return new GraphResponse.GraphEdge(
                                    source + "-" + target,
                                    source,
                                    target,
                                    relationship
                            );
                        })
                        .toList();

        return new GraphResponse(worldId, nodes, edges);
    }

    public void expandNode(String worldId, String nodeId) {
        expandNode(worldId, nodeId, null);
    }

    public void expandNode(String worldId, String nodeId, String direction) {
        Map<String, Object> parent = getOwnedNode(worldId, nodeId);

        boolean alreadyExpanded = neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode {id: $nodeId})
                RETURN EXISTS {
                    MATCH (node)-[:CAUSES]->(:WorldNode)
                } AS expanded
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .fetchAs(Boolean.class)
                .mappedBy((typeSystem, record) -> record.get("expanded").asBoolean())
                .one()
                .orElse(false);

        if (alreadyExpanded) {
            return;
        }

        String title = parent.get("title").toString();
        String description = parent.get("description") == null
                ? ""
                : parent.get("description").toString();

        String normalizedDirection = switch (
                direction == null ? "" : direction.trim().toLowerCase()
        ) {
            case "breaks" -> "what breaks, fails, or becomes unsustainable";
            case "benefits" -> "who benefits, gains power, or finds opportunity";
            case "adapts" -> "how society, institutions, or culture adapts";
            default -> null;
        };

        GeneratedWorldResponse generated = normalizedDirection == null
                ? openRouterService.generateNextConsequences(title, description)
                : openRouterService.generateNextConsequences(
                        title,
                        description,
                        normalizedDirection
                );

        for (GeneratedConsequence consequence : generated.consequences()) {
            String consequenceId = UUID.randomUUID().toString();

            neo4jClient.query("""
                    MATCH (world:World {id: $worldId})-[:HAS_NODE]->(parent:WorldNode {id: $parentId})
                    CREATE (child:WorldNode {
                        id: $id,
                        title: $title,
                        description: $description,
                        domain: $domain,
                        nodeType: "consequence"
                    })
                    CREATE (world)-[:HAS_NODE]->(child)
                    CREATE (parent)-[:CAUSES]->(child)
                    """)
                    .bind(worldId).to("worldId")
                    .bind(nodeId).to("parentId")
                    .bind(consequenceId).to("id")
                    .bind(consequence.title()).to("title")
                    .bind(consequence.description()).to("description")
                    .bind(consequence.domain()).to("domain")
                    .run();
        }

        invalidateWorldAnalysis(worldId);
        touchWorld(worldId);
    }

    public Map<String, String> explainWhy(String worldId, String nodeId) {
        Map<String, Object> result = getCausalContext(worldId, nodeId);
        Object existingExplanation = result.get("explanation");

        if (existingExplanation != null) {
            return Map.of("explanation", existingExplanation.toString());
        }

        String explanation = openRouterService.explainCausalLink(
                result.get("parentTitle").toString(),
                result.get("parentDescription").toString(),
                result.get("childTitle").toString(),
                result.get("childDescription").toString()
        );

        neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(parent:WorldNode)
                      -[r:CAUSES]->(child:WorldNode {id: $nodeId})
                WHERE (world)-[:HAS_NODE]->(child)
                SET r.explanation = $explanation
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .bind(explanation).to("explanation")
                .run();

        touchWorld(worldId);
        return Map.of("explanation", explanation);
    }

    public Map<String, String> getExistingExplanation(String worldId, String nodeId) {
        getOwnedNode(worldId, nodeId);

        Map<String, Object> result = neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(parent:WorldNode)
                      -[r:CAUSES]->(node:WorldNode {id: $nodeId})
                WHERE (world)-[:HAS_NODE]->(node)
                RETURN r.explanation AS explanation
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .fetch()
                .one()
                .orElse(Map.of());

        Object explanation = result.get("explanation");
        return explanation == null
                ? Map.of()
                : Map.of("explanation", explanation.toString());
    }

    public void changeOutcome(
            String worldId,
            String nodeId,
            ChangeOutcomeRequest request
    ) {
        getOwnedNode(worldId, nodeId);

        String title = request.title() == null ? "" : request.title().trim();

        if (title.isBlank()) {
            throw new IllegalArgumentException("Outcome title is required");
        }

        GeneratedOutcomeResponse generated =
                openRouterService.generateOutcomeDetails(title);
        String updatedAt = Instant.now().toString();

        neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode {id: $nodeId})
                OPTIONAL MATCH (node)-[:CAUSES*1..]->(descendant:WorldNode)
                WHERE (world)-[:HAS_NODE]->(descendant)
                WITH world, node, collect(DISTINCT descendant) AS descendants
                FOREACH (descendant IN descendants | DETACH DELETE descendant)
                SET
                    node.title = $title,
                    node.description = $description,
                    node.domain = $domain,
                    world.updatedAt = $updatedAt
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .bind(title).to("title")
                .bind(generated.description()).to("description")
                .bind(generated.domain()).to("domain")
                .bind(updatedAt).to("updatedAt")
                .run();

        invalidateWorldAnalysis(worldId);

        neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(parent:WorldNode)
                      -[r:CAUSES]->(node:WorldNode {id: $nodeId})
                WHERE (world)-[:HAS_NODE]->(node)
                REMOVE r.explanation
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .run();
    }

    public GeneratedAlternativesResponse generateOutcomeAlternatives(
            String worldId,
            String nodeId
    ) {
        getOwnedNode(worldId, nodeId);
        Map<String, Object> context = getCausalContext(worldId, nodeId);

        return openRouterService.generateOutcomeAlternatives(
                context.get("parentTitle").toString(),
                context.get("parentDescription").toString(),
                context.get("childTitle").toString(),
                context.get("childDescription").toString()
        );
    }

    private Map<String, Object> getOwnedNode(String worldId, String nodeId) {
        return neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode {id: $nodeId})
                RETURN node.title AS title, node.description AS description
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .fetch()
                .one()
                .orElseThrow(() -> new RuntimeException("World node not found"));
    }

    private Map<String, Object> getCausalContext(String worldId, String nodeId) {
        return neo4jClient.query("""
                MATCH (world:World {id: $worldId})-[:HAS_NODE]->(parent:WorldNode)
                      -[r:CAUSES]->(child:WorldNode {id: $nodeId})
                WHERE (world)-[:HAS_NODE]->(child)
                RETURN
                    parent.title AS parentTitle,
                    parent.description AS parentDescription,
                    child.title AS childTitle,
                    child.description AS childDescription,
                    r.explanation AS explanation
                """)
                .bind(worldId).to("worldId")
                .bind(nodeId).to("nodeId")
                .fetch()
                .one()
                .orElseThrow(() -> new RuntimeException("Parent relationship not found"));
    }

    private void touchWorld(String worldId) {
        neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                SET world.updatedAt = $updatedAt
                """)
                .bind(worldId).to("worldId")
                .bind(Instant.now().toString()).to("updatedAt")
                .run();
    }

    private void invalidateWorldAnalysis(String worldId) {
        neo4jClient.query("""
                MATCH (world:World {id: $worldId})
                REMOVE
                    world.faultLinesJson,
                    world.faultLinesGeneratedAt,
                    world.everydayObjectsJson,
                    world.everydayObjectsGeneratedAt
                """)
                .bind(worldId).to("worldId")
                .run();
    }

    private WorldSummary mapWorldSummary(Map<String, Object> row) {
        return new WorldSummary(
                row.get("id").toString(),
                row.get("name").toString(),
                row.get("rootRule").toString(),
                row.get("createdAt").toString(),
                row.get("updatedAt").toString(),
                ((Number) row.get("nodeCount")).longValue(),
                row.get("forkedFromWorldId") == null ? null : row.get("forkedFromWorldId").toString(),
                row.get("forkedAt") == null ? null : row.get("forkedAt").toString()
        );
    }

    public FaultLineResponse findFaultLines(String worldId) {
        WorldSummary world = getWorld(worldId);

        Map<String, Object> cached =
                neo4jClient.query("""
                        MATCH (world:World {id: $worldId})
                        RETURN
                            world.faultLinesJson AS faultLinesJson,
                            world.faultLinesGeneratedAt AS generatedAt
                        """)
                        .bind(worldId).to("worldId")
                        .fetch()
                        .one()
                        .orElseThrow(() ->
                                new RuntimeException("World not found")
                        );

        Object cachedJson = cached.get("faultLinesJson");

        if (cachedJson != null) {
            try {
                return objectMapper.readValue(
                        cachedJson.toString(),
                        FaultLineResponse.class
                );
            } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse cached fault lines",
                        e
                );
            }
        }

        String context = buildWorldAnalysisContext(worldId, world).text();

        FaultLineResponse result =
                openRouterService.generateFaultLines(context);

        try {
            String json = objectMapper.writeValueAsString(result);

            neo4jClient.query("""
                    MATCH (world:World {id: $worldId})
                    SET
                        world.faultLinesJson = $json,
                        world.faultLinesGeneratedAt = $generatedAt
                    """)
                    .bind(worldId).to("worldId")
                    .bind(json).to("json")
                    .bind(Instant.now().toString()).to("generatedAt")
                    .run();

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to cache fault lines",
                    e
            );
        }

        return result;
    }

    public EverydayObjectsResponse findEverydayObjects(String worldId) {
        WorldSummary world = getWorld(worldId);

        Map<String, Object> cached =
                neo4jClient.query("""
                        MATCH (world:World {id: $worldId})
                        RETURN
                            world.everydayObjectsJson AS everydayObjectsJson,
                            world.everydayObjectsGeneratedAt AS generatedAt
                        """)
                        .bind(worldId).to("worldId")
                        .fetch()
                        .one()
                        .orElseThrow(() ->
                                new RuntimeException("World not found")
                        );

        Object cachedJson = cached.get("everydayObjectsJson");

        if (cachedJson != null) {
            try {
                return objectMapper.readValue(
                        cachedJson.toString(),
                        EverydayObjectsResponse.class
                );
            } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse cached everyday objects",
                        e
                );
            }
        }

        WorldAnalysisContext context = buildWorldAnalysisContext(worldId, world);
        EverydayObjectsResponse result =
                openRouterService.generateEverydayObjects(context.text());
        validateEverydayObjects(result, context.nodeIds());

        try {
            String json = objectMapper.writeValueAsString(result);

            neo4jClient.query("""
                    MATCH (world:World {id: $worldId})
                    SET
                        world.everydayObjectsJson = $json,
                        world.everydayObjectsGeneratedAt = $generatedAt
                    """)
                    .bind(worldId).to("worldId")
                    .bind(json).to("json")
                    .bind(Instant.now().toString()).to("generatedAt")
                    .run();

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to cache everyday objects",
                    e
            );
        }

        return result;
    }

    private WorldAnalysisContext buildWorldAnalysisContext(
            String worldId,
            WorldSummary world
    ) {
        List<Map<String, Object>> nodes =
                neo4jClient.query("""
                        MATCH (world:World {id: $worldId})-[:HAS_NODE]->(node:WorldNode)
                        OPTIONAL MATCH (parent:WorldNode)-[:CAUSES]->(node)
                        WHERE (world)-[:HAS_NODE]->(parent)
                        RETURN
                            node.id AS id,
                            node.title AS title,
                            node.description AS description,
                            node.domain AS domain,
                            node.nodeType AS nodeType,
                            parent.id AS parentId,
                            parent.title AS parentTitle
                        ORDER BY node.nodeType, node.title
                        """)
                        .bind(worldId).to("worldId")
                        .fetch()
                        .all()
                        .stream()
                        .toList();

        StringBuilder context = new StringBuilder();

        context.append("World name: ")
                .append(world.name())
                .append("\n");

        context.append("Foundational rule: ")
                .append(world.rootRule())
                .append("\n\n");

        context.append("World nodes:\n");

        for (Map<String, Object> node : nodes) {
            context.append("- ID: ")
                    .append(node.get("id"))
                    .append("\n");

            context.append("  Title: ")
                    .append(node.get("title"))
                    .append("\n");

            context.append("  Description: ")
                    .append(node.get("description"))
                    .append("\n");

            context.append("  Domain: ")
                    .append(node.get("domain"))
                    .append("\n");

            if (node.get("parentTitle") != null) {
                context.append("  Caused by: ")
                        .append(node.get("parentTitle"))
                        .append("\n");
            }

            context.append("\n");
        }

        Set<String> nodeIds = nodes.stream()
                .map(node -> node.get("id").toString())
                .collect(Collectors.toSet());

        return new WorldAnalysisContext(context.toString(), nodeIds);
    }

    private void validateEverydayObjects(
            EverydayObjectsResponse response,
            Set<String> worldNodeIds
    ) {
        if (response.objects() == null || response.objects().size() != 3) {
            throw new RuntimeException(
                    "Everyday objects response must contain exactly 3 objects"
            );
        }

        boolean containsUnknownNodeId = response.objects().stream()
                .anyMatch(object ->
                        object.supportingNodeIds() == null
                                || object.supportingNodeIds().isEmpty()
                                || !worldNodeIds.containsAll(object.supportingNodeIds())
                );

        if (containsUnknownNodeId) {
            throw new RuntimeException(
                    "Everyday objects response contains an invalid supporting node ID"
            );
        }
    }

    private record WorldAnalysisContext(String text, Set<String> nodeIds) {}
}
