package com.rule_zero.backend.world;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class WorldService {

    private final Neo4jClient neo4jClient;
    private final OpenRouterService openRouterService;

    public WorldService(
            Neo4jClient neo4jClient,
            OpenRouterService openRouterService
    ) {
        this.neo4jClient = neo4jClient;
        this.openRouterService = openRouterService;
    }

    public void createWorld(String rule) {
        GeneratedWorldResponse generated =
                openRouterService.generateConsequences(rule);

        neo4jClient.query("""
                MATCH (n)
                DETACH DELETE n
                """)
                .run();

        String rootId = UUID.randomUUID().toString();

        neo4jClient.query("""
                CREATE (:WorldNode {
                    id: $id,
                    title: $title,
                    description: $description,
                    domain: $domain,
                    nodeType: $nodeType
                })
                """)
                .bind(rootId).to("id")
                .bind(rule).to("title")
                .bind("Foundational rule for this world.").to("description")
                .bind("Rule").to("domain")
                .bind("rule").to("nodeType")
                .run();

        for (GeneratedConsequence consequence : generated.consequences()) {
            String consequenceId = UUID.randomUUID().toString();

            neo4jClient.query("""
                    MATCH (root:WorldNode {id: $rootId})

                    CREATE (child:WorldNode {
                        id: $id,
                        title: $title,
                        description: $description,
                        domain: $domain,
                        nodeType: $nodeType
                    })

                    CREATE (root)-[:CAUSES]->(child)
                    """)
                    .bind(rootId).to("rootId")
                    .bind(consequenceId).to("id")
                    .bind(consequence.title()).to("title")
                    .bind(consequence.description()).to("description")
                    .bind(consequence.domain()).to("domain")
                    .bind("consequence").to("nodeType")
                    .run();
        }
    }

    public void expandNode(String nodeId) {

        boolean alreadyExpanded =
                neo4jClient.query("""
                        MATCH (n:WorldNode {id: $nodeId})
                        RETURN EXISTS {
                            MATCH (n)-[:CAUSES]->(:WorldNode)
                        } AS expanded
                        """)
                        .bind(nodeId).to("nodeId")
                        .fetchAs(Boolean.class)
                        .mappedBy((typeSystem, record) ->
                                record.get("expanded").asBoolean()
                        )
                        .one()
                        .orElse(false);

        if (alreadyExpanded) {
            return;
        }

        Map<String, Object> parent =
                neo4jClient.query("""
                        MATCH (n:WorldNode {id: $nodeId})
                        RETURN
                            n.title AS title,
                            n.description AS description
                        """)
                        .bind(nodeId).to("nodeId")
                        .fetch()
                        .one()
                        .orElseThrow(() ->
                                new RuntimeException("World node not found")
                        );

        String title = parent.get("title").toString();

        Object rawDescription = parent.get("description");

        String description =
                rawDescription == null
                        ? ""
                        : rawDescription.toString();

        GeneratedWorldResponse generated =
                openRouterService.generateNextConsequences(
                        title,
                        description
                );

        for (GeneratedConsequence consequence : generated.consequences()) {

            String consequenceId = UUID.randomUUID().toString();

            neo4jClient.query("""
                    MATCH (parent:WorldNode {id: $parentId})

                    CREATE (child:WorldNode {
                        id: $id,
                        title: $title,
                        description: $description,
                        domain: $domain,
                        nodeType: "consequence"
                    })

                    CREATE (parent)-[:CAUSES]->(child)
                    """)
                    .bind(nodeId).to("parentId")
                    .bind(consequenceId).to("id")
                    .bind(consequence.title()).to("title")
                    .bind(consequence.description()).to("description")
                    .bind(consequence.domain()).to("domain")
                    .run();
        }
    }

    public Map<String, String> explainWhy(String nodeId) {

        Map<String, Object> result =
                neo4jClient.query("""
                        MATCH (parent:WorldNode)-[r:CAUSES]->(child:WorldNode {id: $nodeId})
                        RETURN
                            parent.title AS parentTitle,
                            parent.description AS parentDescription,
                            child.title AS childTitle,
                            child.description AS childDescription,
                            r.explanation AS explanation
                        """)
                        .bind(nodeId).to("nodeId")
                        .fetch()
                        .one()
                        .orElseThrow(() ->
                                new RuntimeException("Parent relationship not found")
                        );

        Object existingExplanation = result.get("explanation");

        if (existingExplanation != null) {
            return Map.of(
                    "explanation",
                    existingExplanation.toString()
            );
        }

        String explanation =
                openRouterService.explainCausalLink(
                        result.get("parentTitle").toString(),
                        result.get("parentDescription").toString(),
                        result.get("childTitle").toString(),
                        result.get("childDescription").toString()
                );

        neo4jClient.query("""
                MATCH (:WorldNode)-[r:CAUSES]->(:WorldNode {id: $nodeId})
                SET r.explanation = $explanation
                RETURN r.explanation AS explanation
                """)
                .bind(nodeId).to("nodeId")
                .bind(explanation).to("explanation")
                .fetch()
                .one()
                .orElseThrow(() ->
                        new RuntimeException("Failed to persist explanation")
                );

        return Map.of(
                "explanation",
                explanation
        );
    }

    public void changeOutcome(
            String nodeId,
            ChangeOutcomeRequest request
    ) {
        String title =
                request.title() == null
                        ? ""
                        : request.title().trim();

        if (title.isBlank()) {
            throw new IllegalArgumentException(
                    "Outcome title is required"
            );
        }

        GeneratedOutcomeResponse generated =
                openRouterService.generateOutcomeDetails(title);

        String description = generated.description();
        String domain = generated.domain();

        // 1. Delete all downstream consequences because they were
        // based on the previous version of this outcome.
        neo4jClient.query("""
                MATCH (node:WorldNode {id: $nodeId})
                OPTIONAL MATCH (node)-[:CAUSES*1..]->(descendant:WorldNode)
                WITH collect(DISTINCT descendant) AS descendants
                FOREACH (d IN descendants | DETACH DELETE d)
                """)
                .bind(nodeId).to("nodeId")
                .run();

        // 2. Update the selected node itself.
        neo4jClient.query("""
                MATCH (node:WorldNode {id: $nodeId})
                SET
                    node.title = $title,
                    node.description = $description,
                    node.domain = $domain
                RETURN node.id AS id
                """)
                .bind(nodeId).to("nodeId")
                .bind(title).to("title")
                .bind(description).to("description")
                .bind(domain).to("domain")
                .fetch()
                .one()
                .orElseThrow(() ->
                        new RuntimeException("World node not found")
                );

        // 3. The old explanation for why this node follows from its
        // parent may no longer be valid.
        neo4jClient.query("""
                MATCH (:WorldNode)-[r:CAUSES]->(node:WorldNode {id: $nodeId})
                REMOVE r.explanation
                """)
                .bind(nodeId).to("nodeId")
                .run();
    }

    public GeneratedAlternativesResponse generateOutcomeAlternatives(
            String nodeId
    ) {
        Map<String, Object> context =
                neo4jClient.query("""
                        MATCH (parent:WorldNode)-[:CAUSES]->(node:WorldNode {id: $nodeId})
                        RETURN
                            parent.title AS parentTitle,
                            parent.description AS parentDescription,
                            node.title AS currentTitle,
                            node.description AS currentDescription
                        """)
                        .bind(nodeId).to("nodeId")
                        .fetch()
                        .one()
                        .orElseThrow(() ->
                                new RuntimeException("Parent node not found")
                        );

        return openRouterService.generateOutcomeAlternatives(
                context.get("parentTitle").toString(),
                context.get("parentDescription").toString(),
                context.get("currentTitle").toString(),
                context.get("currentDescription").toString()
        );
    }

    public Map<String, String> getExistingExplanation(String nodeId) {

        Map<String, Object> result =
                neo4jClient.query("""
                        MATCH (:WorldNode)-[r:CAUSES]->(:WorldNode {id: $nodeId})
                        RETURN r.explanation AS explanation
                        """)
                        .bind(nodeId).to("nodeId")
                        .fetch()
                        .one()
                        .orElse(Map.of());

        Object explanation = result.get("explanation");

        if (explanation == null) {
            return Map.of();
        }

        return Map.of(
                "explanation",
                explanation.toString()
        );
    }
}