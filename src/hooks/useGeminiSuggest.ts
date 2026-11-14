import { useEffect, useRef, useState } from "react";

const GEMINI_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export function useGeminiSuggest(onFinalTranscript?: (text: string) => void) {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [interim, setInterim] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  useEffect(() => {
    void window.desktopApi?.geminiHasKey?.().then((has) => {
      console.log("[gemini] hasKey:", has);
      setHasKey(has);
    });
  }, []);

  async function startAudioSession(stream: MediaStream, apiKey: string) {
    if (!apiKey) {
      console.error("[gemini] startAudioSession: no API key");
      setError("Gemini API key not set.");
      return;
    }

    const audioTracks = stream.getAudioTracks();
    console.log(
      "[gemini] startAudioSession: audio tracks =",
      audioTracks.length,
      "audio state =",
      audioTracks[0]?.readyState,
    );

    const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`);
    wsRef.current = ws;
    setStatus("pending");
    setError(null);
    setAnswer("");
    setInterim("");
    console.log("[gemini] WebSocket created, waiting for open...");

    ws.onopen = () => {
      console.log("[gemini] WebSocket OPEN");
      const setup = {
        setup: {
          // Switch back to the conversational model that supports Q&A
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            // ✅ Key: must request AUDIO, cannot be TEXT
            responseModalities: ["AUDIO"],
          },
          // Keep input transcription (display what the other party said)
          inputAudioTranscription: {},
          // ✅ Key: enable output transcription (read the model's answer from here)
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [
              {
                text: "You are an interview assistant. Listen to the meeting conversation. When someone asks a question directed at the user, provide a concise, spoken-style answer. If no question is asked, stay silent.",
              },
            ],
          },
        },
      };
      console.log("[gemini] sending setup:", JSON.stringify(setup));
      ws.send(JSON.stringify(setup));
      startPcmCapture(stream, ws);
    };

    ws.onmessage = async (event) => {
      let text: string;
      if (event.data instanceof Blob) {
        text = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data);
      } else {
        text = event.data;
      }

      let msg: any;
      try {
        msg = JSON.parse(text);
      } catch {
        console.warn("[gemini] non-JSON message:", text.slice(0, 200));
        return;
      }

      console.log("[gemini] message keys:", Object.keys(msg).join(", "));
      handleMessage(msg);
    };

    function handleMessage(msg: any) {
      if (msg.setupComplete) {
        console.log("[gemini] SETUP COMPLETE - ready for audio");
        setStatus("idle");
        return;
      }

      const serverContent = msg.serverContent;
      if (!serverContent) return;

      // 1. Input transcription (what the other party in the meeting said)
      if (serverContent.interimInputTranscription?.text) {
        setInterim(serverContent.interimInputTranscription.text);
      }

      if (serverContent.inputTranscription?.text) {
        const finalText = serverContent.inputTranscription.text.trim();
        setInterim("");
        if (finalText) onFinalTranscriptRef.current?.(finalText);
      }

      // 2. ✅ Model answer (from output transcription, not modelTurn.parts.text)
      if (serverContent.outputTranscription?.text) {
        const answerText = serverContent.outputTranscription.text;
        console.log("[gemini] output transcript (answer):", answerText);
        setAnswer((prev) => prev + answerText);
      }
    }
    ws.onerror = (event) => {
      console.error("[gemini] WebSocket error:", event);
      setStatus("error");
      setError("Gemini Live connection error.");
    };

    ws.onclose = (event) => {
      console.error("[gemini] WebSocket closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      wsRef.current = null;
      if (event.code !== 1000) {
        setStatus("error");
        setError(
          `Gemini closed (${event.code}): ${event.reason || "no reason"}`,
        );
      }
    };
  }

  function startPcmCapture(stream: MediaStream, ws: WebSocket) {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    console.log(
      "[pcm] AudioContext created, sampleRate =",
      audioContext.sampleRate,
    );

    const workletCode = `
      class PCMWorklet extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0]
          if (!input || !input[0]) return true
          const channel = input[0]
          const pcm16 = new Int16Array(channel.length)
          for (let i = 0; i < channel.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, channel[i] * 32768))
          }
          this.port.postMessage(pcm16.buffer, [pcm16.buffer])
          return true
        }
      }
      registerProcessor('pcm-worklet', PCMWorklet)
    `;
    const blob = new Blob([workletCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    audioContext.audioWorklet
      .addModule(url)
      .then(() => {
        console.log("[pcm] AudioWorklet module loaded");
        URL.revokeObjectURL(url);
        const source = audioContext.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(audioContext, "pcm-worklet");
        workletRef.current = worklet;

        let chunkCount = 0;
        worklet.port.onmessage = (event) => {
          chunkCount++;
          const pcm16 = new Int16Array(event.data);
          const bytes = new Uint8Array(pcm16.buffer);
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          const base64 = btoa(binary);

          if (chunkCount % 20 === 1) {
            console.log(
              `[pcm] chunk #${chunkCount}, ${pcm16.length} samples, base64 ${base64.length} chars, ws=${ws.readyState}`,
            );
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    data: base64,
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              }),
            );
          }
        };

        source.connect(worklet);
        console.log("[pcm] source connected to worklet");
      })
      .catch((err) => {
        console.error("[pcm] Failed to load AudioWorklet:", err);
        setError("AudioWorklet failed to load. Check CSP.");
      });
  }

  function stopAudioSession() {
    console.log("[gemini] stopAudioSession");
    workletRef.current?.disconnect();
    workletRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setInterim("");
  }

  async function saveKey(key: string) {
    const saved = await window.desktopApi?.setGeminiApiKey?.(key);
    console.log("[gemini] saveKey:", saved);
    setHasKey(Boolean(saved));
    return Boolean(saved);
  }

  return {
    answer,
    setAnswer,
    status,
    error,
    hasKey,
    interim,
    startAudioSession,
    stopAudioSession,
    saveKey,
  };
}
