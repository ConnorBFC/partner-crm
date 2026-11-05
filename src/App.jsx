import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ShieldCheck, Users, LogOut, Lock, Plus, CheckCircle2, AlertCircle, Building2, CalendarDays, Clock3, PoundSterling, UserRound, X, GripVertical, Archive } from 'lucide-react'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import './App.css'

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

function firstValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key]
    }
  }
  return null
}

function formatContactDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function getStageAge(value, now) {
  if (!value) return { label: 'Time unknown', tone: 'unknown' }
  const enteredAt = new Date(value).getTime()
  if (Number.isNaN(enteredAt)) return { label: 'Time unknown', tone: 'unknown' }

  const elapsedHours = Math.max(0, Math.floor((now - enteredAt) / (60 * 60 * 1000)))
  if (elapsedHours < 24) {
    return {
      label: elapsedHours === 0 ? '< 1 hour' : `${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'}`,
      tone: 'fresh'
    }
  }

  const elapsedDays = Math.floor(elapsedHours / 24)
  return {
    label: `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'}`,
    tone: elapsedDays >= 3 ? 'stale' : 'waiting'
  }
}

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

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
  const [clients, setClients] = useState([])
  const [workspaceError, setWorkspaceError] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [newColleagueEmail, setNewColleagueEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState(null)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClient, setNewClient] = useState({
    company: '',
    value: '',
    contactName: '',
    dateOfContact: '',
    method: '',
    stageId: ''
  })
  const [methodOptions, setMethodOptions] = useState([])
  const [methodLoading, setMethodLoading] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [clientFormError, setClientFormError] = useState(null)
  const [createStatus, setCreateStatus] = useState(null)
  const [pendingMove, setPendingMove] = useState(null)
  const [moveDateTime, setMoveDateTime] = useState(() => getLocalDateTimeValue())
  const [pendingFailure, setPendingFailure] = useState(null)
  const [failureDateTime, setFailureDateTime] = useState(() => getLocalDateTimeValue())
  const [failureReason, setFailureReason] = useState('')
  const [failureOptions, setFailureOptions] = useState([])
  const [failureOptionsLoading, setFailureOptionsLoading] = useState(false)
  const [savingStageAction, setSavingStageAction] = useState(false)
  const [stageActionError, setStageActionError] = useState(null)

  // 1. Listen for Supabase Login / Logout sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) verifyWhitelistAndLoad()
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) verifyWhitelistAndLoad()
      else {
        setIsWhitelisted(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  // 2. Check if logged-in user passes the RLS Whitelist wall
  async function verifyWhitelistAndLoad() {
    setLoading(true)
    setWorkspaceError(null)
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

    const [stageResult, clientResult] = await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('*')
        .eq('is_archived', false)
        .order('position', { ascending: true }),
      supabase
        .from('clients')
        .select('*')
        .eq('is_failed', false)
    ])

    if (stageResult.error || clientResult.error) {
      setWorkspaceError(stageResult.error?.message || clientResult.error?.message)
      setStages([])
      setClients([])
    } else {
      setStages(stageResult.data || [])
      setClients(clientResult.data || [])
    }
    setLoading(false)
  }

  async function openNewClientModal() {
    const defaultStage = stages.find((stage) => stage.is_default) || stages[0]
    setNewClient({
      company: '',
      value: '',
      contactName: '',
      dateOfContact: '',
      method: '',
      stageId: defaultStage ? String(defaultStage.id) : ''
    })
    setClientFormError(null)
    setCreateStatus(null)
    setShowNewClientModal(true)
    setMethodLoading(true)

    const { data, error } = await supabase
      .from('dropdown_options')
      .select('id, label')
      .eq('category', 'method')
      .order('label', { ascending: true })

    if (error) {
      setClientFormError(`Unable to load contact methods: ${error.message}`)
    } else {
      setMethodOptions(data || [])
    }
    setMethodLoading(false)
  }

  async function handleCreateClient(e) {
    e.preventDefault()
    setClientFormError(null)
    setCreateStatus(null)

    if (!newClient.stageId) {
      setClientFormError('Add a pipeline stage before creating a client.')
      return
    }

    setSavingClient(true)
    const methodLabel = newClient.method.trim()
    const existingMethod = methodOptions.find(
      (option) => option.label.toLowerCase() === methodLabel.toLowerCase()
    )

    if (methodLabel && !existingMethod) {
      const { data: savedMethod, error: methodError } = await supabase
        .from('dropdown_options')
        .insert({ category: 'method', label: methodLabel })
        .select('id, label')
        .single()

      if (methodError) {
        setClientFormError(`Unable to save the new contact method: ${methodError.message}`)
        setSavingClient(false)
        return
      }

      setMethodOptions((current) => [...current, savedMethod].sort((a, b) => a.label.localeCompare(b.label)))
    }

    const timestamp = new Date().toISOString()
    const clientRecord = {
      company: newClient.company.trim(),
      value: Number(newClient.value),
      contact_name: newClient.contactName.trim(),
      date_of_contact: newClient.dateOfContact || null,
      method: methodLabel || null,
      stage_id: newClient.stageId,
      stage_entered_at: timestamp,
      created_at: timestamp,
      is_failed: false
    }

    const { data: createdClient, error: clientError } = await supabase
      .from('clients')
      .insert(clientRecord)
      .select()
      .single()

    if (clientError) {
      setClientFormError(`Unable to create the client: ${clientError.message}`)
      setSavingClient(false)
      return
    }

    const { error: transitionError } = await supabase
      .from('stage_transitions')
      .insert({
        client_id: createdClient.id,
        stage_id: newClient.stageId,
        entered_at: timestamp,
        exited_at: null,
        outcome: 'active'
      })

    setClients((current) => [...current, createdClient])
    setSavingClient(false)
    setShowNewClientModal(false)

    if (transitionError) {
      setCreateStatus({
        type: 'error',
        text: `${createdClient.company} was created, but its stage history could not be saved: ${transitionError.message}`
      })
    } else {
      setCreateStatus({ type: 'success', text: `${createdClient.company} was added to the pipeline.` })
    }
  }

  function requestStageMove(client, destinationStageId) {
    if (String(client.stage_id) === String(destinationStageId)) return
    const destinationStage = stages.find((stage) => String(stage.id) === String(destinationStageId))
    if (!destinationStage) return

    setStageActionError(null)
    setPendingMove({ client, destinationStage })
    setMoveDateTime(getLocalDateTimeValue())
  }

  function handleDragEnd(result) {
    if (!result.destination || result.destination.droppableId === result.source.droppableId) return
    const client = clients.find((item) => String(item.id) === result.draggableId)
    if (client) requestStageMove(client, result.destination.droppableId)
  }

  async function refreshActiveClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_failed', false)

    if (error) {
      setWorkspaceError(`Unable to refresh clients: ${error.message}`)
      return
    }

    setClients(data || [])
  }

  async function closeCurrentStageTransition(client, timestamp, outcome) {
    const { data, error } = await supabase
      .from('stage_transitions')
      .update({ exited_at: timestamp, outcome })
      .eq('client_id', client.id)
      .eq('stage_id', client.stage_id)
      .is('exited_at', null)
      .select('id')

    if (error) return error.message
    if (!data || data.length === 0) return 'No open transition was found for this client’s current stage.'
    return null
  }

  async function reopenCurrentStageTransition(client, timestamp) {
    const { data, error } = await supabase
      .from('stage_transitions')
      .update({ exited_at: null, outcome: 'active' })
      .eq('client_id', client.id)
      .eq('stage_id', client.stage_id)
      .eq('exited_at', timestamp)
      .select('id')

    if (error) return error.message
    if (!data || data.length === 0) return 'The previous stage history could not be restored.'
    return null
  }

  async function handleConfirmStageMove(e) {
    e.preventDefault()
    if (!pendingMove) return
    const timestamp = new Date(moveDateTime)
    if (Number.isNaN(timestamp.getTime())) {
      setStageActionError('Choose a valid date and time for this stage change.')
      return
    }

    setSavingStageAction(true)
    setStageActionError(null)
    const confirmedTimestamp = timestamp.toISOString()
    const { client, destinationStage } = pendingMove
    const closeError = await closeCurrentStageTransition(client, confirmedTimestamp, 'converted')

    if (closeError) {
      setStageActionError(`Unable to close the current stage history: ${closeError}`)
      setSavingStageAction(false)
      return
    }

    const { data: newTransition, error: insertError } = await supabase
      .from('stage_transitions')
      .insert({
        client_id: client.id,
        stage_id: destinationStage.id,
        entered_at: confirmedTimestamp,
        exited_at: null,
        outcome: 'active'
      })
      .select('id')
      .single()

    if (insertError) {
      const restoreError = await reopenCurrentStageTransition(client, confirmedTimestamp)
      setStageActionError(`The new stage history could not be created: ${insertError.message}${restoreError ? ` The previous stage history could not be restored: ${restoreError}` : ''}`)
      await refreshActiveClients()
      setSavingStageAction(false)
      return
    }

    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({ stage_id: destinationStage.id, stage_entered_at: confirmedTimestamp })
      .eq('id', client.id)
      .select()
      .single()

    if (updateError) {
      const { error: removeTransitionError } = await supabase
        .from('stage_transitions')
        .delete()
        .eq('id', newTransition.id)
      const restoreError = await reopenCurrentStageTransition(client, confirmedTimestamp)
      setStageActionError(`The client could not be moved: ${updateError.message}${removeTransitionError ? ` The new stage history could not be removed: ${removeTransitionError.message}` : ''}${restoreError ? ` The previous stage history could not be restored: ${restoreError}` : ''}`)
      await refreshActiveClients()
      setSavingStageAction(false)
      return
    }

    setClients((current) => current.map((item) => item.id === updatedClient.id ? updatedClient : item))
    setPendingMove(null)
    setSavingStageAction(false)
  }

  async function openFailurePrompt(client) {
    setPendingFailure(client)
    setFailureDateTime(getLocalDateTimeValue())
    setFailureReason('')
    setStageActionError(null)
    setFailureOptionsLoading(true)

    const { data, error } = await supabase
      .from('dropdown_options')
      .select('id, label')
      .eq('category', 'failure_reason')
      .order('label', { ascending: true })

    if (error) {
      setStageActionError(`Unable to load failure reasons: ${error.message}`)
    } else {
      setFailureOptions(data || [])
    }
    setFailureOptionsLoading(false)
  }

  async function handleConfirmFailure(e) {
    e.preventDefault()
    if (!pendingFailure) return
    const reason = failureReason.trim()
    const timestamp = new Date(failureDateTime)
    if (!reason) {
      setStageActionError('Enter or select a failure reason.')
      return
    }
    if (Number.isNaN(timestamp.getTime())) {
      setStageActionError('Choose a valid date and time for this failure.')
      return
    }

    setSavingStageAction(true)
    setStageActionError(null)
    const confirmedTimestamp = timestamp.toISOString()
    const closeError = await closeCurrentStageTransition(pendingFailure, confirmedTimestamp, 'failed')
    if (closeError) {
      setStageActionError(`Unable to close the current stage history: ${closeError}`)
      setSavingStageAction(false)
      return
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        is_failed: true,
        failed_from_stage_id: pendingFailure.stage_id,
        failure_reason: reason,
        failed_at: confirmedTimestamp
      })
      .eq('id', pendingFailure.id)

    if (updateError) {
      const restoreError = await reopenCurrentStageTransition(pendingFailure, confirmedTimestamp)
      setStageActionError(`The client could not be marked failed: ${updateError.message}${restoreError ? ` The previous stage history could not be restored: ${restoreError}` : ''}`)
      await refreshActiveClients()
      setSavingStageAction(false)
      return
    }

    setClients((current) => current.filter((client) => client.id !== pendingFailure.id))
    setPendingFailure(null)
    setSavingStageAction(false)
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
      verifyWhitelistAndLoad()
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
          <button className="new-client-button" onClick={openNewClientModal}>
            <Plus size={17} /> New Client
          </button>
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

      <main className="pipeline-page">
        <div className="pipeline-heading">
          <div>
            <p className="eyebrow">PARTNER CRM</p>
            <h1>Pipeline</h1>
            <p className="pipeline-subtitle">Track active opportunities across your sales stages.</p>
          </div>
          <div className="pipeline-summary">
            <span className="summary-number">{clients.length}</span>
            <span>active {clients.length === 1 ? 'client' : 'clients'}</span>
          </div>
        </div>

        {workspaceError && (
          <div className="pipeline-alert" role="alert">
            <AlertCircle size={18} />
            <span>Unable to load the pipeline: {workspaceError}</span>
          </div>
        )}

        {createStatus && (
          <div className={`pipeline-alert pipeline-alert-${createStatus.type}`} role={createStatus.type === 'error' ? 'alert' : 'status'}>
            {createStatus.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{createStatus.text}</span>
          </div>
        )}

        {!workspaceError && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {stages.map((stage) => {
                const stageClients = clients
                  .filter((client) => String(client.stage_id) === String(stage.id))
                  .sort((a, b) => {
                    const aEntered = a.stage_entered_at ? new Date(a.stage_entered_at).getTime() : Number.POSITIVE_INFINITY
                    const bEntered = b.stage_entered_at ? new Date(b.stage_entered_at).getTime() : Number.POSITIVE_INFINITY
                    return aEntered - bEntered
                  })

                return (
                  <Droppable droppableId={String(stage.id)} key={stage.id}>
                    {(dropProvided, snapshot) => (
                      <section
                        className={`kanban-column${snapshot.isDraggingOver ? ' kanban-column-drag-over' : ''}`}
                        aria-label={`${stage.name} stage`}
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                      >
                        <div className="column-heading">
                          <h2>{stage.name}</h2>
                          <span className="column-count">{stageClients.length}</span>
                        </div>
                        <div className="column-cards">
                          {stageClients.length === 0 && <p className="column-empty">No clients in this stage</p>}
                          {stageClients.map((client, index) => {
                            const company = firstValue(client, ['company', 'company_name', 'name', 'client_name'])
                            const value = firstValue(client, ['value', 'deal_value', 'amount'])
                            const contactName = firstValue(client, ['contact_name', 'primary_contact_name'])
                            const contactMethod = firstValue(client, ['method', 'contact_method', 'preferred_contact_method'])
                            const contactDate = firstValue(client, ['date_of_contact', 'contact_date', 'last_contacted_at'])
                            const age = getStageAge(client.stage_entered_at, now)

                            return (
                              <Draggable draggableId={String(client.id)} index={index} key={client.id}>
                                {(dragProvided, dragSnapshot) => (
                                  <article
                                    className={`client-card${dragSnapshot.isDragging ? ' client-card-dragging' : ''}`}
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    style={{ ...dragProvided.draggableProps.style }}
                                  >
                                    <div className="client-card-drag-handle" {...dragProvided.dragHandleProps} aria-label={`Drag ${company || 'client'} to another stage`}>
                                      <GripVertical size={16} aria-hidden="true" />
                                      <div className="client-card-top">
                                        <h3>{company || 'Unnamed company'}</h3>
                                        <span className={`stage-age stage-age-${age.tone}`} title="Time in current stage">
                                          <Clock3 size={13} />
                                          {age.label}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="client-value">
                                      <PoundSterling size={15} />
                                      {value === null || Number.isNaN(Number(value)) ? '—' : currencyFormatter.format(Number(value))}
                                    </div>
                                    <dl className="client-details">
                                      <div>
                                        <dt><UserRound size={14} /> Contact</dt>
                                        <dd>{contactName || '—'}</dd>
                                      </div>
                                      <div>
                                        <dt><Building2 size={14} /> Method</dt>
                                        <dd>{contactMethod || '—'}</dd>
                                      </div>
                                      <div>
                                        <dt><CalendarDays size={14} /> Date of contact</dt>
                                        <dd>{formatContactDate(contactDate)}</dd>
                                      </div>
                                    </dl>
                                    <div className="client-card-actions">
                                      <label>
                                        <span className="visually-hidden">Move {company || 'client'} to stage</span>
                                        <select
                                          value={client.stage_id}
                                          disabled={savingStageAction}
                                          onChange={(event) => requestStageMove(client, event.target.value)}
                                        >
                                          {stages.map((option) => (
                                            <option key={option.id} value={option.id}>{option.name}</option>
                                          ))}
                                        </select>
                                      </label>
                                      <button
                                        type="button"
                                        className="fail-client-button"
                                        disabled={savingStageAction}
                                        onClick={() => openFailurePrompt(client)}
                                      >
                                        <Archive size={14} /> Move to Failed
                                      </button>
                                    </div>
                                  </article>
                                )}
                              </Draggable>
                            )
                          })}
                          {dropProvided.placeholder}
                        </div>
                      </section>
                    )}
                  </Droppable>
                )
              })}
              {stages.length === 0 && (
                <div className="board-empty">No active pipeline stages are available.</div>
              )}
            </div>
          </DragDropContext>
        )}
      </main>

      {pendingMove && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingStageAction) {
            setPendingMove(null)
            setStageActionError(null)
          }
        }}>
          <section className="stage-action-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-move-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">STAGE CHANGE</p>
                <h2 id="confirm-move-title">Move {pendingMove.client.company}</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close stage change confirmation"
                disabled={savingStageAction}
                onClick={() => { setPendingMove(null); setStageActionError(null) }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="stage-action-description">
              Confirm moving from <strong>{stages.find((stage) => String(stage.id) === String(pendingMove.client.stage_id))?.name || 'current stage'}</strong> to <strong>{pendingMove.destinationStage.name}</strong>.
            </p>
            {stageActionError && <div className="form-error" role="alert">{stageActionError}</div>}
            <form className="stage-action-form" onSubmit={handleConfirmStageMove}>
              <label className="form-field">
                <span>Effective date and time</span>
                <input
                  type="datetime-local"
                  required
                  value={moveDateTime}
                  onChange={(event) => setMoveDateTime(event.target.value)}
                />
                <small>Change this if the stage move happened earlier.</small>
              </label>
              <div className="new-client-form-actions">
                <button type="button" className="secondary-button" disabled={savingStageAction} onClick={() => { setPendingMove(null); setStageActionError(null) }}>
                  Cancel
                </button>
                <button type="submit" className="new-client-button" disabled={savingStageAction}>
                  {savingStageAction ? 'Saving…' : 'Confirm Move'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingFailure && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingStageAction) {
            setPendingFailure(null)
            setStageActionError(null)
          }
        }}>
          <section className="stage-action-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-failure-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">CLOSE OPPORTUNITY</p>
                <h2 id="confirm-failure-title">Move {pendingFailure.company} to Failed</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close failure form"
                disabled={savingStageAction}
                onClick={() => { setPendingFailure(null); setStageActionError(null) }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="stage-action-description">This will remove the client from the active pipeline and close its current stage history.</p>
            {stageActionError && <div className="form-error" role="alert">{stageActionError}</div>}
            <form className="stage-action-form" onSubmit={handleConfirmFailure}>
              <label className="form-field">
                <span>Effective date and time</span>
                <input
                  type="datetime-local"
                  required
                  value={failureDateTime}
                  onChange={(event) => setFailureDateTime(event.target.value)}
                />
                <small>Change this if the opportunity failed earlier.</small>
              </label>
              <label className="form-field">
                <span>Failure reason</span>
                <input
                  type="text"
                  required
                  list="failure-reason-options"
                  value={failureReason}
                  onChange={(event) => setFailureReason(event.target.value)}
                  placeholder={failureOptionsLoading ? 'Loading reasons…' : 'Choose or type a reason'}
                  disabled={failureOptionsLoading}
                  autoComplete="off"
                />
                <datalist id="failure-reason-options">
                  {failureOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
                <small>Select an existing reason or enter a new reason for this client.</small>
              </label>
              <div className="new-client-form-actions">
                <button type="button" className="secondary-button" disabled={savingStageAction} onClick={() => { setPendingFailure(null); setStageActionError(null) }}>
                  Cancel
                </button>
                <button type="submit" className="fail-client-confirm-button" disabled={savingStageAction || failureOptionsLoading}>
                  {savingStageAction ? 'Saving…' : 'Confirm Failure'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showNewClientModal && (
        <div className="modal-backdrop" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !savingClient) setShowNewClientModal(false)
        }}>
          <section className="new-client-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">PIPELINE</p>
                <h2 id="new-client-title">New Client</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close New Client form"
                disabled={savingClient}
                onClick={() => setShowNewClientModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {clientFormError && <div className="form-error" role="alert">{clientFormError}</div>}

            <form className="new-client-form" onSubmit={handleCreateClient}>
              <label className="form-field form-field-full">
                <span>Company name</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={newClient.company}
                  onChange={(e) => setNewClient((current) => ({ ...current, company: e.target.value }))}
                  placeholder="Company name"
                  autoFocus
                />
              </label>

              <label className="form-field">
                <span>Deal Value (£)</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newClient.value}
                  onChange={(e) => setNewClient((current) => ({ ...current, value: e.target.value }))}
                  placeholder="0.00"
                />
              </label>

              <label className="form-field">
                <span>Contact name</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={newClient.contactName}
                  onChange={(e) => setNewClient((current) => ({ ...current, contactName: e.target.value }))}
                  placeholder="Contact name"
                />
              </label>

              <label className="form-field">
                <span>Date of contact</span>
                <input
                  type="date"
                  required
                  value={newClient.dateOfContact}
                  onChange={(e) => setNewClient((current) => ({ ...current, dateOfContact: e.target.value }))}
                />
              </label>

              <label className="form-field">
                <span>Contact method</span>
                <input
                  type="text"
                  required
                  list="contact-method-options"
                  value={newClient.method}
                  onChange={(e) => setNewClient((current) => ({ ...current, method: e.target.value }))}
                  placeholder={methodLoading ? 'Loading methods…' : 'Choose or type a method'}
                  disabled={methodLoading}
                  autoComplete="off"
                />
                <datalist id="contact-method-options">
                  {methodOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
                <small>Choose an existing method or type a new one to save it for the team.</small>
              </label>

              <label className="form-field form-field-full">
                <span>Stage</span>
                <select
                  required
                  value={newClient.stageId}
                  onChange={(e) => setNewClient((current) => ({ ...current, stageId: e.target.value }))}
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>

              <div className="new-client-form-actions form-field-full">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={savingClient}
                  onClick={() => setShowNewClientModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="new-client-button" disabled={savingClient || methodLoading}>
                  <Plus size={16} /> {savingClient ? 'Saving…' : 'Create Client'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

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