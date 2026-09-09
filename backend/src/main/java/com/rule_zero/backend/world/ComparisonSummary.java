package com.rule_zero.backend.world;

public record ComparisonSummary(
        int unchanged,
        int changed,
        int onlyInA,
        int onlyInB
) {}