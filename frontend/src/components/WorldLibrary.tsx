import type { WorldSummary } from "../types";

type Props = {
  worlds: WorldSummary[];
  currentWorldId: string | null;
  onOpen: (worldId: string) => void;
  onRename: (world: WorldSummary) => void;
  onDelete: (world: WorldSummary) => void;
  onFork: (world: WorldSummary) => void;
  onCompare: (world: WorldSummary) => void;
  onNew: () => void;
  onClose: () => void;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function WorldLibrary({
  worlds,
  currentWorldId,
  onOpen,
  onRename,
  onDelete,
  onFork,
  onCompare,
  onNew,
  onClose,
}: Props) {
  return (
    <div className="world-library-backdrop" onClick={onClose}>
      <section
        className="world-library"
        aria-label="My Worlds"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="world-library-header">
          <div>
            <div className="eyebrow">ARCHIVE / WORLDS</div>
            <h2>My Worlds</h2>
          </div>
          <button className="library-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="world-library-list">
          {worlds.length === 0 ? (
            <div className="world-library-empty">
              <span className="empty-orbit" />
              <strong>No worlds yet</strong>
              <p>Define a rule to create your first universe.</p>
            </div>
          ) : (
            worlds.map((world) => (
              <article
                className={`world-library-entry${
                  currentWorldId === world.id ? " current" : ""
                }`}
                key={world.id}
              >
                <div className="world-entry-mark">{world.nodeCount}</div>
                <div className="world-entry-copy">
                  <strong>{world.name}</strong>
                  <span>{world.rootRule}</span>
                  <small>Updated {formatUpdatedAt(world.updatedAt)}</small>
                </div>
                <div className="world-entry-actions">
                  <button onClick={() => onOpen(world.id)}>Open</button>
                  <button onClick={() => onRename(world)}>Rename</button>
                  <button onClick={() => onFork(world)}>Fork</button>
                  <button onClick={() => onCompare(world)}>Compare</button>
                  <button className="world-delete" onClick={() => onDelete(world)}>
                    Delete
                  </button>
                </div>
                {world.forkedFromWorldId && (
                  <div className="world-entry-provenance">
                    Forked timeline
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <button className="new-world-button" onClick={onNew}>
          <span>+</span> New world
        </button>
      </section>
    </div>
  );
}
