// client/src/main.tsx

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { SettingsPage } from './components/SettingsPage'
import './styles.css'

// prevent browser back-navigation when pressing Backspace outside of inputs
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace') return
  const target = e.target as HTMLElement
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  ) return
  e.preventDefault()
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing root element')

// two pages, told apart by path; the server and Vite both answer any
//  extensionless path with the client shell
const isSettings = window.location.pathname.replace(/\/+$/, '') === '/settings'

createRoot(root).render(
  <StrictMode>
    {isSettings ? <SettingsPage /> : <App />}
  </StrictMode>,
)
