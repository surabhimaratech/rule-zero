package com.rule_zero.backend.world;

import java.util.List;

public record WorldComparisonResponse(
        ComparedWorld worldA,
        ComparedWorld worldB,
        ComparisonSummary summary,
        List<ComparisonNode> unchangedNodes,
        List<ChangedNode> changedNodes,
        List<ComparisonNode> onlyInA,
        List<ComparisonNode> onlyInB
) {}