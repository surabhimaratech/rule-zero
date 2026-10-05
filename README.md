# Rule Zero

A causal world simulator for exploring how one change to reality reshapes everything downstream.

Rule Zero lets a user define a foundational rule for a fictional world. OpenRouter generates plausible consequences, which are stored and displayed as an interactive causal graph. Users can expand frontier nodes, trace causal paths, inspect why a consequence happened, generate alternate outcomes, or rewrite an outcome and preview the affected downstream branch.

Worlds are persisted independently in Neo4j, so users can return to a simulated universe later without losing its expanded branches or explanations.

## Key features

- Define a foundational world rule
- AI-generated first-order consequences
- Expandable causal branches
- Directed expansion through "What breaks?", "Who benefits?", and
  "How does society adapt?"
- Frontier and established-node states
- Causal breadcrumbs and relationship labels
- A paced world-ignition reveal for newly simulated realities
- An origin-focused exploration camera with local branch framing
- Readable causal cards and causal-depth regions
- Persistent causal explanations
- Alternate outcomes
- Outcome rewrite previews
- Downstream invalidation when assumptions change
- AI-generated ideological fault lines
- Persistent fault-line analysis with automatic cache invalidation
- A Field Guide reading mode for graph-grounded world analysis
- Editorial Fault Line chapters with supporting causal evidence
- Trace Causes and immersive Enter Conflict investigation modes

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

Each `World` owns its `WorldNode` records through `HAS_NODE` relationships. Causal links remain `CAUSES` relationships between nodes in the same world.

## Exploration model

Rule Zero deliberately avoids presenting the world as a static database. A new
reality ignites from its foundational truth and reveals first-order effects in
sequence. The opening camera frames the origin and immediate consequences while
deeper branches extend beyond the viewport. Selecting or expanding a consequence
moves the camera into that local causal neighborhood, and **Return to origin**
restores the opening frame.

Unexplored consequences offer three causal directions rather than a generic
continuation. Fault Lines reuse the graph as a conflict stage, separating the
evidence behind opposing factions and projecting their likely flashpoint.

## Field Guide

The Field Guide is the analysis layer of a simulated world. It deliberately
stays beside the causal graph instead of becoming a separate report or lore
database. The chapter bar currently exposes **World**, **Fault Lines**, and
**Everyday Objects**.

Fault Lines opens as a chapter index. Entering a division reveals one editorial
conflict page at a time: its central tension, the two incompatible belief
systems, what each faction seeks and fears, and the flashpoint most likely to
turn the disagreement into a story. Causal evidence links back to the exact
nodes that produced the conflict. **Trace causes** frames those nodes and their
ancestry; **Enter conflict** expands the graph into a full-width conflict map.

Everyday Objects opens as a cabinet of altered things. Each object has a focused
artifact page showing what it was before the foundational rule, what it becomes
in the simulated reality, and why it changed. Its causal provenance links back
to the exact consequences responsible for the transformation. New Field Guide
chapters should follow this principle: each needs a distinct, graph-grounded
interaction rather than a generic generated-results panel.

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
export NEO4J_PASSWORD="your-neo4j-password"
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

The `My Worlds` library lists saved universes and supports opening, renaming, forking, comparing, and deleting them. The active world ID is the only application state stored in browser local storage; Neo4j remains the source of truth for every graph, explanation, and cached world analysis.

### Existing local graph

The multi-world schema does not automatically wrap an older unscoped graph. For this early V1, reset the local Neo4j Desktop database once, or remove the old `WorldNode` data before creating your first world with the new version. New worlds do not delete or affect one another.

## How it works

Consequences are stored as Neo4j nodes connected by `CAUSES` relationships. Expanding a frontier node adds the next causal step. Selecting a node reveals its causal breadcrumb and relationship context. Rewriting an outcome removes its downstream descendants because they were based on the previous assumption, while preserving the selected node's incoming relationship.

Fault Lines analysis evaluates the current world graph and identifies opposing factions grounded in existing node IDs. The serialized analysis is cached on the owning `World` node as `faultLinesJson` with `faultLinesGeneratedAt`. Expanding the graph or rewriting an outcome invalidates that cache; read-only graph and explanation actions do not. Selecting a fault line highlights the nodes supporting Faction A and Faction B with distinct colors.

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
