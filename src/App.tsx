import { useEffect, useState } from 'react'
import { AudioInput } from './components/AudioInput'
import { ConversationPanel } from './components/ConversationPanel'
import { Header } from './components/Header'
import { StatusFooter } from './components/StatusFooter'
import { SuggestedAnswer } from './components/SuggestedAnswer'
import { useAudioInput } from './hooks/useAudioInput'
import { useGeminiSuggest } from './hooks/useGeminiSuggest'
import { useSpeechToText } from './hooks/useSpeechToText'
import type { ConversationLine } from './types'
import './App.css'

const FALLBACK_VERSION = '0.1.0'

export default function App() {
  const audio = useAudioInput()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [excludeFromCapture, setExcludeFromCapture] = useState(true)
  const [version, setVersion] = useState(FALLBACK_VERSION)
  const [isMac, setIsMac] = useState(false)
  const [displayMoveMessage, setDisplayMoveMessage] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [lines, setLines] = useState<ConversationLine[]>([])
  const gemini = useGeminiSuggest(lines)

  const speech = useSpeechToText(audio.isListening, (text) => {
    setLines((current) => [...current, { id: `${Date.now()}-${current.length}`, text }])
  })

  useEffect(() => {
    const api = window.desktopApi
    if (!api) return

    void api.getAppInfo().then((info) => {
      setVersion(info.version)
      setIsMac(info.platform === 'darwin')
    })
    void api.getAlwaysOnTop().then(setAlwaysOnTop)
    void api.getContentProtection?.().then(setExcludeFromCapture)
  }, [])

  async function toggleAlwaysOnTop(enabled: boolean) {
    setAlwaysOnTop(enabled)
    if (window.desktopApi?.setAlwaysOnTop) {
      const next = await window.desktopApi.setAlwaysOnTop(enabled)
      setAlwaysOnTop(next)
    }
  }

  async function toggleExcludeFromCapture(enabled: boolean) {
    setExcludeFromCapture(enabled)
    if (window.desktopApi?.setContentProtection) {
      const next = await window.desktopApi.setContentProtection(enabled)
      setExcludeFromCapture(next)
    }
  }

  return (
    <div className="app-shell">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <main className="app-main">
        <AudioInput
          devices={audio.devices}
          selectedDeviceId={audio.selectedDeviceId}
          selectedDeviceName={audio.selectedDeviceName}
          permissionStatus={audio.permissionStatus}
          isListening={audio.isListening}
          error={audio.error || speech.error}
          onSelectDevice={audio.selectDevice}
          onRequestPermission={() => void audio.requestPermission()}
          onRefresh={() => void audio.refreshDevices()}
          onStart={() => void audio.startListening()}
          onStop={audio.stopListening}
        />
        <ConversationPanel
          isListening={audio.isListening}
          lines={lines}
          interim={speech.interim}
          onAdd={(text) => setLines((current) => [...current, { id: `${Date.now()}-${current.length}`, text }])}
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
        isListening={audio.isListening}
        hasGeminiKey={gemini.hasKey}
        geminiStatus={gemini.status}
        version={version}
      />
      {settingsOpen ? (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <section className="card settings-card" onClick={(event) => event.stopPropagation()}>
            <h2>Settings</h2>
            <p>
              Live speech is taken from the selected microphone, written in the conversation panel,
              then sent to Gemini. This does not tap Meet or Zoom system audio. Use speakers, a
              virtual audio device, or Add Test Text.
            </p>
            <label className="toggle-row">Gemini API key</label>
            <input
              className="field"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder={gemini.hasKey ? 'Key saved. Paste to replace.' : 'Paste Gemini API key'}
              autoComplete="off"
            />
            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void gemini.saveKey(apiKeyDraft).then(() => setApiKeyDraft(''))}
              >
                Save key
              </button>
            </div>
            <label className="toggle-row">
              Keep window above other apps
              <input
                type="checkbox"
                checked={alwaysOnTop}
                onChange={(event) => void toggleAlwaysOnTop(event.target.checked)}
              />
            </label>
            <label className="toggle-row">
              Exclude from screen share
              <input
                type="checkbox"
                checked={excludeFromCapture}
                onChange={(event) => void toggleExcludeFromCapture(event.target.checked)}
              />
            </label>
            {isMac ? (
              <p>
                macOS Google Meet entire-screen share still captures this window. Share a Chrome tab
                or Meet window, or move this app to a second monitor.
              </p>
            ) : null}
            <button
              className="btn btn-secondary"
              type="button"
              onClick={async () => {
                const result = await window.desktopApi?.moveToOtherDisplay?.()
                if (!result?.moved) {
                  setDisplayMoveMessage(
                    result?.displayCount && result.displayCount > 1
                      ? 'Could not move the window.'
                      : 'Connect a second display, then try again.',
                  )
                  return
                }
                setDisplayMoveMessage('Moved to the other display. Share the meeting display only.')
              }}
            >
              Move to other display
            </button>
            {displayMoveMessage ? <p>{displayMoveMessage}</p> : null}
            <button className="btn btn-primary" type="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
