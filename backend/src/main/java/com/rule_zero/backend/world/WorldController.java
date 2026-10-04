package com.rule_zero.backend.world;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/worlds")
@CrossOrigin(origins = "http://localhost:5173")
public class WorldController {

    private final WorldService worldService;

    public WorldController(WorldService worldService) {
        this.worldService = worldService;
    }

    @PostMapping
    public CreateWorldResponse createWorld(
            @RequestBody CreateWorldRequest request
    ) {
        return worldService.createWorld(request.rule());
    }

    @GetMapping
    public List<WorldSummary> getWorlds() {
        return worldService.getWorlds();
    }

    @GetMapping("/{worldId}")
    public WorldSummary getWorld(@PathVariable String worldId) {
        return worldService.getWorld(worldId);
    }

    @PatchMapping("/{worldId}")
    public WorldSummary renameWorld(
            @PathVariable String worldId,
            @RequestBody RenameWorldRequest request
    ) {
        return worldService.renameWorld(worldId, request);
    }

    @PostMapping("/{worldId}/fork")
    public WorldSummary forkWorld(
            @PathVariable String worldId,
            @RequestBody(required = false) ForkWorldRequest request
    ) {
        return worldService.forkWorld(worldId, request);
    }

    @GetMapping("/{worldId}/compare/{otherWorldId}")
    public WorldComparisonResponse compareWorlds(
            @PathVariable String worldId,
            @PathVariable String otherWorldId
    ) {
        return worldService.compareWorlds(worldId, otherWorldId);
    }

    @DeleteMapping("/{worldId}")
    public void deleteWorld(@PathVariable String worldId) {
        worldService.deleteWorld(worldId);
    }

    @GetMapping("/{worldId}/graph")
    public GraphResponse getGraph(@PathVariable String worldId) {
        return worldService.getGraph(worldId);
    }

    @PostMapping("/{worldId}/nodes/{nodeId}/expand")
    public void expandNode(
            @PathVariable String worldId,
            @PathVariable String nodeId,
            @RequestBody(required = false) ExpandNodeRequest request
    ) {
        worldService.expandNode(
                worldId,
                nodeId,
                request == null ? null : request.direction()
        );
    }

    @GetMapping("/{worldId}/nodes/{nodeId}/why")
    public Map<String, String> explainWhy(
            @PathVariable String worldId,
            @PathVariable String nodeId
    ) {
        return worldService.explainWhy(worldId, nodeId);
    }

    @PostMapping("/{worldId}/nodes/{nodeId}/change")
    public void changeOutcome(
            @PathVariable String worldId,
            @PathVariable String nodeId,
            @RequestBody ChangeOutcomeRequest request
    ) {
        worldService.changeOutcome(worldId, nodeId, request);
    }

    @PostMapping("/{worldId}/nodes/{nodeId}/alternatives")
    public GeneratedAlternativesResponse generateOutcomeAlternatives(
            @PathVariable String worldId,
            @PathVariable String nodeId
    ) {
        return worldService.generateOutcomeAlternatives(worldId, nodeId);
    }

    @GetMapping("/{worldId}/nodes/{nodeId}/explanation")
    public Map<String, String> getExistingExplanation(
            @PathVariable String worldId,
            @PathVariable String nodeId
    ) {
        return worldService.getExistingExplanation(worldId, nodeId);
    }

    @PostMapping("/{worldId}/analysis/fault-lines")
    public FaultLineResponse findFaultLines(
            @PathVariable String worldId
    ) {
        return worldService.findFaultLines(worldId);
    }

    @PostMapping("/{worldId}/analysis/everyday-objects")
    public EverydayObjectsResponse findEverydayObjects(
            @PathVariable String worldId
    ) {
        return worldService.findEverydayObjects(worldId);
    }
}
