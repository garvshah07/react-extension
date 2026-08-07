import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <section>
      <div className='flex justify-center w-[800px]'>
        <h1>Garv Shah</h1>
      </div>
    </section>
  )
}

export default App
