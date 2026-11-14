/// <reference types="vite/client" />

interface DesktopApi {
  getAppInfo: () => Promise<{
    version: string;
    platform: string;
    name: string;
    captureExclusionReliable: boolean;
  }>;
  moveToOtherDisplay: () => Promise<{ moved: boolean; displayCount: number }>;
  requestMicrophoneAccess: () => Promise<{ granted: boolean; status: string }>;
  getAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
  getContentProtection: () => Promise<boolean>;
  setContentProtection: (enabled: boolean) => Promise<boolean>;
  geminiHasKey: () => Promise<boolean>;
  setGeminiApiKey: (key: string) => Promise<boolean>;
  suggestAnswer: (
    transcript: string,
  ) => Promise<{ ok: true; answer: string } | { ok: false; error: string }>;
  enableLoopbackAudio: () => Promise<void>;
  disableLoopbackAudio: () => Promise<void>;
  getGeminiApiKey: () => Promise<string | null>;
  log: (...args: unknown[]) => void;
  hideOverlay: () => Promise<boolean>;
  showOverlay: () => Promise<boolean>;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export {};
