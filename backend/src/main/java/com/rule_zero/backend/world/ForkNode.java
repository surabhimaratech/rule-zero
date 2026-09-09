package com.rule_zero.backend.world;

public record ForkNode(
        String id,
        String title,
        String description,
        String domain,
        String nodeType
) {}