# Rule Zero

A causal world simulator for exploring how one change to reality reshapes everything downstream.

Rule Zero lets a user define a foundational rule for a fictional world. OpenRouter generates plausible consequences, which are stored and displayed as an interactive causal graph. Users can expand branches, inspect why a consequence happened, generate alternate outcomes, or replace an outcome manually.

## Key features

- Define a foundational world rule
- AI-generated first-order consequences
- Expandable causal branches
- Persistent causal explanations
- Alternate outcomes
- Manual outcome override
- Downstream invalidation when assumptions change

## Tech stack

- React
- TypeScript
- React Flow
- Dagre
- Spring Boot
- Java 17
- Neo4j
- OpenRouter

## Architecture

```text
React -> Spring Boot -> OpenRouter
                 |
                 -> Neo4j
```

The frontend calls the Spring Boot API. The backend uses OpenRouter for generation and Neo4j for graph persistence.

## Local setup

### Neo4j Desktop

Install and start a local Neo4j database in Neo4j Desktop. The default backend settings expect:

- URI: `bolt://localhost:7687`
- Username: `neo4j`
- Password: set through `NEO4J_PASSWORD`

The URI, username, and password are configured with `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD`. Do not commit local environment files or real credentials.

### Backend

Set the required OpenRouter credential and start Spring Boot:

```bash
cd backend
export OPENROUTER_API_KEY="your-key"
./mvnw spring-boot:run
```

The backend runs at `http://localhost:8080`.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## How it works

Consequences are stored as Neo4j nodes connected by `CAUSES` relationships. Expanding a node adds the next causal step. Rewriting an outcome removes its downstream descendants because they were based on the previous assumption, while preserving the selected node's incoming relationship.

## Build sanity

Backend:

```bash
cd backend
./mvnw clean test
```

Frontend:

```bash
cd frontend
npm run build
```

## Current status

Rule Zero is an early but functional V1. It is intended for local exploration and experimentation, not as a production-ready deployment.
