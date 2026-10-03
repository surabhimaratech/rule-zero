import type { FaultLine } from "../types";

type Props = {
  faultLines: FaultLine[];
  onClose: () => void;
};

export default function FaultLinePanel({
  faultLines,
  onClose,
}: Props) {
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
        <div className="eyebrow">
          WORLD ANALYSIS / FAULT LINES
        </div>

        <h2>Ideological Fault Lines</h2>

        <p>
          These conflicts emerge from the world as it currently
          exists.
        </p>
      </div>

      <div className="fault-line-list">
        {faultLines.map((faultLine, index) => (
          <article
            className="fault-line-card"
            key={`${faultLine.title}-${index}`}
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

                <details>
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

                <details>
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