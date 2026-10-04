import type { FaultLine } from "../types";

type Props = {
  faultLines: FaultLine[];
  evidenceNodes: { id: string; title: string; domain: string }[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onEvidenceFocus: (nodeId: string | null) => void;
  onEvidenceSelect: (nodeId: string) => void;
  onClose: () => void;
};

export default function FaultLinePanel({
  faultLines,
  evidenceNodes,
  selectedIndex,
  onSelect,
  expanded,
  onExpandedChange,
  onEvidenceFocus,
  onEvidenceSelect,
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

  const faultLine = selectedIndex === null ? null : faultLines[selectedIndex];

  if (!faultLine) {
    return null;
  }

  const chapterNumber = (selectedIndex ?? 0) + 1;

  return (
    <aside className="fault-line-panel fault-line-article">
      <button
        className="fault-line-close"
        onClick={onClose}
        aria-label="Close Fault Lines"
      >
        ×
      </button>

      <article>
        <button className="fault-line-back" onClick={() => onExpandedChange(false)}>
          ← All fault lines
        </button>

        <header className="fault-line-article-header">
          <div className="eyebrow">
            FAULT LINES / {String(chapterNumber).padStart(2, "0")} OF{" "}
            {String(faultLines.length).padStart(2, "0")}
          </div>
          <h2>{faultLine.title}</h2>
          <p>{faultLine.tension}</p>
        </header>

        <div className="fault-line-article-divider" aria-hidden="true">
          <span>THE DIVIDE</span>
        </div>

        <div className="fault-line-article-factions">
          <section className="fault-line-article-faction faction-a">
            <span className="faction-label">FACTION A</span>
            <h3>{faultLine.factionA.name}</h3>
            <blockquote>{faultLine.factionA.belief}</blockquote>
            <dl>
              <div>
                <dt>Seeks</dt>
                <dd>{faultLine.factionA.goal}</dd>
              </div>
              <div>
                <dt>Fears</dt>
                <dd>{faultLine.factionA.fear}</dd>
              </div>
            </dl>
          </section>

          <section className="fault-line-article-faction faction-b">
            <span className="faction-label">FACTION B</span>
            <h3>{faultLine.factionB.name}</h3>
            <blockquote>{faultLine.factionB.belief}</blockquote>
            <dl>
              <div>
                <dt>Seeks</dt>
                <dd>{faultLine.factionB.goal}</dd>
              </div>
              <div>
                <dt>Fears</dt>
                <dd>{faultLine.factionB.fear}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="fault-line-article-flashpoint">
          <span>PROJECTED FLASHPOINT</span>
          <p>{faultLine.flashpoint}</p>
        </section>

        <section className="fault-line-evidence">
          <div>
            <span>CAUSAL EVIDENCE</span>
            <p>Consequences in the world that give this conflict its power.</p>
          </div>
          <div className="fault-line-evidence-list">
            {evidenceNodes.map((node) => (
              <button
                key={node.id}
                onMouseEnter={() => onEvidenceFocus(node.id)}
                onMouseLeave={() => onEvidenceFocus(null)}
                onFocus={() => onEvidenceFocus(node.id)}
                onBlur={() => onEvidenceFocus(null)}
                onClick={() => onEvidenceSelect(node.id)}
              >
                <small>{node.domain}</small>
                <strong>{node.title}</strong>
                <span aria-hidden="true">Locate →</span>
              </button>
            ))}
          </div>
        </section>
      </article>
    </aside>
  );
}
