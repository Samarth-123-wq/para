const fs = require('fs')
const path = require('path')

const MODEL = 'gemini-2.0-flash'
let apiKey = process.env.GEMINI_API_KEY || ''
let configPath = ''

function init(userDataPath) {
  configPath = path.join(userDataPath, 'gemini-config.json')
  if (apiKey) return
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    if (typeof raw.apiKey === 'string' && raw.apiKey.trim()) {
      apiKey = raw.apiKey.trim()
    }
  } catch {
    // First launch or unreadable config.
  }
}

function persist() {
  if (!configPath) return
  fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2), 'utf8')
}

function setApiKey(key) {
  apiKey = String(key || '').trim()
  persist()
  return Boolean(apiKey)
}

function hasApiKey() {
  return Boolean(apiKey)
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()
}

async function suggestAnswer(transcript) {
  if (!apiKey) {
    return { ok: false, error: 'Add a Gemini API key in Settings.' }
  }

  const conversation = String(transcript || '').trim()
  if (!conversation) {
    return { ok: false, error: 'No conversation text yet.' }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'You are an interview copilot. Read the live transcript, identify the latest interviewer question, and write a concise answer the candidate can say out loud. No preamble, headings, or bullet labels. Keep it to 4-8 spoken sentences.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: conversation.slice(-4000) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 400,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed (${response.status}).`
    return { ok: false, error: message }
  }

  const answer = extractText(payload)
  if (!answer) {
    return { ok: false, error: 'Gemini returned an empty answer.' }
  }

  return { ok: true, answer }
}

module.exports = {
  init,
  setApiKey,
  hasApiKey,
  suggestAnswer,
}
