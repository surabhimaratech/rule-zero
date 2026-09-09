import { startTransition, useCallback, useEffect, useState } from "react";
import WorldGraph from "./components/WorldGraph";
import WorldLibrary from "./components/WorldLibrary";
import WorldComparison from "./components/WorldComparison";
import type { WorldComparison as WorldComparisonResult, WorldSummary } from "./types";
import "./App.css";

const WORLDS_API = "http://localhost:8080/api/worlds";
const CURRENT_WORLD_KEY = "rule-zero-current-world";

export default function App() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [currentWorldId, setCurrentWorldId] = useState<string | null>(
    () => localStorage.getItem(CURRENT_WORLD_KEY)
  );
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [forkTarget, setForkTarget] = useState<WorldSummary | null>(null);
  const [forkName, setForkName] = useState("");
  const [isForking, setIsForking] = useState(false);
  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<WorldComparisonResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const refreshWorlds = useCallback(async () => {
    const response = await fetch(WORLDS_API);

    if (!response.ok) {
      throw new Error("Failed to load worlds");
    }

    const loadedWorlds: WorldSummary[] = await response.json();
    startTransition(() => {
      setWorlds(loadedWorlds);
    });

    const storedWorldId = localStorage.getItem(CURRENT_WORLD_KEY);
    if (
      storedWorldId &&
      !loadedWorlds.some((world) => world.id === storedWorldId)
    ) {
      localStorage.removeItem(CURRENT_WORLD_KEY);
      startTransition(() => {
        setCurrentWorldId(null);
      });
    }
  }, []);

  useEffect(() => {
    refreshWorlds().catch((error) => {
      console.error(error);
    });
  }, [refreshWorlds]);

  function openWorld(worldId: string) {
    localStorage.setItem(CURRENT_WORLD_KEY, worldId);
    setCurrentWorldId(worldId);
    setIsLibraryOpen(false);
  }

  function startNewWorld() {
    localStorage.removeItem(CURRENT_WORLD_KEY);
    setCurrentWorldId(null);
    setIsLibraryOpen(false);
  }

  function beginFork(world: WorldSummary) {
    setForkTarget(world);
    setForkName(`${world.name} - Fork`);
    setIsLibraryOpen(false);
  }

  function beginCompare(world: WorldSummary) {
    const sourceId = world.forkedFromWorldId && worlds.some(
      (candidate) => candidate.id === world.forkedFromWorldId
    )
      ? world.forkedFromWorldId
      : currentWorldId && currentWorldId !== world.id
        ? currentWorldId
        : worlds.find((candidate) => candidate.id !== world.id)?.id ?? "";

    setCompareAId(sourceId);
    setCompareBId(world.id);
    setComparison(null);
    setCompareError(null);
    setIsLibraryOpen(false);
    setIsCompareOpen(true);
  }

  async function compareWorlds() {
    if (!compareAId || !compareBId || compareAId === compareBId || isComparing) {
      return;
    }

    setIsComparing(true);
    setCompareError(null);

    try {
      const response = await fetch(
        `${WORLDS_API}/${compareAId}/compare/${compareBId}`
      );

      if (!response.ok) {
        throw new Error("Failed to compare worlds");
      }

      const result: WorldComparisonResult = await response.json();
      setComparison(result);
    } catch (error) {
      console.error(error);
      setCompareError("Could not compare these worlds.");
    } finally {
      setIsComparing(false);
    }
  }

  function closeComparison() {
    setIsCompareOpen(false);
    setComparison(null);
    setCompareError(null);
  }

  async function createFork() {
    if (!forkTarget || isForking) {
      return;
    }

    setIsForking(true);

    try {
      const response = await fetch(`${WORLDS_API}/${forkTarget.id}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: forkName.trim() || undefined }),
      });

      if (!response.ok) {
        throw new Error("Failed to fork world");
      }

      const forkedWorld: WorldSummary = await response.json();
      setForkTarget(null);
      setForkName("");
      openWorld(forkedWorld.id);
      await refreshWorlds();
    } catch (error) {
      console.error(error);
    } finally {
      setIsForking(false);
    }
  }

  async function handleWorldCreated(worldId: string) {
    openWorld(worldId);
    await refreshWorlds();
  }

  async function renameWorld(world: WorldSummary) {
    const name = window.prompt("Name this world", world.name)?.trim();

    if (!name || name === world.name) {
      return;
    }

    const response = await fetch(`${WORLDS_API}/${world.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to rename world");
    }

    await refreshWorlds();
  }

  async function deleteWorld(world: WorldSummary) {
    if (!window.confirm(`Delete "${world.name}"?`)) {
      return;
    }

    const response = await fetch(`${WORLDS_API}/${world.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete world");
    }

    if (currentWorldId === world.id) {
      startNewWorld();
    }

    await refreshWorlds();
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="eyebrow">CAUSAL WORLD SIMULATOR</div>
          <h1>RULE ZERO</h1>
          <p>Set the rules. Trace the consequences.</p>
        </div>

        <button
          className="worlds-trigger"
          onClick={() => setIsLibraryOpen(true)}
        >
          <span className="worlds-trigger-dot" />
          My Worlds
          <span className="world-count">{worlds.length}</span>
        </button>
      </header>

      <WorldGraph
        worldId={currentWorldId}
        onWorldCreated={handleWorldCreated}
      />

      {isLibraryOpen && (
        <WorldLibrary
          worlds={worlds}
          currentWorldId={currentWorldId}
          onOpen={openWorld}
          onRename={(world) => {
            void renameWorld(world).catch(console.error);
          }}
          onDelete={(world) => {
            void deleteWorld(world).catch(console.error);
          }}
          onFork={beginFork}
          onCompare={beginCompare}
          onNew={startNewWorld}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {forkTarget && (
        <div className="fork-modal-backdrop">
          <section className="fork-modal" aria-label="Fork world">
            <div className="eyebrow">NEW TIMELINE</div>
            <h2>Fork this world?</h2>
            <p>
              Create a new timeline from the current state of this world.
              The original will remain unchanged.
            </p>
            <label htmlFor="fork-world-name">Name</label>
            <input
              id="fork-world-name"
              value={forkName}
              onChange={(event) => setForkName(event.target.value)}
              disabled={isForking}
            />
            <div className="fork-modal-actions">
              <button
                onClick={() => setForkTarget(null)}
                disabled={isForking}
              >
                Cancel
              </button>
              <button
                className="primary-detail-action"
                onClick={() => void createFork()}
                disabled={isForking}
              >
                {isForking ? "Creating fork..." : "Create fork"}
              </button>
            </div>
          </section>
        </div>
      )}

      {isCompareOpen && !comparison && (
        <div className="comparison-picker-backdrop" onClick={closeComparison}>
          <section
            className="comparison-picker"
            aria-label="Compare worlds"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="eyebrow">TIMELINE ANALYSIS</div>
            <h2>Compare worlds</h2>
            <p>Choose two possible realities to see where their causal paths diverge.</p>
            <label htmlFor="compare-world-a">World A</label>
            <select
              id="compare-world-a"
              value={compareAId}
              onChange={(event) => setCompareAId(event.target.value)}
            >
              <option value="">Select a world</option>
              {worlds.map((world) => (
                <option key={world.id} value={world.id}>{world.name}</option>
              ))}
            </select>
            <label htmlFor="compare-world-b">World B</label>
            <select
              id="compare-world-b"
              value={compareBId}
              onChange={(event) => setCompareBId(event.target.value)}
            >
              <option value="">Select a world</option>
              {worlds.map((world) => (
                <option key={world.id} value={world.id}>{world.name}</option>
              ))}
            </select>
            {compareError && <p className="comparison-error">{compareError}</p>}
            <div className="fork-modal-actions">
              <button onClick={closeComparison} disabled={isComparing}>Cancel</button>
              <button
                className="primary-detail-action"
                onClick={() => void compareWorlds()}
                disabled={isComparing || !compareAId || !compareBId || compareAId === compareBId}
              >
                {isComparing ? "Comparing..." : "Compare worlds"}
              </button>
            </div>
          </section>
        </div>
      )}

      {comparison && (
        <WorldComparison worlds={comparison} onClose={closeComparison} />
      )}
    </main>
  );
}
