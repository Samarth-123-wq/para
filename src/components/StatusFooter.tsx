type StatusFooterProps = {
  isListening: boolean
  hasGeminiKey: boolean
  geminiStatus: 'idle' | 'pending' | 'error'
  version: string
}

export function StatusFooter({ isListening, hasGeminiKey, geminiStatus, version }: StatusFooterProps) {
  const geminiLabel = !hasGeminiKey ? 'Gemini: Key needed' : geminiStatus === 'pending' ? 'Gemini: Working' : 'Gemini'

  return (
    <footer className="footer">
      <span>Audio: {isListening ? 'Listening' : 'Idle'}</span>
      <span>{geminiLabel}</span>
      <span>v{version}</span>
    </footer>
  )
}
