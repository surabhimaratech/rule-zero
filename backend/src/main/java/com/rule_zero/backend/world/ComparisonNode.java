package com.rule_zero.backend.world;

public record ComparisonNode(
        String title,
        String description,
        String domain,
        String nodeType,
        String parentTitle
) {}