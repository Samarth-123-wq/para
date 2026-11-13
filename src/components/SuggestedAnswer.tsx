import { useState } from 'react'

type SuggestedAnswerProps = {
  answer: string
  status: 'idle' | 'pending' | 'error'
  error: string | null
  onAnswerChange: (value: string) => void
}

export function SuggestedAnswer({ answer, status, error, onAnswerChange }: SuggestedAnswerProps) {
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  function showTestAnswer() {
    const text = draft.trim()
    if (!text) return
    onAnswerChange(text)
    setCopied(false)
  }

  async function copyAnswer() {
    if (!answer) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(answer)
      } else {
        const helper = document.createElement('textarea')
        helper.value = answer
        helper.setAttribute('readonly', 'true')
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.select()
        document.execCommand('copy')
        document.body.removeChild(helper)
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Suggested Answer</h2>
      {status === 'pending' ? <div className="listening-banner">Asking Gemini…</div> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {answer ? <div className="answer-body">{answer}</div> : <div className="empty-state">Your suggested answer will appear here.</div>}
      <textarea
        className="field"
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Enter a sample answer"
        aria-label="Test suggested answer"
      />
      <div className="btn-row">
        <button className="btn btn-primary" type="button" onClick={showTestAnswer}>
          Show Test Answer
        </button>
        <button className="btn btn-secondary" type="button" onClick={copyAnswer} disabled={!answer}>
          Copy
        </button>
      </div>
      <div className="btn-row">
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            onAnswerChange('')
            setCopied(false)
          }}
          disabled={!answer}
        >
          Clear
        </button>
        {copied ? <span className="copied">Copied to clipboard</span> : <span />}
      </div>
    </section>
  )
}
