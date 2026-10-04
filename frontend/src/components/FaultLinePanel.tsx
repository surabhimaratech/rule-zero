import type { FaultLine } from "../types";

type Props = {
  faultLines: FaultLine[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
};

export default function FaultLinePanel({
  faultLines,
  selectedIndex,
  onSelect,
  expanded,
  onExpandedChange,
  onClose,
}: Props) {
  if (!expanded) {
    return (
      <aside className="fault-line-lens fault-line-index">
        <button
          className="fault-line-close"
          onClick={onClose}
          aria-label="Close Fault Lines"
        >
          ×
        </button>

        <div className="fault-line-index-heading">
          <div className="eyebrow">FIELD GUIDE / FAULT LINES</div>
          <h2>Where this world divides</h2>
          <p>
            Every changed reality creates winners, dissenters, and beliefs that
            cannot peacefully coexist. Choose a division to investigate.
          </p>
        </div>

        <div className="fault-line-index-list" aria-label="Fault line chapters">
          {faultLines.map((faultLine, index) => (
            <button
              key={`${faultLine.title}-${index}`}
              onClick={() => {
                onSelect(index);
                onExpandedChange(true);
              }}
            >
              <span className="fault-line-index-number">0{index + 1}</span>
              <span className="fault-line-index-copy">
                <strong>{faultLine.title}</strong>
                <small>{faultLine.tension}</small>
                <i>
                  {faultLine.factionA.name} <b>versus</b> {faultLine.factionB.name}
                </i>
              </span>
              <span className="fault-line-index-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="fault-line-panel">
      <button
        className="fault-line-close"
        onClick={onClose}
        aria-label="Close fault line analysis"
      >
        ×
      </button>

      <div className="fault-line-header">
        <button
          className="fault-line-back"
          onClick={() => onExpandedChange(false)}
        >
          ← Back to world lens
        </button>

        <div className="eyebrow">
          WORLD ANALYSIS / FAULT LINES
        </div>

        <h2>Ideological Fault Lines</h2>

        <p>
          These conflicts emerge from the world as it currently
          exists.
        </p>

        <div className="fault-line-highlight-key">
          <span className="faction-a-key">Faction A</span>
          <span className="faction-b-key">Faction B</span>
          <small>Click a card to highlight its supporting nodes.</small>
        </div>
      </div>

      <div className="fault-line-list">
        {faultLines.map((faultLine, index) => (
          <article
            className={`fault-line-card ${
              selectedIndex === index ? "selected" : ""
            }`}
            key={`${faultLine.title}-${index}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedIndex === index}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(index);
              }
            }}
          >
            <div className="fault-line-number">
              0{index + 1}
            </div>

            <h3>{faultLine.title}</h3>

            <p className="fault-line-tension">
              {faultLine.tension}
            </p>

            <div className="fault-line-factions">
              <section className="fault-line-faction faction-a">
                <span className="faction-label">
                  FACTION A
                </span>

                <h4>{faultLine.factionA.name}</h4>

                <p>{faultLine.factionA.belief}</p>

                <details
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <summary>View details</summary>

                  <div className="faction-details">
                    <p>
                      <strong>Goal:</strong>{" "}
                      {faultLine.factionA.goal}
                    </p>

                    <p>
                      <strong>Fear:</strong>{" "}
                      {faultLine.factionA.fear}
                    </p>
                  </div>
                </details>
              </section>

              <div className="fault-line-versus">
                VS
              </div>

              <section className="fault-line-faction faction-b">
                <span className="faction-label">
                  FACTION B
                </span>

                <h4>{faultLine.factionB.name}</h4>

                <p>{faultLine.factionB.belief}</p>

                <details
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <summary>View details</summary>

                  <div className="faction-details">
                    <p>
                      <strong>Goal:</strong>{" "}
                      {faultLine.factionB.goal}
                    </p>

                    <p>
                      <strong>Fear:</strong>{" "}
                      {faultLine.factionB.fear}
                    </p>
                  </div>
                </details>
              </section>
            </div>

            <div className="fault-line-flashpoint">
              <span>LIKELY FLASHPOINT</span>
              <p>{faultLine.flashpoint}</p>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
