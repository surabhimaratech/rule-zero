package com.rule_zero.backend.world;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorldServiceTest {

    private static final String WORLD_ID = "world-1";
    private static final String NODE_ID = "node-1";

    @Mock
    private OpenRouterService openRouterService;

    private Neo4jClient neo4jClient;
    private WorldService worldService;

    @BeforeEach
    void setUp() {
        neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
        worldService = new WorldService(neo4jClient, openRouterService);
    }

    @Test
    void cachesGeneratedFaultLinesAndReusesThemOnTheNextRequest() {
        Map<String, Object> worldRow = Map.of(
                "id", WORLD_ID,
                "name", "Test World",
                "rootRule", "The moon is inhabited",
                "createdAt", "2026-01-01T00:00:00Z",
                "updatedAt", "2026-01-01T00:00:00Z",
                "nodeCount", 1L
        );
        Map<String, Object> uncached = new HashMap<>();
        uncached.put("faultLinesJson", null);
        uncached.put("generatedAt", null);

        FaultLineResponse generated = sampleFaultLines();
        String cachedJson = """
                {"faultLines":[{"title":"Old versus New","tension":"Competing responses","factionA":{"name":"Keepers","belief":"Preserve it","goal":"Maintain order","fear":"Rapid change","supportingNodeIds":["node-1"]},"factionB":{"name":"Reformers","belief":"Improve it","goal":"Change society","fear":"Stagnation","supportingNodeIds":["node-1"]},"flashpoint":"A disputed law"}]}
                """.trim();

        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("count(node) AS nodeCount")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(worldRow));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("world.faultLinesJson AS faultLinesJson")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(
                        Optional.of(uncached),
                        Optional.of(Map.of(
                                "faultLinesJson", cachedJson,
                                "generatedAt", "2026-01-01T01:00:00Z"
                        ))
                );
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("ORDER BY node.nodeType, node.title")))
                .bind(WORLD_ID).to("worldId")
                .fetch().all())
                .thenReturn(List.of(Map.of(
                        "id", NODE_ID,
                        "title", "Lunar settlement",
                        "description", "People live on the moon",
                        "domain", "Demographics",
                        "nodeType", "consequence"
                )));
        when(openRouterService.generateFaultLines(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(generated);

        assertEquals(generated, worldService.findFaultLines(WORLD_ID));
        assertEquals(generated, worldService.findFaultLines(WORLD_ID));

        verify(openRouterService, times(1))
                .generateFaultLines(org.mockito.ArgumentMatchers.anyString());
        verify(neo4jClient, times(1)).query(argThat((String query) ->
                query != null
                        && query.contains("world.faultLinesJson = $json")
                        && query.contains("world.faultLinesGeneratedAt = $generatedAt")));
    }

    @Test
    void cachesThreeEverydayObjectsAndReusesThemWithoutAnotherOpenRouterCall() {
        Map<String, Object> worldRow = sampleWorldRow();
        Map<String, Object> uncached = new HashMap<>();
        uncached.put("everydayObjectsJson", null);
        uncached.put("generatedAt", null);

        EverydayObjectsResponse generated = sampleEverydayObjects();
        String cachedJson = """
                {"objects":[{"name":"Shoes","description":"Shoes that watch for injuries.","before":"They provided support.","now":"They detect tissue damage.","whyItChanged":"Pain no longer warns people.","supportingNodeIds":["node-1"]},{"name":"Medicine Cabinet","description":"A cabinet that tracks dosage.","before":"It stored medicine.","now":"It verifies every dose.","whyItChanged":"Silent injuries demand monitoring.","supportingNodeIds":["node-1"]},{"name":"Desk Chair","description":"A chair that shifts pressure.","before":"It supported seated work.","now":"It prevents unnoticed strain.","whyItChanged":"Workers cannot feel harmful posture.","supportingNodeIds":["node-1"]}]}
                """.trim();

        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("count(node) AS nodeCount")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(worldRow));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("world.everydayObjectsJson AS everydayObjectsJson")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(
                        Optional.of(uncached),
                        Optional.of(Map.of(
                                "everydayObjectsJson", cachedJson,
                                "generatedAt", "2026-01-01T01:00:00Z"
                        ))
                );
        stubWorldNodes();
        when(openRouterService.generateEverydayObjects(
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(generated);

        assertEquals(generated, worldService.findEverydayObjects(WORLD_ID));
        EverydayObjectsResponse cached = worldService.findEverydayObjects(WORLD_ID);
        assertEquals(generated, cached);
        assertEquals(3, cached.objects().size());

        verify(openRouterService, times(1))
                .generateEverydayObjects(org.mockito.ArgumentMatchers.anyString());
        verify(neo4jClient, times(1)).query(argThat((String query) ->
                query != null
                        && query.contains("world.everydayObjectsJson = $json")
                        && query.contains("world.everydayObjectsGeneratedAt = $generatedAt")));
    }

    @Test
    void changingAnOutcomeInvalidatesCachedFaultLines() {
        Map<String, Object> uncached = new HashMap<>();
        uncached.put("faultLinesJson", null);
        uncached.put("generatedAt", null);
        FaultLineResponse refreshed = sampleFaultLines();

        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("RETURN node.title AS title, node.description AS description")))
                .bind(WORLD_ID).to("worldId")
                .bind(NODE_ID).to("nodeId")
                .fetch().one())
                .thenReturn(Optional.of(Map.of(
                        "title", "Old outcome",
                        "description", "Old description"
                )));
        when(openRouterService.generateOutcomeDetails("New outcome"))
                .thenReturn(new GeneratedOutcomeResponse(
                        "New description",
                        "Culture"
                ));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("count(node) AS nodeCount")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(Map.of(
                        "id", WORLD_ID,
                        "name", "Test World",
                        "rootRule", "The moon is inhabited",
                        "createdAt", "2026-01-01T00:00:00Z",
                        "updatedAt", "2026-01-01T01:00:00Z",
                        "nodeCount", 1L
                )));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("world.faultLinesJson AS faultLinesJson")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(uncached));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("ORDER BY node.nodeType, node.title")))
                .bind(WORLD_ID).to("worldId")
                .fetch().all())
                .thenReturn(List.of(Map.of(
                        "id", NODE_ID,
                        "title", "New outcome",
                        "description", "New description",
                        "domain", "Culture",
                        "nodeType", "consequence"
                )));
        when(openRouterService.generateFaultLines(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(refreshed);

        worldService.changeOutcome(
                WORLD_ID,
                NODE_ID,
                new ChangeOutcomeRequest("New outcome")
        );
        assertEquals(refreshed, worldService.findFaultLines(WORLD_ID));

        verify(neo4jClient, times(1)).query(argThat((String query) ->
                query != null
                        && query.contains("REMOVE")
                        && query.contains("world.faultLinesJson")
                        && query.contains("world.faultLinesGeneratedAt")
                        && query.contains("world.everydayObjectsJson")
                        && query.contains("world.everydayObjectsGeneratedAt")));
        verify(openRouterService, times(1))
                .generateFaultLines(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void expandingANodeInvalidatesAnalysesAndRegeneratesEverydayObjects() {
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("RETURN node.title AS title, node.description AS description")))
                .bind(WORLD_ID).to("worldId")
                .bind(NODE_ID).to("nodeId")
                .fetch().one())
                .thenReturn(Optional.of(Map.of(
                        "title", "Parent outcome",
                        "description", "Parent description"
                )));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("AS expanded")))
                .bind(WORLD_ID).to("worldId")
                .bind(NODE_ID).to("nodeId")
                .fetchAs(Boolean.class)
                .mappedBy(any())
                .one())
                .thenReturn(Optional.of(false));
        when(openRouterService.generateNextConsequences(
                "Parent outcome",
                "Parent description",
                "what breaks, fails, or becomes unsustainable"
        )).thenReturn(new GeneratedWorldResponse(List.of(
                new GeneratedConsequence(
                        "Child outcome",
                        "Child description",
                        "Culture"
                )
        )));
        Map<String, Object> uncached = new HashMap<>();
        uncached.put("everydayObjectsJson", null);
        uncached.put("generatedAt", null);
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("count(node) AS nodeCount")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(sampleWorldRow()));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("world.everydayObjectsJson AS everydayObjectsJson")))
                .bind(WORLD_ID).to("worldId")
                .fetch().one())
                .thenReturn(Optional.of(uncached));
        stubWorldNodes();
        when(openRouterService.generateEverydayObjects(
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(sampleEverydayObjects());

        worldService.expandNode(WORLD_ID, NODE_ID, "breaks");
        assertEquals(
                sampleEverydayObjects(),
                worldService.findEverydayObjects(WORLD_ID)
        );

        verify(openRouterService).generateNextConsequences(
                "Parent outcome",
                "Parent description",
                "what breaks, fails, or becomes unsustainable"
        );

        verify(neo4jClient, times(1)).query(argThat((String query) ->
                query != null
                        && query.contains("REMOVE")
                        && query.contains("world.faultLinesJson")
                        && query.contains("world.faultLinesGeneratedAt")
                        && query.contains("world.everydayObjectsJson")
                        && query.contains("world.everydayObjectsGeneratedAt")));
        verify(openRouterService, times(1))
                .generateEverydayObjects(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void readingAnExistingExplanationDoesNotInvalidateFaultLines() {
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("RETURN node.title AS title, node.description AS description")))
                .bind(WORLD_ID).to("worldId")
                .bind(NODE_ID).to("nodeId")
                .fetch().one())
                .thenReturn(Optional.of(Map.of(
                        "title", "Outcome",
                        "description", "Description"
                )));
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("RETURN r.explanation AS explanation")))
                .bind(WORLD_ID).to("worldId")
                .bind(NODE_ID).to("nodeId")
                .fetch().one())
                .thenReturn(Optional.of(Map.of(
                        "explanation", "Because of the parent"
                )));

        assertEquals(
                Map.of("explanation", "Because of the parent"),
                worldService.getExistingExplanation(WORLD_ID, NODE_ID)
        );

        verify(neo4jClient, never()).query(argThat((String query) ->
                query != null
                        && (query.contains("world.faultLinesJson")
                            || query.contains("world.everydayObjectsJson"))
                        && query.contains("REMOVE")));
    }

    private Map<String, Object> sampleWorldRow() {
        return Map.of(
                "id", WORLD_ID,
                "name", "Test World",
                "rootRule", "Humans cannot feel pain",
                "createdAt", "2026-01-01T00:00:00Z",
                "updatedAt", "2026-01-01T00:00:00Z",
                "nodeCount", 1L
        );
    }

    private void stubWorldNodes() {
        when(neo4jClient.query(argThat((String query) ->
                query != null && query.contains("ORDER BY node.nodeType, node.title")))
                .bind(WORLD_ID).to("worldId")
                .fetch().all())
                .thenReturn(List.of(Map.of(
                        "id", NODE_ID,
                        "title", "Silent injuries",
                        "description", "Injuries can go unnoticed",
                        "domain", "Medicine",
                        "nodeType", "consequence"
                )));
    }

    private EverydayObjectsResponse sampleEverydayObjects() {
        return new EverydayObjectsResponse(List.of(
                new EverydayObjectsResponse.EverydayObject(
                        "Shoes",
                        "Shoes that watch for injuries.",
                        "They provided support.",
                        "They detect tissue damage.",
                        "Pain no longer warns people.",
                        List.of(NODE_ID)
                ),
                new EverydayObjectsResponse.EverydayObject(
                        "Medicine Cabinet",
                        "A cabinet that tracks dosage.",
                        "It stored medicine.",
                        "It verifies every dose.",
                        "Silent injuries demand monitoring.",
                        List.of(NODE_ID)
                ),
                new EverydayObjectsResponse.EverydayObject(
                        "Desk Chair",
                        "A chair that shifts pressure.",
                        "It supported seated work.",
                        "It prevents unnoticed strain.",
                        "Workers cannot feel harmful posture.",
                        List.of(NODE_ID)
                )
        ));
    }

    private FaultLineResponse sampleFaultLines() {
        FaultLineResponse.Faction factionA = new FaultLineResponse.Faction(
                "Keepers",
                "Preserve it",
                "Maintain order",
                "Rapid change",
                List.of(NODE_ID)
        );
        FaultLineResponse.Faction factionB = new FaultLineResponse.Faction(
                "Reformers",
                "Improve it",
                "Change society",
                "Stagnation",
                List.of(NODE_ID)
        );
        FaultLineResponse.FaultLine faultLine = new FaultLineResponse.FaultLine(
                "Old versus New",
                "Competing responses",
                factionA,
                factionB,
                "A disputed law"
        );
        return new FaultLineResponse(List.of(faultLine));
    }
}
