package com.rule_zero.backend.world;

public record ForkRelationship(
        String sourceId,
        String targetId,
        String explanation
) {}