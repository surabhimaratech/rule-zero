import type { EverydayObject } from "../types";

type Props = {
  objects: EverydayObject[];
  onClose: () => void;
};

export default function EverydayObjectsPanel({ objects, onClose }: Props) {
  return (
    <aside className="everyday-objects-panel">
      <button
        className="fault-line-close"
        onClick={onClose}
        aria-label="Close everyday objects analysis"
      >
        ×
      </button>

      <header className="everyday-objects-header">
        <div className="eyebrow">WORLD ANALYSIS / EVERYDAY OBJECTS</div>
        <h2>The ordinary, rewritten</h2>
        <p>
          Familiar things reshaped by the consequences of this world.
        </p>
      </header>

      <div className="everyday-objects-list">
        {objects.map((object, index) => (
          <article
            className="everyday-object-card"
            key={`${object.name}-${index}`}
          >
            <div className="everyday-object-number">0{index + 1}</div>
            <h3>{object.name}</h3>
            <p className="everyday-object-description">
              {object.description}
            </p>

            <div className="everyday-object-shift">
              <section>
                <span>BEFORE</span>
                <p>{object.before}</p>
              </section>
              <section>
                <span>NOW</span>
                <p>{object.now}</p>
              </section>
            </div>

            <div className="everyday-object-reason">
              <span>WHY IT CHANGED</span>
              <p>{object.whyItChanged}</p>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
