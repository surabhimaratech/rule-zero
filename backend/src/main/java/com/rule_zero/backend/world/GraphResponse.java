package com.rule_zero.backend.world;

import java.util.List;

public record GraphResponse(
        String worldId,
        List<GraphNode> nodes,
        List<GraphEdge> edges
) {

    public record GraphNode(
            String id,
            String title,
            String description,
            String domain,
            String nodeType
    ) {}

    public record GraphEdge(
            String id,
            String source,
            String target,
            String relationship
    ) {}
}