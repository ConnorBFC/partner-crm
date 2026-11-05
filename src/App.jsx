import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Users, LogOut, Lock, Plus, CheckCircle2, AlertCircle, Building2, CalendarDays, PoundSterling, UserRound, X, GripVertical, Archive, Trash2, Pencil } from 'lucide-react'
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

function formatDate(value) {
  if (!value) return '—'
  const dateOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function getCalendarDayNumber(value) {
  const dateOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : value instanceof Date
      ? value
      : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000))
}

function getCalendarDaysBetween(start, end) {
  const startDay = getCalendarDayNumber(start)
  const endDay = getCalendarDayNumber(end)
  return startDay === null || endDay === null ? null : endDay - startDay
}

function getStageAge(value, now) {
  if (!value) return { label: 'Date unknown', tone: 'unknown' }
  const elapsedDays = getCalendarDaysBetween(value, new Date(now))
  if (elapsedDays === null) return { label: 'Date unknown', tone: 'unknown' }
  const safeElapsedDays = Math.max(0, elapsedDays)
  return {
    label: safeElapsedDays === 0 ? 'Today' : `${safeElapsedDays} ${safeElapsedDays === 1 ? 'day' : 'days'}`,
    tone: safeElapsedDays === 0 ? 'fresh' : safeElapsedDays >= 3 ? 'stale' : 'waiting'
  }
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDuration(days) {
  if (days === null || !Number.isFinite(days)) return '—'
  if (days < 1) return '< 1 day'
  const roundedDays = Math.round(days * 10) / 10
  return `${roundedDays} ${roundedDays === 1 ? 'day' : 'days'}`
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
  const [failedClients, setFailedClients] = useState([])
  const [stageEntryTimes, setStageEntryTimes] = useState({})
  const [clientView, setClientView] = useState('active')
  const [stageTransitions, setStageTransitions] = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)
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
    stageEnteredDate: getLocalDateValue(),
    method: '',
    stageId: ''
  })
  const [methodOptions, setMethodOptions] = useState([])
  const [methodLoading, setMethodLoading] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [clientFormError, setClientFormError] = useState(null)
  const [createStatus, setCreateStatus] = useState(null)
  const [pendingMove, setPendingMove] = useState(null)
  const [moveDate, setMoveDate] = useState(() => getLocalDateValue())
  const [pendingFailure, setPendingFailure] = useState(null)
  const [failureDate, setFailureDate] = useState(() => getLocalDateValue())
  const [failureReason, setFailureReason] = useState('')
  const [failureOptions, setFailureOptions] = useState([])
  const [failureOptionsLoading, setFailureOptionsLoading] = useState(false)
  const [savingStageAction, setSavingStageAction] = useState(false)
  const [stageActionError, setStageActionError] = useState(null)
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [customFieldsError, setCustomFieldsError] = useState(null)
  const [manageCustomFieldsOpen, setManageCustomFieldsOpen] = useState(false)
  const [newCustomField, setNewCustomField] = useState({ label: '', type: 'text' })
  const [savingCustomField, setSavingCustomField] = useState(false)
  const [customFieldFormError, setCustomFieldFormError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deletingClient, setDeletingClient] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [editingClient, setEditingClient] = useState(null)
  const [editClientDraft, setEditClientDraft] = useState(null)
  const [editClientError, setEditClientError] = useState(null)
  const [savingClientEdits, setSavingClientEdits] = useState(false)
  const [editMethodsLoading, setEditMethodsLoading] = useState(false)

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

  useEffect(() => {
    if (createStatus?.type !== 'success') return undefined

    const timer = window.setTimeout(() => setCreateStatus(null), 5000)
    return () => window.clearTimeout(timer)
  }, [createStatus])

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

    const [stageResult, clientResult, failedClientResult, transitionResult, fieldResult] = await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('*')
        .eq('is_archived', false)
        .order('position', { ascending: true }),
      supabase
        .from('clients')
        .select('*')
        .eq('is_failed', false),
      supabase
        .from('clients')
        .select('*')
        .eq('is_failed', true),
      supabase
        .from('stage_transitions')
        .select('client_id, stage_id, entered_at')
        .is('exited_at', null),
      supabase
        .from('custom_field_defs')
        .select('id, field_label, field_type, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
    ])

    if (stageResult.error || clientResult.error || failedClientResult.error || transitionResult.error) {
      setWorkspaceError(stageResult.error?.message || clientResult.error?.message || failedClientResult.error?.message || transitionResult.error?.message)
      setStages([])
      setClients([])
      setFailedClients([])
      setStageEntryTimes({})
    } else {
      setStages(stageResult.data || [])
      setClients(clientResult.data || [])
      setFailedClients(failedClientResult.data || [])
      setStageEntryTimes(Object.fromEntries(
        (transitionResult.data || []).map((transition) => [String(transition.client_id), transition.entered_at])
      ))
    }
    if (fieldResult.error) {
      setCustomFieldsError(`Unable to load custom fields: ${fieldResult.error.message}`)
      setCustomFieldDefs([])
    } else {
      setCustomFieldsError(null)
      setCustomFieldDefs(fieldResult.data || [])
    }
    setLoading(false)
  }

  async function handleCreateCustomField(event) {
    event.preventDefault()
    const label = newCustomField.label.trim()
    setCustomFieldFormError(null)
    if (!label) {
      setCustomFieldFormError('Enter a label for this field.')
      return
    }
    if (customFieldDefs.some((field) => field.field_label.toLowerCase() === label.toLowerCase())) {
      setCustomFieldFormError('A custom field with this label already exists.')
      return
    }

    setSavingCustomField(true)
    const { data, error } = await supabase
      .from('custom_field_defs')
      .insert({
        field_label: label,
        field_type: newCustomField.type,
        is_active: true
      })
      .select('id, field_label, field_type, is_active, created_at')
      .single()

    if (error) {
      setCustomFieldFormError(`Unable to create custom field: ${error.message}`)
    } else {
      setCustomFieldDefs((current) => [...current, data])
      setEditClientDraft((current) => current
        ? { ...current, customData: { ...current.customData, [data.id]: '' } }
        : current)
      setNewCustomField({ label: '', type: 'text' })
      setCustomFieldFormError(null)
      setManageCustomFieldsOpen(false)
    }
    setSavingCustomField(false)
  }

  async function openNewClientModal() {
    const defaultStage = stages.find((stage) => stage.is_default) || stages[0]
    setNewClient({
      company: '',
      value: '',
      contactName: '',
      stageEnteredDate: getLocalDateValue(),
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

  async function openEditClientModal(client) {
    setEditingClient(client)
    setEditClientDraft({
      company: client.company || '',
      value: client.value === null || client.value === undefined ? '' : String(client.value),
      contactName: client.contact_name || '',
      dateOfContact: client.date_of_contact ? String(client.date_of_contact).slice(0, 10) : '',
      method: client.method || '',
      customData: client.custom_data && typeof client.custom_data === 'object' ? { ...client.custom_data } : {}
    })
    setEditClientError(null)
    setEditMethodsLoading(true)

    const { data, error } = await supabase
      .from('dropdown_options')
      .select('id, label')
      .eq('category', 'method')
      .order('label', { ascending: true })

    if (error) {
      setEditClientError(`Unable to load contact methods: ${error.message}`)
    } else {
      setMethodOptions(data || [])
    }
    setEditMethodsLoading(false)
  }

  async function handleSaveClientEdits(event) {
    event.preventDefault()
    if (!editingClient || !editClientDraft) return

    setEditClientError(null)
    const methodLabel = editClientDraft.method.trim()
    const existingMethod = methodOptions.find(
      (option) => option.label.toLowerCase() === methodLabel.toLowerCase()
    )

    setSavingClientEdits(true)
    if (methodLabel && !existingMethod) {
      const { data: savedMethod, error: methodError } = await supabase
        .from('dropdown_options')
        .insert({ category: 'method', label: methodLabel })
        .select('id, label')
        .single()

      if (methodError) {
        setEditClientError(`Unable to save the new contact method: ${methodError.message}`)
        setSavingClientEdits(false)
        return
      }

      setMethodOptions((current) => [...current, savedMethod].sort((a, b) => a.label.localeCompare(b.label)))
    }

    const customData = { ...editClientDraft.customData }
    for (const field of customFieldDefs) {
      if (field.field_type === 'number' && customData[field.id] !== '' && customData[field.id] !== null && customData[field.id] !== undefined) {
        const numericValue = Number(customData[field.id])
        if (Number.isNaN(numericValue)) {
          setEditClientError(`Enter a valid number for ${field.field_label}.`)
          setSavingClientEdits(false)
          return
        }
        customData[field.id] = numericValue
      } else if (customData[field.id] === '') {
        customData[field.id] = null
      }
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        company: editClientDraft.company.trim(),
        value: Number(editClientDraft.value),
        contact_name: editClientDraft.contactName.trim(),
        date_of_contact: editClientDraft.dateOfContact || null,
        method: methodLabel || null,
        custom_data: customData
      })
      .eq('id', editingClient.id)
      .select()
      .single()

    if (error) {
      setEditClientError(`Unable to save client changes: ${error.message}`)
      setSavingClientEdits(false)
      return
    }

    setClients((current) => current.map((client) => client.id === data.id ? data : client))
    setFailedClients((current) => current.map((client) => client.id === data.id ? data : client))
    setEditingClient(null)
    setEditClientDraft(null)
    setSavingClientEdits(false)
  }

  async function handleCreateClient(e) {
    e.preventDefault()
    setClientFormError(null)
    setCreateStatus(null)

    if (!newClient.stageId) {
      setClientFormError('Add a pipeline stage before creating a client.')
      return
    }

    const stageEnteredAt = new Date(`${newClient.stageEnteredDate}T00:00:00`)
    if (Number.isNaN(stageEnteredAt.getTime())) {
      setClientFormError('Choose a valid date for when the client entered this stage.')
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

    const createdAt = new Date().toISOString()
    const stageEnteredTimestamp = stageEnteredAt.toISOString()
    const clientRecord = {
      company: newClient.company.trim(),
      value: Number(newClient.value),
      contact_name: newClient.contactName.trim(),
      date_of_contact: null,
      method: methodLabel || null,
      stage_id: newClient.stageId,
      stage_entered_at: stageEnteredTimestamp,
      created_at: createdAt,
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
        entered_at: stageEnteredTimestamp,
        exited_at: null,
        outcome: 'active'
      })
      .select('id')

    setClients((current) => [...current, createdClient])
    if (!transitionError) {
      setStageEntryTimes((current) => ({ ...current, [String(createdClient.id)]: stageEnteredTimestamp }))
    }
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
    setMoveDate(getLocalDateValue())
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

  async function openAnalytics() {
    setClientView('analytics')
    setAnalyticsLoading(true)
    setAnalyticsError(null)

    const pageSize = 1000
    const allTransitions = []
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('stage_transitions')
        .select('id, client_id, stage_id, entered_at, exited_at, outcome')
        .order('entered_at', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        setAnalyticsError(`Unable to load pipeline analytics: ${error.message}`)
        setStageTransitions([])
        break
      }

      allTransitions.push(...(data || []))
      if (!data || data.length < pageSize) {
        setStageTransitions(allTransitions)
        break
      }
      from += pageSize
    }
    setAnalyticsLoading(false)
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
    const timestamp = new Date(`${moveDate}T00:00:00`)
    if (Number.isNaN(timestamp.getTime())) {
      setStageActionError('Choose a valid date for this stage change.')
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
    setStageEntryTimes((current) => ({ ...current, [String(updatedClient.id)]: confirmedTimestamp }))
    setPendingMove(null)
    setSavingStageAction(false)
  }

  async function openFailurePrompt(client) {
    setPendingFailure(client)
    setFailureDate(getLocalDateValue())
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
    const timestamp = new Date(`${failureDate}T00:00:00`)
    if (!reason) {
      setStageActionError('Enter or select a failure reason.')
      return
    }
    if (Number.isNaN(timestamp.getTime())) {
      setStageActionError('Choose a valid date for this failure.')
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

    const { data: failedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        is_failed: true,
        failed_from_stage_id: pendingFailure.stage_id,
        failure_reason: reason,
        failed_at: confirmedTimestamp
      })
      .eq('id', pendingFailure.id)
      .select()
      .single()

    if (updateError) {
      const restoreError = await reopenCurrentStageTransition(pendingFailure, confirmedTimestamp)
      setStageActionError(`The client could not be marked failed: ${updateError.message}${restoreError ? ` The previous stage history could not be restored: ${restoreError}` : ''}`)
      await refreshActiveClients()
      setSavingStageAction(false)
      return
    }

    setClients((current) => current.filter((client) => client.id !== pendingFailure.id))
    setFailedClients((current) => [...current.filter((client) => client.id !== failedClient.id), failedClient])
    setPendingFailure(null)
    setClientView('failed')
    setSavingStageAction(false)
  }

  async function handleRestoreClient(client) {
    if (!client.failed_from_stage_id) {
      setCreateStatus({
        type: 'error',
        text: `Unable to restore ${client.company}: no previous stage is recorded.`
      })
      return
    }

    setSavingStageAction(true)
    setCreateStatus(null)
    const timestamp = new Date(`${getLocalDateValue()}T00:00:00`).toISOString()
    const { data: transition, error: transitionError } = await supabase
      .from('stage_transitions')
      .insert({
        client_id: client.id,
        stage_id: client.failed_from_stage_id,
        entered_at: timestamp,
        exited_at: null,
        outcome: 'active'
      })
      .select('id')
      .single()

    if (transitionError) {
      setCreateStatus({
        type: 'error',
        text: `Unable to restore ${client.company}: ${transitionError.message}`
      })
      setSavingStageAction(false)
      return
    }

    const { data: restoredClient, error: updateError } = await supabase
      .from('clients')
      .update({
        is_failed: false,
        stage_id: client.failed_from_stage_id,
        stage_entered_at: timestamp,
        failed_from_stage_id: null,
        failure_reason: null,
        failed_at: null
      })
      .eq('id', client.id)
      .select()
      .single()

    if (updateError) {
      const { error: rollbackError } = await supabase
        .from('stage_transitions')
        .delete()
        .eq('id', transition.id)
      setCreateStatus({
        type: 'error',
        text: `Unable to restore ${client.company}: ${updateError.message}${rollbackError ? ` The new stage history could not be removed: ${rollbackError.message}` : ''}`
      })
      setSavingStageAction(false)
      return
    }

    setFailedClients((current) => current.filter((item) => item.id !== restoredClient.id))
    setClients((current) => [...current.filter((item) => item.id !== restoredClient.id), restoredClient])
    setStageEntryTimes((current) => ({ ...current, [String(restoredClient.id)]: timestamp }))
    setClientView('active')
    setCreateStatus({ type: 'success', text: `${client.company} was restored to the active pipeline.` })
    setSavingStageAction(false)
  }

  async function handleConfirmDelete(e) {
    e.preventDefault()
    if (!pendingDelete) return

    setDeletingClient(true)
    setDeleteError(null)
    const { data: transitions, error: historyReadError } = await supabase
      .from('stage_transitions')
      .select('*')
      .eq('client_id', pendingDelete.id)

    if (historyReadError) {
      setDeleteError(`Unable to load the client’s stage history: ${historyReadError.message}`)
      setDeletingClient(false)
      return
    }

    if (transitions.length > 0) {
      const { error: historyDeleteError } = await supabase
        .from('stage_transitions')
        .delete()
        .eq('client_id', pendingDelete.id)

      if (historyDeleteError) {
        setDeleteError(`Unable to delete the client’s stage history: ${historyDeleteError.message}`)
        setDeletingClient(false)
        return
      }
    }

    const { error: clientDeleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', pendingDelete.id)

    if (clientDeleteError) {
      let restoreErrorMessage = ''
      if (transitions.length > 0) {
        const { error: restoreError } = await supabase
          .from('stage_transitions')
          .insert(transitions)
        if (restoreError) restoreErrorMessage = ` Stage history restore also failed: ${restoreError.message}`
      }
      setDeleteError(`Unable to delete ${pendingDelete.company}: ${clientDeleteError.message}.${restoreErrorMessage}`)
      setDeletingClient(false)
      return
    }

    setClients((current) => current.filter((client) => client.id !== pendingDelete.id))
    setFailedClients((current) => current.filter((client) => client.id !== pendingDelete.id))
    setStageEntryTimes((current) => {
      const remaining = { ...current }
      delete remaining[String(pendingDelete.id)]
      return remaining
    })
    setCreateStatus({ type: 'success', text: `${pendingDelete.company} and its stage history were permanently deleted.` })
    setPendingDelete(null)
    setDeletingClient(false)
  }

  // 3. Handle Sign Up (Email Verification) or Sign In
  async function handleAuth(e) {
    e.preventDefault()
    setAuthErr(null)
    setAuthMsg(null)

    // Automatically detects whether you are on localhost or your live workers.dev link
    const currentOrigin = window.location.origin

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: currentOrigin
        }
      })
      if (error) setAuthErr(error.message)
      else setAuthMsg('Account created! You can now sign in.')
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

  const displayedClients = clientView === 'failed' ? failedClients : clients
  const stageAnalytics = stages.map((stage) => {
    const visits = stageTransitions.filter((transition) => String(transition.stage_id) === String(stage.id))
    const durations = visits
      .map((transition) => {
        const duration = getCalendarDaysBetween(transition.entered_at, transition.exited_at || new Date(now))
        return duration === null || duration < 0 ? null : duration
      })
      .filter((duration) => duration !== null)
    const resolvedVisits = visits.filter((transition) => ['converted', 'failed'].includes(transition.outcome))
    const convertedVisits = visits.filter((transition) => transition.outcome === 'converted').length

    return {
      ...stage,
      activeClients: clients.filter((client) => String(client.stage_id) === String(stage.id)).length,
      visits: visits.length,
      avgDays: durations.length > 0 ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null,
      resolvedVisits: resolvedVisits.length,
      convertedVisits,
      failedVisits: visits.filter((transition) => transition.outcome === 'failed').length,
      conversionRate: resolvedVisits.length > 0 ? (convertedVisits / resolvedVisits.length) * 100 : null
    }
  })
  const pipelineValue = clients.reduce((sum, client) => sum + (Number(client.value) || 0), 0)
  const completedStageDurations = stageTransitions
    .filter((transition) => transition.exited_at)
    .map((transition) => getCalendarDaysBetween(transition.entered_at, transition.exited_at))
    .filter((duration) => duration !== null && duration >= 0)
  const averageStageDays = completedStageDurations.length > 0
    ? completedStageDurations.reduce((sum, duration) => sum + duration, 0) / completedStageDurations.length
    : null

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center' }}>Loading workspace...</div>
  }

  // VIEW A: NOT LOGGED IN (Login / Sign Up Screen)
  if (!session) {
    return (
      <div style={{ maxWidth: '420px', margin: '80px auto', background: '#fff', padding: '32px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <img className="brand-logo brand-logo-login" src="/logo.png" alt="" />
          <h2 style={{ margin: 0 }}>Sales Tracker</h2>
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
          <img className="brand-logo" src="/logo.png" alt="" />
          <h3 style={{ margin: 0 }}>Sales Tracker</h3>
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

      <main className="pipeline-page">
        <div className="pipeline-heading">
          <div>
            <p className="eyebrow">SALES TRACKER</p>
            <h1>{clientView === 'active' ? 'Pipeline' : clientView === 'failed' ? 'Failed Clients' : 'Analytics'}</h1>
            <p className="pipeline-subtitle">
              {clientView === 'active'
                ? 'Track active opportunities across your sales stages.'
                : clientView === 'failed'
                  ? 'Review opportunities moved out of the active pipeline.'
                  : 'Understand stage duration and progression through your pipeline.'}
            </p>
          </div>
          <div className="pipeline-heading-actions">
            {clientView === 'active' && (
              <button className="new-client-button" onClick={openNewClientModal}>
                <Plus size={17} /> New Client
              </button>
            )}
            <div className="client-view-toggle" role="group" aria-label="Client list">
              <button
                type="button"
                className={clientView === 'active' ? 'client-view-button active' : 'client-view-button'}
                aria-pressed={clientView === 'active'}
                onClick={() => setClientView('active')}
              >
                Active <span>{clients.length}</span>
              </button>
              <button
                type="button"
                className={clientView === 'failed' ? 'client-view-button active' : 'client-view-button'}
                aria-pressed={clientView === 'failed'}
                onClick={() => setClientView('failed')}
              >
                Failed <span>{failedClients.length}</span>
              </button>
              <button
                type="button"
                className={clientView === 'analytics' ? 'client-view-button active' : 'client-view-button'}
                aria-pressed={clientView === 'analytics'}
                onClick={openAnalytics}
              >
                Analytics
              </button>
            </div>
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

        {clientView === 'analytics' && (
          <section className="analytics-view" aria-label="Pipeline analytics">
            {analyticsError && (
              <div className="pipeline-alert" role="alert">
                <AlertCircle size={18} />
                <span>{analyticsError}</span>
              </div>
            )}
            {analyticsLoading ? (
              <div className="analytics-loading">Loading pipeline analytics…</div>
            ) : !analyticsError && (
              <>
                <div className="analytics-summary">
                  <article className="analytics-summary-card">
                    <span>Active pipeline value</span>
                    <strong>{currencyFormatter.format(pipelineValue)}</strong>
                  </article>
                  <article className="analytics-summary-card">
                    <span>Active opportunities</span>
                    <strong>{clients.length}</strong>
                  </article>
                  <article className="analytics-summary-card">
                    <span>Failed opportunities</span>
                    <strong>{failedClients.length}</strong>
                  </article>
                  <article className="analytics-summary-card">
                    <span>Average completed stage time</span>
                    <strong>{formatDuration(averageStageDays)}</strong>
                  </article>
                </div>

                <section className="analytics-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <h2>Stage performance</h2>
                      <p>Time uses all recorded stage visits, including time currently spent in an active stage. Conversion rate is converted exits divided by resolved exits (converted or failed).</p>
                    </div>
                  </div>
                  {stageTransitions.length === 0 ? (
                    <div className="analytics-empty">There is no stage transition history to analyse yet.</div>
                  ) : (
                    <div className="analytics-table-wrap">
                      <table className="analytics-table">
                        <thead>
                          <tr>
                            <th>Stage</th>
                            <th>Active clients</th>
                            <th>Stage visits</th>
                            <th>Avg. time in stage</th>
                            <th>Converted</th>
                            <th>Failed</th>
                            <th>Progression rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stageAnalytics.map((stage) => (
                            <tr key={stage.id}>
                              <th scope="row">{stage.name}</th>
                              <td>{stage.activeClients}</td>
                              <td>{stage.visits}</td>
                              <td>{formatDuration(stage.avgDays)}</td>
                              <td>{stage.convertedVisits}</td>
                              <td>{stage.failedVisits}</td>
                              <td>{stage.conversionRate === null ? '—' : `${stage.conversionRate.toFixed(1)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {!workspaceError && clientView !== 'analytics' && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {stages.map((stage) => {
                const stageClients = displayedClients
                  .filter((client) => String(client.stage_id) === String(stage.id))
                  .sort((a, b) => {
                    const aStageEnteredAt = stageEntryTimes[String(a.id)] || a.stage_entered_at
                    const bStageEnteredAt = stageEntryTimes[String(b.id)] || b.stage_entered_at
                    const aEntered = aStageEnteredAt ? new Date(aStageEnteredAt).getTime() : Number.POSITIVE_INFINITY
                    const bEntered = bStageEnteredAt ? new Date(bStageEnteredAt).getTime() : Number.POSITIVE_INFINITY
                    return aEntered - bEntered
                  })

                return (
                  <Droppable droppableId={String(stage.id)} isDropDisabled={clientView === 'failed'} key={stage.id}>
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
                            const stageEnteredAt = stageEntryTimes[String(client.id)] || client.stage_entered_at
                            const age = getStageAge(stageEnteredAt, now)

                            return (
                              <Draggable draggableId={String(client.id)} index={index} isDragDisabled={clientView === 'failed'} key={client.id}>
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
                                        <span className={`stage-age stage-age-${age.tone}`} title="Days in current stage">
                                          <CalendarDays size={13} />
                                          {age.label}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="client-value">
                                      <PoundSterling size={15} />
                                      {value === null || Number.isNaN(Number(value)) ? '—' : currencyFormatter.format(Number(value))}
                                    </div>
                                    <dl className="client-details">
                                      {clientView === 'active' ? (
                                        <>
                                          <div>
                                            <dt><UserRound size={14} /> Contact</dt>
                                            <dd>{contactName || '—'}</dd>
                                          </div>
                                          <div>
                                            <dt><Building2 size={14} /> Method</dt>
                                            <dd>{contactMethod || '—'}</dd>
                                          </div>
                                          <div>
                                            <dt><CalendarDays size={14} /> Date</dt>
                                            <dd>{formatDate(stageEnteredAt)}</dd>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div>
                                            <dt><UserRound size={14} /> Contact</dt>
                                            <dd>{contactName || '—'}</dd>
                                          </div>
                                          <div>
                                            <dt><Archive size={14} /> Failure reason</dt>
                                            <dd>{client.failure_reason || '—'}</dd>
                                          </div>
                                          <div>
                                            <dt><CalendarDays size={14} /> Failed on</dt>
                                            <dd>{formatDate(client.failed_at)}</dd>
                                          </div>
                                        </>
                                      )}
                                    </dl>
                                    <div className="client-card-actions">
                                      <button
                                        type="button"
                                        className="client-edit-button"
                                        onClick={() => openEditClientModal(client)}
                                      >
                                        <Pencil size={12} /> Edit
                                      </button>
                                      {clientView === 'active' && (
                                        <>
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
                                        </>
                                      )}
                                      {clientView === 'failed' && (
                                        <>
                                          <button
                                            type="button"
                                            className="restore-client-button"
                                            disabled={savingStageAction || deletingClient}
                                            onClick={() => handleRestoreClient(client)}
                                          >
                                            <CheckCircle2 size={14} /> Restore to Active
                                          </button>
                                          <button
                                            type="button"
                                            className="delete-client-button"
                                            disabled={savingStageAction || deletingClient}
                                            onClick={() => {
                                              setPendingDelete(client)
                                              setDeleteError(null)
                                            }}
                                          >
                                            <Trash2 size={13} /> Delete
                                          </button>
                                        </>
                                      )}
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
                <div className="board-empty">{clientView === 'active' ? 'No active pipeline stages are available.' : 'No pipeline stages are available.'}</div>
              )}
            </div>
          </DragDropContext>
        )}
      </main>

      {pendingDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deletingClient) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}>
          <section className="stage-action-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">PERMANENT ACTION</p>
                <h2 id="confirm-delete-title">Delete {pendingDelete.company}?</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close delete confirmation"
                disabled={deletingClient}
                onClick={() => { setPendingDelete(null); setDeleteError(null) }}
              >
                <X size={20} />
              </button>
            </div>
            <p className="stage-action-description">
              This permanently deletes the client and all of its stage history. This action cannot be undone.
            </p>
            {deleteError && <div className="form-error" role="alert">{deleteError}</div>}
            <form className="stage-action-form" onSubmit={handleConfirmDelete}>
              <div className="new-client-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={deletingClient}
                  onClick={() => { setPendingDelete(null); setDeleteError(null) }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fail-client-confirm-button"
                  disabled={deletingClient}
                >
                  <Trash2 size={15} /> {deletingClient ? 'Deleting…' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingClient && editClientDraft && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingClientEdits) {
            setEditingClient(null)
            setEditClientError(null)
          }
        }}>
          <section className="client-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-client-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">CLIENT DETAILS</p>
                <h2 id="edit-client-title">Edit {editingClient.company}</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close client editor"
                disabled={savingClientEdits}
                onClick={() => { setEditingClient(null); setEditClientError(null) }}
              >
                <X size={20} />
              </button>
            </div>

            {editClientError && <div className="form-error" role="alert">{editClientError}</div>}
            <form className="new-client-form" onSubmit={handleSaveClientEdits}>
              <label className="form-field form-field-full">
                <span>Company name</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editClientDraft.company}
                  onChange={(event) => setEditClientDraft((current) => ({ ...current, company: event.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Deal Value (£)</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editClientDraft.value}
                  onChange={(event) => setEditClientDraft((current) => ({ ...current, value: event.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Contact name</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editClientDraft.contactName}
                  onChange={(event) => setEditClientDraft((current) => ({ ...current, contactName: event.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Date of contact</span>
                <input
                  type="date"
                  value={editClientDraft.dateOfContact}
                  onChange={(event) => setEditClientDraft((current) => ({ ...current, dateOfContact: event.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Contact method</span>
                <input
                  type="text"
                  list="edit-contact-method-options"
                  value={editClientDraft.method}
                  onChange={(event) => setEditClientDraft((current) => ({ ...current, method: event.target.value }))}
                  placeholder={editMethodsLoading ? 'Loading methods…' : 'Choose or type a method'}
                  disabled={editMethodsLoading}
                  autoComplete="off"
                />
                <datalist id="edit-contact-method-options">
                  {methodOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </label>
              <div className="edit-custom-fields form-field-full">
                <div className="additional-info-heading">
                  <div>
                    <h3>Additional Info</h3>
                    <p>Custom information saved with this client.</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => { setCustomFieldFormError(null); setManageCustomFieldsOpen(true) }}
                  >
                    Manage Custom Fields
                  </button>
                </div>
                {customFieldsError && <div className="form-error" role="alert">{customFieldsError}</div>}
                {customFieldDefs.length === 0 ? (
                  <p className="custom-fields-empty">No custom fields have been defined yet.</p>
                ) : (
                  <div className="custom-data-fields">
                    {customFieldDefs.map((field) => (
                      <label className="form-field" key={field.id}>
                        <span>{field.field_label}</span>
                        <input
                          type={field.field_type}
                          step={field.field_type === 'number' ? 'any' : undefined}
                          value={editClientDraft.customData[field.id] ?? ''}
                          onChange={(event) => setEditClientDraft((current) => ({
                            ...current,
                            customData: { ...current.customData, [field.id]: event.target.value }
                          }))}
                          disabled={savingClientEdits}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="new-client-form-actions form-field-full">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={savingClientEdits}
                  onClick={() => { setEditingClient(null); setEditClientError(null) }}
                >
                  Cancel
                </button>
                <button type="submit" className="new-client-button" disabled={savingClientEdits || editMethodsLoading}>
                  {savingClientEdits ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {manageCustomFieldsOpen && (
        <div className="modal-backdrop custom-fields-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingCustomField) setManageCustomFieldsOpen(false)
        }}>
          <section className="stage-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-custom-fields-title">
            <div className="new-client-modal-header">
              <div>
                <p className="eyebrow">SHARED BY THE TEAM</p>
                <h2 id="manage-custom-fields-title">Manage Custom Fields</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close custom field manager"
                disabled={savingCustomField}
                onClick={() => setManageCustomFieldsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {customFieldFormError && <div className="form-error" role="alert">{customFieldFormError}</div>}
            <form className="stage-action-form" onSubmit={handleCreateCustomField}>
              <label className="form-field">
                <span>Field name</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={newCustomField.label}
                  onChange={(event) => setNewCustomField((current) => ({ ...current, label: event.target.value }))}
                  placeholder="e.g. Preferred package"
                  autoFocus
                />
              </label>
              <label className="form-field">
                <span>Field type</span>
                <select
                  value={newCustomField.type}
                  onChange={(event) => setNewCustomField((current) => ({ ...current, type: event.target.value }))}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                </select>
              </label>
              <div className="new-client-form-actions">
                <button type="button" className="secondary-button" disabled={savingCustomField} onClick={() => setManageCustomFieldsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="new-client-button" disabled={savingCustomField}>
                  {savingCustomField ? 'Creating…' : 'Create Field'}
                </button>
              </div>
            </form>

            {customFieldDefs.length > 0 && (
              <div className="defined-fields-list">
                <h3>Available fields</h3>
                {customFieldDefs.map((field) => (
                  <div className="defined-field-item" key={field.id}>
                    <span>{field.field_label}</span>
                    <span className="field-type-badge">{field.field_type}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

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
                <span>Effective date</span>
                <input
                  type="date"
                  required
                  value={moveDate}
                  onChange={(event) => setMoveDate(event.target.value)}
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
                <span>Effective date</span>
                <input
                  type="date"
                  required
                  value={failureDate}
                  onChange={(event) => setFailureDate(event.target.value)}
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
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={newClient.stageEnteredDate}
                  onChange={(e) => setNewClient((current) => ({ ...current, stageEnteredDate: e.target.value }))}
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