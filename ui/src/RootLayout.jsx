// ui/src/RootLayout.jsx
import React, { useEffect } from 'react'

export default function RootLayout({ children }) {
  // Apply global html/body classes safely for a Vite SPA
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.classList.add('dark')
    document.body.classList.add('bg-slate-950', 'text-slate-100', 'min-h-screen')
    return () => {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('bg-slate-950', 'text-slate-100', 'min-h-screen')
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-end items-center p-4 gap-4 h-16 border-b border-slate-800" />

      <main className="flex-1">{children}</main>
    </div>
  )
}
