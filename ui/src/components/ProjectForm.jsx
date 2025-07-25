import React, { useState, useContext } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from '../lib/authContext'

export default function ProjectForm({ onCreated }) {
  const { session } = useContext(AuthContext)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name, number, address, owner_id: session.user.id }])
      .select()
      .single()
    setLoading(false)
    if (error) return setError(error.message)
    onCreated()
    setName(''); setNumber(''); setAddress('')
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4">
      <h2 className="text-xl font-bold">Create New Project</h2>
      <input
        type="text"
        placeholder="Project Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />
      <input
        type="text"
        placeholder="Project Number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />
      <input
        type="text"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded w-full"
      >
        {loading ? 'Creating…' : 'Create Project'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  )
}
