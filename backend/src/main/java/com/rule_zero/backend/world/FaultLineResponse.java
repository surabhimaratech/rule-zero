package com.rule_zero.backend.world;

import java.util.List;

public record FaultLineResponse(
        List<FaultLine> faultLines
) {
    public record FaultLine(
            String title,
            String tension,
            Faction factionA,
            Faction factionB,
            String flashpoint
    ) {}

    public record Faction(
            String name,
            String belief,
            String goal,
            String fear,
            List<String> supportingNodeIds
    ) {}
}