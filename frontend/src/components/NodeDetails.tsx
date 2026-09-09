import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import type {
  OutcomeAlternative,
  WorldNodeData,
} from "../types";

type Props = {
  node: Node<WorldNodeData>;
  onClose: () => void;
  onExpand: (nodeId: string) => Promise<void>;
  onExplain: (nodeId: string) => Promise<string>;
  onLoadExplanation: (nodeId: string) => Promise<string | null>;
  onChangeOutcome: (
    nodeId: string,
    title: string
  ) => Promise<void>;
  onLoadAlternatives: (
    nodeId: string
  ) => Promise<OutcomeAlternative[]>;
  isExpanding: boolean;
  hasChildren: boolean;
};

export default function NodeDetails({
  node,
  onClose,
  onExpand,
  onExplain,
  onLoadExplanation,
  onChangeOutcome,
  onLoadAlternatives,
  isExpanding,
  hasChildren,
}: Props) {
  const [explanation, setExplanation] =
    useState<string | null>(null);

  const [isExplaining, setIsExplaining] =
    useState(false);

  const [isLoadingExplanation, setIsLoadingExplanation] =
    useState(false);

  const [explainError, setExplainError] =
    useState<string | null>(null);

  const [isEditing, setIsEditing] =
    useState(false);

  const [editTitle, setEditTitle] =
    useState(node.data.title);

  const [isSaving, setIsSaving] =
    useState(false);

  const [changeError, setChangeError] =
    useState<string | null>(null);

  const [replacementMode, setReplacementMode] =
    useState<"alternatives" | "manual">("alternatives");

  const [alternatives, setAlternatives] =
    useState<OutcomeAlternative[]>([]);

  const [selectedAlternative, setSelectedAlternative] =
    useState<OutcomeAlternative | null>(null);

  const [isLoadingAlternatives, setIsLoadingAlternatives] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExplanation() {
      setExplanation(null);
      setExplainError(null);

      if (node.data.nodeType === "rule") {
        return;
      }

      setIsLoadingExplanation(true);

      try {
        const existing =
          await onLoadExplanation(node.id);

        if (!cancelled) {
          setExplanation(existing);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsLoadingExplanation(false);
        }
      }
    }

    void loadExplanation();

    return () => {
      cancelled = true;
    };
  }, [
    node.id,
    node.data.nodeType,
    onLoadExplanation,
  ]);

  async function handleExplain() {
    if (isExplaining) {
      return;
    }

    setIsExplaining(true);
    setExplainError(null);

    try {
      const result = await onExplain(node.id);
      setExplanation(result);
    } catch (error) {
      console.error(error);
      setExplainError(
        "Could not explain this causal link."
      );
    } finally {
      setIsExplaining(false);
    }
  }

  async function handleSaveChange() {
    const title =
      replacementMode === "alternatives"
        ? selectedAlternative?.title.trim() ?? ""
        : editTitle.trim();

    if (!title) {
      setChangeError(
        replacementMode === "alternatives"
          ? "Select an alternative to continue."
          : "Outcome title is required."
      );
      return;
    }

    setIsSaving(true);
    setChangeError(null);

    try {
      await onChangeOutcome(
        node.id,
        title
      );

      setExplanation(null);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      setChangeError(
        "Could not apply this change."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSuggestAlternatives() {
    if (isLoadingAlternatives || isSaving) {
      return;
    }

    setIsLoadingAlternatives(true);
    setChangeError(null);

    try {
      const generated =
        await onLoadAlternatives(node.id);
      setAlternatives(generated);
      setSelectedAlternative(null);
    } catch (error) {
      console.error(error);
      setChangeError(
        "Could not explore alternative outcomes."
      );
    } finally {
      setIsLoadingAlternatives(false);
    }
  }

  function cancelEditing() {
    setEditTitle(node.data.title);

    setChangeError(null);
    setIsEditing(false);
    setSelectedAlternative(null);
  }

  const isRoot =
    node.data.nodeType === "rule";
  const domainClass = node.data.domain
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <aside className="node-details">
      <button
        className="close-button"
        onClick={onClose}
      >
        ×
      </button>

      {!isEditing ? (
        <>
          <div
            className={`detail-domain-badge detail-domain-${domainClass}`}
          >
            {node.data.domain}
          </div>

          <h2>{node.data.title}</h2>

          <p>{node.data.description}</p>

          {isLoadingExplanation && (
            <>
              <div className="detail-divider" />

              <p className="detail-muted">
                Loading explanation...
              </p>
            </>
          )}

          {explanation && (
            <>
              <div className="detail-divider" />

              <div className="explanation-section">
                <div className="detail-label">
                  Why this happened
                </div>

                <p>{explanation}</p>
              </div>
            </>
          )}

          {explainError && (
            <>
              <div className="detail-divider" />

              <p className="detail-error">
                {explainError}
              </p>
            </>
          )}

          <div className="detail-divider" />

          <div className="detail-actions">
            <button
              className="detail-action-insight"
              onClick={() => void handleExplain()}
              disabled={
                isRoot ||
                isExplaining ||
                isLoadingExplanation
              }
            >
              {isRoot
                ? "Foundational rule"
                : isExplaining
                  ? "Explaining..."
                  : explanation
                    ? "Explain again"
                    : "Why did this happen?"}
            </button>

            <button
              className="detail-action-expand"
              onClick={() =>
                void onExpand(node.id)
              }
              disabled={
                isExpanding || hasChildren
              }
            >
              {isExpanding
                ? "Exploring..."
                : hasChildren
                  ? "Already explored"
                  : "What happens next?"}
            </button>

            <button
              className="detail-action-change"
              onClick={() => {
                setChangeError(null);
                setReplacementMode("alternatives");
                setIsEditing(true);
              }}
              disabled={isRoot}
            >
              {isRoot
                ? "Foundational rule"
                : "Change this outcome"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="detail-label">
            Change this outcome
          </div>

          <h2>Rewrite this consequence</h2>

          <p className="edit-intro">
            Choose another plausible outcome, or write your own.
            Everything downstream will be rewritten.
          </p>

          <div className="detail-divider" />

          {replacementMode === "alternatives" ? (
            <div className="replacement-options">
              <button
                className="suggest-alternatives-button"
                onClick={() =>
                  void handleSuggestAlternatives()
                }
                disabled={
                  isLoadingAlternatives || isSaving
                }
              >
                {isLoadingAlternatives
                  ? "Exploring alternatives..."
                  : "Suggest alternatives"}
              </button>

              {alternatives.length > 0 && (
                <div className="alternative-list">
                  {alternatives.map((alternative) => (
                    <button
                      className={`alternative-card${
                        selectedAlternative?.title ===
                        alternative.title
                          ? " selected"
                          : ""
                      }`}
                      key={alternative.title}
                      onClick={() => {
                        setSelectedAlternative(alternative);
                        setChangeError(null);
                      }}
                      disabled={isSaving}
                      aria-pressed={
                        selectedAlternative?.title ===
                        alternative.title
                      }
                    >
                      <strong>{alternative.title}</strong>
                      <span>{alternative.description}</span>
                      <small>{alternative.domain}</small>
                    </button>
                  ))}
                </div>
              )}

              <button
                className="secondary-detail-action"
                onClick={() => {
                  setReplacementMode("manual");
                  setChangeError(null);
                }}
                disabled={isSaving}
              >
                Write my own outcome
              </button>
            </div>
          ) : (
            <div className="replacement-options">
              <button
                className="secondary-detail-action"
                onClick={() => {
                  setReplacementMode("alternatives");
                  setChangeError(null);
                }}
                disabled={isSaving}
              >
                Choose an AI alternative
              </button>

              <div className="change-outcome-form">
                <label>
                  <span className="field-label">
                    Outcome title
                  </span>

                  <span className="field-hint">
                    Rule Zero will infer the description and domain.
                  </span>

                  <input
                    value={editTitle}
                    onChange={(event) =>
                      setEditTitle(event.target.value)
                    }
                    placeholder="Enter a new outcome"
                  />
                </label>
              </div>
            </div>
          )}

          {changeError && (
            <p className="detail-error">
              {changeError}
            </p>
          )}

          <div className="detail-divider" />

          <div className="detail-actions">
            <button
              className="primary-detail-action"
              onClick={() =>
                void handleSaveChange()
              }
              disabled={
                isSaving ||
                isLoadingAlternatives ||
                (replacementMode === "alternatives"
                  ? selectedAlternative === null
                  : !editTitle.trim())
              }
            >
              {isSaving
                ? "Rewriting..."
                : "Rewrite outcome"}
            </button>

            <button
              onClick={cancelEditing}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </aside>
  );
}