import type { ComparisonNode, WorldComparison } from "../types";

type Props = {
  worlds: WorldComparison;
  onClose: () => void;
};

function NodeCard({ node, tone }: { node: ComparisonNode; tone: string }) {
  return (
    <div className={`comparison-node ${tone}`}>
      <div className="comparison-node-meta">
        <span>{node.domain}</span>
        {node.parentTitle && <small>After {node.parentTitle}</small>}
      </div>
      <strong>{node.title}</strong>
      <p>{node.description}</p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`comparison-section ${className}`}>
      <div className="comparison-section-heading">
        <h3>{title}</h3>
        <span>{count}</span>
      </div>
      {children}
    </section>
  );
}

export default function WorldComparison({ worlds, onClose }: Props) {
  return (
    <div className="comparison-backdrop" onClick={onClose}>
      <section
        className="comparison-view"
        aria-label="World comparison"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="comparison-header">
          <div>
            <div className="eyebrow">TIMELINE ANALYSIS</div>
            <h2>Compare worlds</h2>
            <div className="comparison-world-names">
              <strong>{worlds.worldA.name}</strong>
              <span>vs</span>
              <strong>{worlds.worldB.name}</strong>
            </div>
          </div>
          <button className="library-close" onClick={onClose}>×</button>
        </header>

        <div className="comparison-summary">
          <div className="comparison-stat unchanged-stat">
            <strong>{worlds.summary.unchanged}</strong>
            <span>unchanged</span>
          </div>
          <div className="comparison-stat changed-stat">
            <strong>{worlds.summary.changed}</strong>
            <span>changed</span>
          </div>
          <div className="comparison-stat original-stat">
            <strong>{worlds.summary.onlyInA}</strong>
            <span>only in original</span>
          </div>
          <div className="comparison-stat fork-stat">
            <strong>{worlds.summary.onlyInB}</strong>
            <span>only in fork</span>
          </div>
        </div>

        <div className="comparison-results">
          <Section title="Changed outcomes" count={worlds.summary.changed} className="changed-section">
            {worlds.changedNodes.length === 0 ? (
              <p className="comparison-empty">No paired outcomes changed.</p>
            ) : (
              <div className="changed-list">
                {worlds.changedNodes.map((change, index) => (
                  <div className="changed-pair" key={`${change.worldA.title}-${index}`}>
                    <NodeCard node={change.worldA} tone="comparison-original" />
                    <div className="changed-arrow">↓ changed to</div>
                    <NodeCard node={change.worldB} tone="comparison-fork" />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="comparison-columns">
            <Section title="Only in original" count={worlds.summary.onlyInA} className="original-section">
              {worlds.onlyInA.length === 0 ? (
                <p className="comparison-empty">No outcomes disappeared.</p>
              ) : (
                worlds.onlyInA.map((node, index) => (
                  <NodeCard key={`${node.title}-${index}`} node={node} tone="comparison-original" />
                ))
              )}
            </Section>
            <Section title="Only in fork" count={worlds.summary.onlyInB} className="fork-section">
              {worlds.onlyInB.length === 0 ? (
                <p className="comparison-empty">No new outcomes appeared.</p>
              ) : (
                worlds.onlyInB.map((node, index) => (
                  <NodeCard key={`${node.title}-${index}`} node={node} tone="comparison-fork" />
                ))
              )}
            </Section>
          </div>

          <details className="comparison-unchanged">
            <summary>Unchanged outcomes <span>{worlds.summary.unchanged}</span></summary>
            <div className="unchanged-list">
              {worlds.unchangedNodes.map((node, index) => (
                <NodeCard key={`${node.title}-${index}`} node={node} tone="comparison-neutral" />
              ))}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
