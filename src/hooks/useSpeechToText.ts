import { useEffect, useRef, useState } from 'react'

type RecognitionResult = {
  isFinal: boolean
  0?: { transcript: string }
}

type RecognitionEvent = {
  resultIndex: number
  results: RecognitionResult[]
}

type RecognitionErrorEvent = {
  error: string
}

type RecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechCtor = new () => RecognitionInstance

function getSpeechCtor(): SpeechCtor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null
}

export function useSpeechToText(isListening: boolean, onFinalText: (text: string) => void) {
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const onFinalTextRef = useRef(onFinalText)
  onFinalTextRef.current = onFinalText

  useEffect(() => {
    if (!isListening) {
      setInterim('')
      return
    }

    const Ctor = getSpeechCtor()
    if (!Ctor) {
      setError(
        'Live speech-to-text is not available. Use Add Test Text, or choose a microphone that can hear the meeting.',
      )
      return
    }

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let stopped = false

    recognition.onresult = (event) => {
      let nextInterim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (!result?.[0]) continue
        const text = result[0].transcript.trim()
        if (!text) continue
        if (result.isFinal) {
          onFinalTextRef.current(text)
          nextInterim = ''
        } else {
          nextInterim = text
        }
      }
      setInterim(nextInterim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (event.error === 'not-allowed') {
        setError('Speech recognition was blocked. Allow microphone access and try again.')
        return
      }
      setError('Could not transcribe microphone audio.')
    }

    recognition.onend = () => {
      if (!stopped) {
        try {
          recognition.start()
        } catch {
          // Already started.
        }
      }
    }

    setError(null)
    try {
      recognition.start()
    } catch {
      setError('Could not start speech recognition.')
    }

    return () => {
      stopped = true
      setInterim('')
      recognition.onend = null
      recognition.stop()
    }
  }, [isListening])

  return { interim, error }
}
