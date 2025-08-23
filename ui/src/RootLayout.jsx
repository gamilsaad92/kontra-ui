// ui/src/RootLayout.jsx
import React, { useEffect } from 'react'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/clerk-react'

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
      <header className="flex justify-end items-center p-4 gap-4 h-16 border-b border-slate-800">
        <SignedOut>
          <SignInButton>
            <button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="bg-[#6c47ff] hover:brightness-110 text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5">
              Sign Up
            </button>
          </SignUpButton>
        </SignedOut>

        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
