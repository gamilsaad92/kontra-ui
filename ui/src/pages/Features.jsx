import React from 'react'
import { features } from '../data/features'

export default function Features() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-[#0d1b2a] text-white px-6 py-4 flex items-center justify-between shadow">
        <h1 className="text-xl font-bold">Kontra</h1>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search"
            className="px-3 py-1.5 rounded-md text-black"
          />
          <div className="w-8 h-8 bg-white rounded-full" />
        </div>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl shadow hover:shadow-lg transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{feature.icon}</span>
                <h2 className="font-semibold text-lg">{feature.title}</h2>
              </div>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
