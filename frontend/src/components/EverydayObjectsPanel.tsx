import type { EverydayObject } from "../types";

type Props = {
  objects: EverydayObject[];
  selectedIndex: number | null;
  evidenceNodes: { id: string; title: string; domain: string }[];
  onSelect: (index: number | null) => void;
  onEvidenceFocus: (nodeId: string | null) => void;
  onEvidenceSelect: (nodeId: string) => void;
  onClose: () => void;
};

export default function EverydayObjectsPanel({
  objects,
  selectedIndex,
  evidenceNodes,
  onSelect,
  onEvidenceFocus,
  onEvidenceSelect,
  onClose,
}: Props) {
  const selectedObject = selectedIndex === null ? null : objects[selectedIndex];

  return (
    <aside className="everyday-objects-panel everyday-field-guide">
      <button className="fault-line-close" onClick={onClose} aria-label="Close Everyday Objects">
        ×
      </button>

      {!selectedObject ? (
        <>
          <header className="everyday-objects-header everyday-index-header">
            <div className="eyebrow">FIELD GUIDE / EVERYDAY OBJECTS</div>
            <h2>The ordinary, rewritten</h2>
            <p>
              The deepest changes to reality often become visible in the things
              people touch without thinking. Choose an object to examine.
            </p>
          </header>

          <div className="everyday-object-index">
            {objects.map((object, index) => (
              <button key={`${object.name}-${index}`} onClick={() => onSelect(index)}>
                <span className="everyday-object-index-number">0{index + 1}</span>
                <span className="everyday-object-index-copy">
                  <strong>{object.name}</strong>
                  <small>{object.description}</small>
                  <i>{object.before} → {object.now}</i>
                </span>
                <span className="everyday-object-index-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <article className="everyday-object-article">
          <button className="fault-line-back" onClick={() => onSelect(null)}>
            ← All everyday objects
          </button>

          <header>
            <div className="eyebrow">
              EVERYDAY OBJECTS / {String((selectedIndex ?? 0) + 1).padStart(2, "0")} OF{" "}
              {String(objects.length).padStart(2, "0")}
            </div>
            <span className="everyday-object-glyph" aria-hidden="true">◯</span>
            <h2>{selectedObject.name}</h2>
            <p>{selectedObject.description}</p>
          </header>

          <section className="everyday-object-transformation" aria-label="Object transformation">
            <div>
              <span>BEFORE THIS WORLD</span>
              <p>{selectedObject.before}</p>
            </div>
            <i aria-hidden="true">BECOMES</i>
            <div>
              <span>IN THIS REALITY</span>
              <p>{selectedObject.now}</p>
            </div>
          </section>

          <section className="everyday-object-cause">
            <span>WHY IT CHANGED</span>
            <p>{selectedObject.whyItChanged}</p>
          </section>

          <section className="fault-line-evidence everyday-object-evidence">
            <div>
              <span>CAUSAL PROVENANCE</span>
              <p>The consequences that transformed this object.</p>
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
      )}
    </aside>
  );
}
