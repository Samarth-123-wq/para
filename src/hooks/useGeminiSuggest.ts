import { useEffect, useRef, useState } from 'react'
import type { ConversationLine } from '../types'

export function useGeminiSuggest(lines: ConversationLine[]) {
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const inFlight = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    void window.desktopApi?.geminiHasKey?.().then(setHasKey)
  }, [])

  useEffect(() => {
    const transcript = lines.map((line) => line.text).join('\n').trim()
    if (!transcript) return

    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      if (!window.desktopApi?.suggestAnswer || inFlight.current) return
      inFlight.current = true
      setStatus('pending')
      setError(null)
      try {
        const result = await window.desktopApi.suggestAnswer(transcript)
        if (result.ok) {
          setAnswer(result.answer)
          setStatus('idle')
        } else {
          setStatus('error')
          setError(result.error)
        }
      } catch {
        setStatus('error')
        setError('Could not reach Gemini.')
      } finally {
        inFlight.current = false
      }
    }, 1600)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [lines])

  async function saveKey(key: string) {
    const saved = await window.desktopApi?.setGeminiApiKey?.(key)
    setHasKey(Boolean(saved))
    return Boolean(saved)
  }

  return { answer, setAnswer, status, error, hasKey, saveKey }
}
