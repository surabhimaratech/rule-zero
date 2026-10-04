package com.rule_zero.backend.world;

import java.util.List;

public record EverydayObjectsResponse(
        List<EverydayObject> objects
) {
    public record EverydayObject(
            String name,
            String description,
            String before,
            String now,
            String whyItChanged,
            List<String> supportingNodeIds
    ) {}
}
