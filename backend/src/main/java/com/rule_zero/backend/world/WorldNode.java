package com.rule_zero.backend.world;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("WorldNode")
public class WorldNode {

    @Id
    private String id;

    private String title;
    private String description;
    private String domain;
    private String nodeType;

    public WorldNode() {}

    public WorldNode(
            String id,
            String title,
            String description,
            String domain,
            String nodeType
    ) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.domain = domain;
        this.nodeType = nodeType;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getDomain() {
        return domain;
    }

    public String getNodeType() {
        return nodeType;
    }
}