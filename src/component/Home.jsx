import { useState } from 'react'
import { Groq } from 'groq-sdk'

function extractPageText() {
  const blockedTags = ['NAV', 'HEADER', 'FOOTER', 'ASIDE']
  const mainRoot =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.body

  const textParts = Array.from(
    mainRoot.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li')
  )
    .filter((element) => {
      if (blockedTags.includes(element.tagName)) {
        return false
      }

      return !blockedTags.includes(element.closest('nav, header, footer, aside')?.tagName)
    })
    .map((element) => element.innerText.trim())
    .filter(Boolean)

  return textParts.join('\n\n')
}

const Home = () => {
  const [scanData, setScanData] = useState('')
  const [auditResult, setAuditResult] = useState('')
  const [loading, setLoading] = useState(false)

  const handleScan = async () => {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractPageText,
      })

      setScanData(result || 'No text found.')
    } catch {
      setScanData('Unable to scan this page.')
    }
  }


  const handleAudit = async () => {
    if (!scanData.trim()) return

    const apiKey = import.meta.env.VITE_REACT_APP_GROQ_API_KEY
    const model = import.meta.env.VITE_REACT_APP_GROQ_MODEL
    const prompt =
      import.meta.env.VITE_REACT_APP_GROQ_PROMPT ||
      'You are a policy auditor. Summarize important risks clearly.'

    if (!apiKey) {
      setAuditResult('Missing GROQ API key. Add VITE_REACT_APP_GROQ_API_KEY to your .env file.')
      return
    }

    setLoading(true)

    try {
      const groq = new Groq({
        apiKey,
        dangerouslyAllowBrowser: true,
      })

      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: `POLICY TEXT TO AUDIT:\n${scanData}`
          }
        ],
        temperature: 0.1,
      })

      setAuditResult(response.choices[0]?.message?.content || '')
    } catch (error) {
      setAuditResult(error?.message || 'Audit failed.')
      console.error('Audit failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='min-h-100 w-150 bg-slate-100 p-4 text-slate-900'>
      <div className='flex flex-col gap-4'>
        <div className='text-center'>
          <h3 className='text-2xl font-semibold'>AgreeWise</h3>
          <p className='text-sm text-slate-600'>Know what you agree to</p>
        </div>

        <button
          type='button'
          onClick={handleScan}
          className='rounded-lg bg-slate-900 px-4 py-2 font-medium text-white'
        >
          Scan
        </button>

        <button onClick={handleAudit} disabled={loading}>
          {loading ? 'Auditing...' : 'Audit Policy'}
        </button>

        {/* <div className='max-h-80 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 whitespace-pre-wrap'>
          {scanData || 'Extracted page text will appear here.'}
        </div> */}

        {auditResult && (
          <div style={{ marginTop: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <h4>Audit Summary:</h4>
            <div style={{ whiteSpace: 'pre-wrap' }}>{auditResult}</div>
          </div>
        )}
      </div>
    </section>
  )
}

export default Home
