import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [status, setStatus] = useState('Checking connection to Supabase...')
  const [isConnected, setIsConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    async function testConnection() {
      try {
        // Pings Supabase Auth (works even before any tables exist)
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        setIsConnected(true)
        setStatus('Connected to Supabase successfully!')
      } catch (err) {
        setIsConnected(false)
        setStatus('Connection failed')
        setErrorMsg(err.message)
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '500px', margin: '60px auto', padding: '24px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2 style={{ marginTop: 0 }}>Partner CRM — Setup Check</h2>

      <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: isConnected ? '#e6f4ea' : '#fce8e6', color: isConnected ? '#137333' : '#c5221f', fontWeight: 'bold' }}>
        {status}
      </div>

      {errorMsg && (
        <p style={{ color: '#c5221f', fontSize: '14px' }}>
          <strong>Error details:</strong> {errorMsg}
        </p>
      )}

      <ul style={{ marginTop: '20px', lineHeight: '1.8' }}>
        <li><strong>React Frontend:</strong> Working</li>
        <li><strong>Supabase URL Loaded:</strong> {import.meta.env.VITE_SUPABASE_URL ? 'Yes' : 'Missing'}</li>
        <li><strong>Supabase Key Loaded:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Yes' : 'Missing'}</li>
      </ul>
    </div>
  )
}