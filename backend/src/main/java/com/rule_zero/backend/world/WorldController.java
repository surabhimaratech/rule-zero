package com.rule_zero.backend.world;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/world")
@CrossOrigin(origins = "http://localhost:5173")
public class WorldController {

    private final Neo4jClient neo4jClient;
    private final WorldService worldService;

    public WorldController(
        Neo4jClient neo4jClient,
        WorldService worldService
    ) {
        this.neo4jClient = neo4jClient;
        this.worldService = worldService;
    }

    @GetMapping("/graph")
    public GraphResponse getGraph() {

        List<GraphResponse.GraphNode> nodes =
                neo4jClient.query("""
                    MATCH (n:WorldNode)
                    RETURN
                        n.id AS id,
                        n.title AS title,
                        n.description AS description,
                        n.domain AS domain,
                        n.nodeType AS nodeType
                """)
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
                    MATCH (a:WorldNode)-[r]->(b:WorldNode)
                    RETURN
                        a.id AS source,
                        b.id AS target,
                        type(r) AS relationship
                """)
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

        return new GraphResponse(nodes, edges);
    }

    @PostMapping("/create")
    public void createWorld(@RequestBody CreateWorldRequest request) {
        worldService.createWorld(request.rule());
    }

    @PostMapping("/nodes/{nodeId}/expand")
    public void expandNode(@PathVariable String nodeId) {
        worldService.expandNode(nodeId);
    }

    @GetMapping("/nodes/{nodeId}/why")
    public Map<String, String> explainWhy(@PathVariable String nodeId) {
        return worldService.explainWhy(nodeId);
    }

    @PostMapping("/nodes/{nodeId}/change")
    public void changeOutcome(
            @PathVariable String nodeId,
            @RequestBody ChangeOutcomeRequest request
    ) {
        worldService.changeOutcome(nodeId, request);
    }

    @PostMapping("/nodes/{nodeId}/alternatives")
    public GeneratedAlternativesResponse generateOutcomeAlternatives(
            @PathVariable String nodeId
    ) {
        return worldService.generateOutcomeAlternatives(nodeId);
    }

    @GetMapping("/nodes/{nodeId}/explanation")
    public Map<String, String> getExistingExplanation(
            @PathVariable String nodeId
    ) {
        return worldService.getExistingExplanation(nodeId);
    }
}