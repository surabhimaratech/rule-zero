package com.rule_zero.backend.world;

public record WorldSummary(
        String id,
        String name,
        String rootRule,
        String createdAt,
        String updatedAt,
        long nodeCount,
        String forkedFromWorldId,
        String forkedAt
) {}