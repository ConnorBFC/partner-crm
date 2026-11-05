import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ShieldCheck, Users, LogOut, Lock, Plus, CheckCircle2, AlertCircle } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auth form states
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMsg, setAuthMsg] = useState(null)
  const [authErr, setAuthErr] = useState(null)

  // Whitelist & Database states
  const [isWhitelisted, setIsWhitelisted] = useState(false)
  const [teamList, setTeamList] = useState([])
  const [stages, setStages] = useState([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [newColleagueEmail, setNewColleagueEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState(null)

  // 1. Listen for Supabase Login / Logout sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) verifyWhitelistAndLoad(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) verifyWhitelistAndLoad(session.user.email)
      else {
        setIsWhitelisted(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Check if logged-in user passes the RLS Whitelist wall
  async function verifyWhitelistAndLoad(userEmail) {
    setLoading(true)
    const { data: whitelistData, error } = await supabase
      .from('whitelisted_users')
      .select('*')
      .order('created_at', { ascending: true })

    if (error || !whitelistData || whitelistData.length === 0) {
      setIsWhitelisted(false)
      setLoading(false)
      return
    }

    setIsWhitelisted(true)
    setTeamList(whitelistData)

    // Load pipeline stages to prove RLS unlocked the database
    const { data: stageData } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('is_archived', false)
      .order('position', { ascending: true })

    setStages(stageData || [])
    setLoading(false)
  }

  // 3. Handle Sign Up (Email Verification) or Sign In
  async function handleAuth(e) {
    e.preventDefault()
    setAuthErr(null)
    setAuthMsg(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password
      })
      if (error) setAuthErr(error.message)
      else setAuthMsg('Verification email sent! Please check your inbox (and junk folder) to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })
      if (error) setAuthErr(error.message)
    }
  }

  // 4. Handle Adding a Colleague to the Company Whitelist
  async function handleInviteColleague(e) {
    e.preventDefault()
    setInviteStatus(null)
    const cleanEmail = newColleagueEmail.trim().toLowerCase()

    const { error } = await supabase
      .from('whitelisted_users')
      .insert([{ email: cleanEmail, added_by: session.user.email }])

    if (error) {
      if (error.message.includes('enforce_company_domain')) {
        setInviteStatus({ type: 'error', text: 'Blocked: Email must match your company domain.' })
      } else if (error.message.includes('duplicate key')) {
        setInviteStatus({ type: 'error', text: 'That colleague is already on the whitelist.' })
      } else {
        setInviteStatus({ type: 'error', text: error.message })
      }
    } else {
      setInviteStatus({ type: 'success', text: `Added ${cleanEmail} to the whitelist!` })
      setNewColleagueEmail('')
      verifyWhitelistAndLoad(session.user.email)
    }
  }

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center' }}>Loading workspace...</div>
  }

  // VIEW A: NOT LOGGED IN (Login / Sign Up Screen)
  if (!session) {
    return (
      <div style={{ maxWidth: '420px', margin: '80px auto', background: '#fff', padding: '32px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <ShieldCheck size={28} color="#0052cc" />
          <h2 style={{ margin: 0 }}>Partner CRM</h2>
        </div>
        <p style={{ color: '#5e6c84', fontSize: '14px', marginBottom: '24px' }}>
          {isSignUp ? 'Create your internal account (requires email verification)' : 'Sign in with your verified work email'}
        </p>

        {authErr && (
          <div style={{ padding: '10px 12px', background: '#fce8e6', color: '#c5221f', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
            {authErr}
          </div>
        )}

        {authMsg && (
          <div style={{ padding: '10px 12px', background: '#e6f4ea', color: '#137333', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
            {authMsg}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Work Email</label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dfe1e6' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dfe1e6' }}
            />
          </div>
          <button
            type="submit"
            style={{ padding: '11px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', marginTop: '4px' }}
          >
            {isSignUp ? 'Send Verification Email' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setAuthErr(null); setAuthMsg(null) }}
            style={{ background: 'none', border: 'none', color: '#0052cc', textDecoration: 'underline' }}
          >
            {isSignUp ? 'Already verified? Sign in here' : 'First time here? Create & verify your account'}
          </button>
        </div>
      </div>
    )
  }

  // VIEW B: LOGGED IN BUT NOT ON THE WHITELIST
  if (!isWhitelisted) {
    return (
      <div style={{ maxWidth: '460px', margin: '80px auto', background: '#fff', padding: '32px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <Lock size={40} color="#c5221f" style={{ marginBottom: '12px' }} />
        <h2 style={{ marginTop: 0 }}>Whitelist Access Required</h2>
        <p style={{ color: '#5e6c84', lineHeight: '1.5' }}>
          You are signed in as <strong>{session.user.email}</strong>, but your email has not been added to the internal company whitelist yet.
        </p>
        <p style={{ color: '#5e6c84', fontSize: '14px' }}>
          Ask an existing team member to add your email inside the <strong>Team Access</strong> menu.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: '16px', padding: '10px 18px', background: '#ebecf0', border: 'none', borderRadius: '6px', fontWeight: '600' }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  // VIEW C: VERIFIED & WHITELISTED WORKSPACE
  return (
    <div>
      {/* Top Navigation Bar */}
      <header style={{ background: '#fff', padding: '14px 28px', borderBottom: '1px solid #dfe1e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={24} color="#0052cc" />
          <h3 style={{ margin: 0 }}>Partner CRM</h3>
          <span style={{ fontSize: '12px', background: '#e6f4ea', color: '#137333', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>
            Whitelisted
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: '#5e6c84' }}>{session.user.email}</span>
          <button
            onClick={() => setShowTeamModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f4f5f7', border: '1px solid #dfe1e6', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}
          >
            <Users size={16} /> Team Access ({teamList.length})
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'none', border: '1px solid #dfe1e6', borderRadius: '6px', color: '#5e6c84', fontSize: '13px' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Preview (Unlocked Pipeline Columns) */}
      <main style={{ padding: '28px' }}>
        <h4 style={{ marginTop: 0, color: '#5e6c84' }}>
          Unlocked Pipeline Stages ({stages.length} active columns loaded from Supabase):
        </h4>
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
          {stages.map((stage) => (
            <div key={stage.id} style={{ minWidth: '260px', background: '#ebecf0', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>{stage.name}</div>
              <div style={{ fontSize: '12px', color: '#5e6c84' }}>
                Position #{stage.position} {stage.is_default && '• Default Start'} {stage.is_terminal_won && '• Finalized Stage'}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Team Whitelist Modal */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 30, 66, 0.54)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '10px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Internal Team Whitelist</h3>
              <button onClick={() => { setShowTeamModal(false); setInviteStatus(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleInviteColleague} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="email"
                required
                placeholder="colleague@yourcompany.com"
                value={newColleagueEmail}
                onChange={(e) => setNewColleagueEmail(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid #dfe1e6' }}
              />
              <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '9px 14px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}>
                <Plus size={16} /> Add
              </button>
            </form>

            {inviteStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', background: inviteStatus.type === 'error' ? '#fce8e6' : '#e6f4ea', color: inviteStatus.type === 'error' ? '#c5221f' : '#137333' }}>
                {inviteStatus.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                {inviteStatus.text}
              </div>
            )}

            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #dfe1e6', borderRadius: '6px' }}>
              {teamList.map((member) => (
                <div key={member.email} style={{ padding: '10px 12px', borderBottom: '1px solid #f4f5f7', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <strong>{member.email}</strong>
                  <span style={{ color: '#5e6c84' }}>Added by {member.added_by}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}