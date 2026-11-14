import { useState } from "react";
import type { ConversationLine } from "../types";

type ConversationPanelProps = {
  isListening: boolean;
  lines: ConversationLine[];
  interim: string;
  onAdd: (text: string) => void;
  onClear: () => void;
};

export function ConversationPanel({
  isListening,
  lines,
  interim,
  onAdd,
  onClear,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState("");

  function addTestText() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <section className="card">
      <h2 className="card-title">Live Conversation</h2>
      <div className="listening-banner">
        <span className={`dot ${isListening ? "listening" : "idle"}`} />
        {isListening ? "Transcribing meeting audio" : "Capture is idle"}
      </div>
      {lines.length === 0 && !interim ? (
        <div className="empty-state">Conversation will appear here.</div>
      ) : (
        <div className="conversation-list">
          {lines.map((line) => (
            <div className="conversation-line" key={line.id}>
              {line.text}
            </div>
          ))}
          {interim ? (
            <div className="conversation-line interim">{interim}</div>
          ) : null}
        </div>
      )}
      <input
        className="field"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Enter sample conversation text"
        aria-label="Test conversation text"
        onKeyDown={(event) => {
          if (event.key === "Enter") addTestText();
        }}
      />
      <div className="btn-row">
        <button className="btn btn-primary" type="button" onClick={addTestText}>
          Add Test Text
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
        >
          Clear
        </button>
      </div>
    </section>
  );
}
