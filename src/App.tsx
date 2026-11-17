import { useEffect, useRef, useState } from "react";
import { ConversationPanel } from "./components/ConversationPanel";
import { Header } from "./components/Header";
import { StatusFooter } from "./components/StatusFooter";
import { SuggestedAnswer } from "./components/SuggestedAnswer";
import { useGeminiSuggest } from "./hooks/useGeminiSuggest";
import type { ConversationLine } from "./types";
import { ResumeUploader } from "./components/ResumeUploader";
import "./App.css";

const FALLBACK_VERSION = "0.1.0";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [excludeFromCapture, setExcludeFromCapture] = useState(true);
  const [version, setVersion] = useState(FALLBACK_VERSION);
  const [isMac, setIsMac] = useState(false);
  const [displayMoveMessage, setDisplayMoveMessage] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [lines, setLines] = useState<ConversationLine[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [customPromptDraft, setCustomPromptDraft] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [resumeText, setResumeText] = useState("");
  const gemini = useGeminiSuggest((text) => {
    setLines((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, text },
    ]);
  });

  const systemStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const api = window.desktopApi;
    if (!api) return;

    void api.getAppInfo().then((info) => {
      setVersion(info.version);
      setIsMac(info.platform === "darwin");
    });
    void api.getAlwaysOnTop().then(setAlwaysOnTop);
    void api.getContentProtection?.().then(setExcludeFromCapture);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSystemCapture();
    };
  }, []);

  async function startSystemCapture() {
    console.log("[app] startSystemCapture called");

    if (!window.desktopApi?.enableLoopbackAudio) {
      console.error("[app] enableLoopbackAudio not available");
      setSpeechError("Loopback API not available.");
      return;
    }

    try {
      setSpeechError(null);

      const apiKey = await window.desktopApi.getGeminiApiKey?.();
      console.log("[app] apiKey present:", Boolean(apiKey));
      if (!apiKey) {
        setSpeechError("Please set Gemini API key in Settings first.");
        return;
      }

      console.log("[app] enabling loopback audio");
      await window.desktopApi.enableLoopbackAudio();

      console.log("[app] calling getDisplayMedia");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      console.log(
        "[app] getDisplayMedia returned:",
        stream.getTracks().map((t) => `${t.kind}:${t.readyState}`),
      );

      systemStreamRef.current = stream;
      setIsCapturing(true);
      console.log("[app] starting Gemini audio session");
      await gemini.startAudioSession(stream, apiKey, customPrompt, resumeText);
      console.log("[app] startAudioSession returned");
    } catch (err) {
      console.error("[app] capture failed:", err);
      const domErr = err as DOMException;
      setSpeechError(
        `Could not capture system audio (${domErr?.name || "unknown"}). Check Screen Recording permission.`,
      );
      stopSystemCapture();
    }
  }

  function stopSystemCapture() {
    console.log("[app] stopSystemCapture called");
    gemini.stopAudioSession();
    systemStreamRef.current?.getTracks().forEach((track) => track.stop());
    systemStreamRef.current = null;
    setIsCapturing(false);
    void window.desktopApi?.disableLoopbackAudio?.();
    setResumeText("");
  }
  async function toggleAlwaysOnTop(enabled: boolean) {
    setAlwaysOnTop(enabled);
    if (window.desktopApi?.setAlwaysOnTop) {
      const next = await window.desktopApi.setAlwaysOnTop(enabled);
      setAlwaysOnTop(next);
    }
  }

  async function toggleExcludeFromCapture(enabled: boolean) {
    setExcludeFromCapture(enabled);
    if (window.desktopApi?.setContentProtection) {
      const next = await window.desktopApi.setContentProtection(enabled);
      setExcludeFromCapture(typeof next === "boolean" ? next : enabled);
    }
  }

  return (
    <div className="app-shell">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <main className="app-main">
        <section className="card">
          <h2 className="card-title">System Audio (Meeting)</h2>
          <div className="btn-row-inline">
            <button
              className="btn btn-primary btn-compact"
              type="button"
              onClick={() => void startSystemCapture()}
              disabled={isCapturing}
            >
              Start
            </button>
            <button
              className="btn btn-secondary btn-compact"
              type="button"
              onClick={stopSystemCapture}
              disabled={!isCapturing}
            >
              Stop
            </button>
          </div>
          {speechError ? <p className="error-text">{speechError}</p> : null}
        </section>

        <ConversationPanel
          isListening={isCapturing}
          lines={lines}
          interim={gemini.interim}
          onAdd={(text) =>
            setLines((current) => [
              ...current,
              { id: `${Date.now()}-${current.length}`, text },
            ])
          }
          onClear={() => setLines([])}
        />

        <SuggestedAnswer
          answer={gemini.answer}
          status={gemini.status}
          error={gemini.error}
          onAnswerChange={gemini.setAnswer}
        />
      </main>
      <StatusFooter
        isListening={isCapturing}
        hasGeminiKey={gemini.hasKey}
        geminiStatus={gemini.status}
        version={version}
      />
      {settingsOpen ? (
        <div
          className="settings-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="card settings-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Settings</h2>
            <p>
              Live speech is captured from system audio (the other party in
              Meet), not your microphone. This does not include your own voice.
            </p>
            <label className="toggle-row">Gemini API key</label>
            <input
              className="field"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder={
                gemini.hasKey
                  ? "Key saved. Paste to replace."
                  : "Paste Gemini API key"
              }
              autoComplete="off"
            />
            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() =>
                  void gemini
                    .saveKey(apiKeyDraft)
                    .then(() => setApiKeyDraft(""))
                }
              >
                Save key
              </button>
            </div>

            <label className="toggle-row">
              Answer style / personal details (applies before listening)
            </label>
            <textarea
              className="field"
              rows={4}
              value={customPromptDraft}
              onChange={(event) => setCustomPromptDraft(event.target.value)}
              placeholder="e.g. My name is Alex, 5 years of React experience. Answer confidently and briefly, max 3 sentences."
            />
            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setCustomPrompt(customPromptDraft)}
              >
                Save prompt
              </button>
            </div>

            <div className="settings-section">
              <ResumeUploader onResumeChange={setResumeText} />
            </div>

            <div className="settings-section">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => void window.desktopApi?.hideOverlay?.()}
              >
                Hide overlay
              </button>
              <p className="meta">
                Press ⌘⇧H (Ctrl+Shift+H on Windows) to bring it back.
              </p>
            </div>

            <label className="toggle-row">
              Keep window above other apps
              <input
                type="checkbox"
                checked={alwaysOnTop}
                onChange={(event) =>
                  void toggleAlwaysOnTop(event.target.checked)
                }
              />
            </label>
            <label className="toggle-row">
              Exclude from screen share
              <input
                type="checkbox"
                checked={excludeFromCapture}
                onChange={(event) =>
                  void toggleExcludeFromCapture(event.target.checked)
                }
              />
            </label>
            {isMac ? (
              <p>
                macOS Google Meet entire-screen share still captures this
                window. Share a Chrome tab or Meet window, or move this app to a
                second monitor.
              </p>
            ) : null}
            <button
              className="btn btn-secondary"
              type="button"
              onClick={async () => {
                const result = await window.desktopApi?.moveToOtherDisplay?.();
                if (!result?.moved) {
                  setDisplayMoveMessage(
                    result?.displayCount && result.displayCount > 1
                      ? "Could not move the window."
                      : "Connect a second display, then try again.",
                  );
                  return;
                }
                setDisplayMoveMessage(
                  "Moved to the other display. Share the meeting display only.",
                );
              }}
            >
              Move to other display
            </button>
            {displayMoveMessage ? <p>{displayMoveMessage}</p> : null}
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
