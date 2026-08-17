import { useState } from 'react'

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

        <div className='max-h-80 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 whitespace-pre-wrap'>
          {scanData || 'Extracted page text will appear here.'}
        </div>
      </div>
    </section>
  )
}

export default Home
