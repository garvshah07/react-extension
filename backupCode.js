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

function parseAuditSummary(content) {
  if (!content?.trim()) {
    return { title: 'Audit Summary', items: [] }
  }

  const normalized = content.replace(/\r/g, '').trim()
  const titleMatch = normalized.match(/^(Audit Summary:)/im)
  const sectionMatches = [
    ...normalized.matchAll(
      /Point\s*(\d+)\s*\nRisk Level:\s*(.+?)\nIssue:\s*(.+?)\nContent:\s*([\s\S]*?)(?=\nPoint\s*\d+\s*\nRisk Level:|\s*$)/gi
    ),
  ]

  const items = sectionMatches.map((match) => ({
    point: Number(match[1]),
    riskLevel: match[2].trim(),
    heading: match[3].trim(),
    description: match[4].trim(),
  }))

  if (items.length > 0) {
    return {
      title: titleMatch?.[1] || 'Audit Summary:',
      items,
    }
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    title: titleMatch?.[1] || 'Audit Summary:',
    items: lines
      .filter((line) => line.startsWith('-'))
      .map((line, index) => ({
        point: index + 1,
        riskLevel: 'High',
        heading: `Point ${index + 1}`,
        description: line.replace(/^-+\s*/, ''),
      })),
  }
}

function extractAuditText(response) {
  const choice = response?.choices?.[0]
  const content = choice?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part?.type === 'text') {
          return part.text || ''
        }

        return ''
      })
      .join('\n')
      .trim()

    if (text) {
      return text
    }
  }

  if (choice?.finish_reason === 'length') {
    return 'Audit completed, but the response was cut off before the summary could be returned.'
  }

  return ''
}

const Home = () => {
  const [scanData, setScanData] = useState('')
  const [auditResult, setAuditResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [auditStatus, setAuditStatus] = useState('')
  const parsedAudit = parseAuditSummary(auditResult)
  const getRiskBadgeClasses = (riskLevel) => {
    const normalized = riskLevel?.toLowerCase()

    if (normalized === 'critical') {
      return 'bg-rose-600 text-white'
    }

    if (normalized === 'medium') {
      return 'bg-amber-100 text-amber-800'
    }

    if (normalized === 'low') {
      return 'bg-emerald-100 text-emerald-800'
    }

    return 'bg-rose-100 text-rose-700'
  }

  const handleScan = async () => {
    setScanLoading(true)
    setScanStatus('')

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
      setScanStatus(
        result?.trim()
          ? 'Scan complete. Policy text is ready for audit.'
          : 'Scan complete, but no text was found on this page.'
      )
    } catch {
      setScanData('Unable to scan this page.')
      setScanStatus('Scan failed. Try again on a page with readable policy text.')
    } finally {
      setScanLoading(false)
    }
  }

  const handleAudit = async () => {
    if (!scanData.trim()) return

    const apiKey = import.meta.env.VITE_REACT_APP_GROQ_API_KEY
    const model = import.meta.env.VITE_REACT_APP_GROQ_MODEL || 'openai/gpt-oss-120b'
    const prompt =
      import.meta.env.VITE_REACT_APP_GROQ_PROMPT ||
      'You are a policy auditor. Summarize important risks clearly.'

    if (!apiKey) {
      setAuditResult('Missing GROQ API key. Add VITE_REACT_APP_GROQ_API_KEY to your .env file.')
      setAuditStatus('Audit could not start because the API key is missing.')
      return
    }

    setLoading(true)
    setAuditResult('')
    setAuditStatus('')

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
            content: prompt,
          },
          {
            role: 'user',
            content: `POLICY TEXT TO AUDIT:\n${scanData}`,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 4096,
      })

      const auditText = extractAuditText(response)

      if (auditText) {
        setAuditResult(auditText)
        setAuditStatus('Audit complete. Results are shown below.')
      } else {
        setAuditStatus('Audit finished, but no readable summary was returned.')
      }
    } catch (error) {
      setAuditResult(error?.message || 'Audit failed.')
      setAuditStatus('Audit failed. Please try again.')
      console.error('Audit failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='min-h-100 w-150 bg-[radial-gradient(circle_at_top,#fff7ed,#e2e8f0_55%,#cbd5e1)] p-4 text-slate-900'>
      <div className='flex flex-col gap-4'>
        <div className='text-center'>
          <h3 className='text-2xl font-semibold tracking-tight'>AgreeWise</h3>
          <p className='text-sm text-slate-600'>Know what you agree to</p>
        </div>

        <button
          type='button'
          onClick={handleScan}
          disabled={scanLoading}
          className='rounded-xl bg-slate-900 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {scanLoading ? 'Scanning...' : 'Scan'}
        </button>

        {scanStatus && (
          <div className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
            {scanStatus}
          </div>
        )}

        <button
          onClick={handleAudit}
          disabled={loading || !scanData.trim() || scanData === 'Unable to scan this page.'}
          className='rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {loading ? 'Auditing...' : 'Audit Policy'}
        </button>

        {auditStatus && (
          <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
            {auditStatus}
          </div>
        )}

        {auditResult && (
          <div className='mt-2 overflow-hidden rounded-2xl border border-amber-200 bg-white/90 shadow-lg shadow-slate-300/40 backdrop-blur'>
            <div className='border-b border-amber-100 bg-linear-to-r from-amber-50 via-orange-50 to-white px-4 py-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white'>
                  !
                </div>
                <div>
                  <h4 className='text-lg font-semibold text-slate-900'>{parsedAudit.title}</h4>
                  <p className='text-sm text-slate-600'>
                    Key privacy and compliance concerns detected in the scanned policy.
                  </p>
                </div>
              </div>
            </div>

            {parsedAudit.items.length > 0 ? (
              <div className='space-y-3 p-4'>
                {parsedAudit.items.map((item, index) => (
                  <article
                    key={`${item.point || index}-${item.heading}-${index}`}
                    className='rounded-xl border border-slate-200 bg-slate-50/80 p-4'
                  >
                    <div className='mb-3 flex items-center justify-between gap-3'>
                      <span className='text-xs font-semibold uppercase tracking-[0.16em] text-slate-500'>
                        Point {item.point || index + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getRiskBadgeClasses(item.riskLevel)}`}
                      >
                        {item.riskLevel || 'High'}
                      </span>
                    </div>
                    <h5 className='text-base font-semibold text-slate-900'>{item.heading}</h5>
                    <p className='mt-2 text-sm leading-6 text-slate-700'>{item.description}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className='p-4'>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap'>
                  {auditResult}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default Home
