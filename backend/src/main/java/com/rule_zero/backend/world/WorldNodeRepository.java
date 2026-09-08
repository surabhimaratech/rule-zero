package com.rule_zero.backend.world;

import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface WorldNodeRepository
        extends Neo4jRepository<WorldNode, String> {
}