import { useRef, useState } from "react";
import { extractText, getDocumentProxy } from "unpdf";

type ResumeUploaderProps = {
  onResumeChange: (text: string) => void;
};

export function ResumeUploader({ onResumeChange }: ResumeUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      let text = "";

      if (file.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        text = await file.text();
      } else {
        setError("Only PDF and .txt files are supported.");
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        setError("No text found in this file.");
        return;
      }

      setFileName(file.name);
      setResumeText(trimmed);
      onResumeChange(trimmed);
    } catch (err: any) {
      console.error("[resume] parse failed:", err);
      setError(`Could not read this file: ${err?.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  function clearResume() {
    setFileName(null);
    setResumeText("");
    setError(null);
    onResumeChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="card">
      <h2 className="card-title">Resume (PDF or TXT)</h2>
      <p className="meta">
        Kept only in memory for this session. Nothing is stored.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="btn-row">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? "Reading…" : "Upload resume"}
        </button>
        {fileName ? (
          <button className="btn btn-ghost" type="button" onClick={clearResume}>
            Remove
          </button>
        ) : null}
      </div>

      {fileName ? <p className="meta">Loaded: {fileName}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {resumeText ? (
        <details>
          <summary>Preview ({resumeText.length} characters)</summary>
          <div
            className="answer-body"
            style={{ maxHeight: 200, overflow: "auto" }}
          >
            {resumeText.slice(0, 2000)}
            {resumeText.length > 2000 ? "…" : ""}
          </div>
        </details>
      ) : null}
    </section>
  );
}
