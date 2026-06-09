'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentMember } from '@/hooks/useCurrentMember'

type Department = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'

interface TeamMember {
  id: number
  name: string
  whatsapp_number: string
  department: Department
}

interface Settings {
  greenapi_instance_id: string
  greenapi_api_token: string
  greenapi_api_url: string
  reminder_interval_minutes: string
  whatsapp_auto_send: string
  whatsapp_stock_group_name: string
  whatsapp_stock_group_id: string
}

interface RecentGroup {
  chatId: string
  chatName: string
  lastSeenAt: number
}

interface WebhookHit {
  ts: number
  type: string
  chatId: string
  chatName: string
  msgType: string
  hasImage: boolean
  caption: string
  outcome: string
  watchId?: number
}

const TASK_DEFAULT_ROWS = [
  { dept: 'ACCOUNTING' as Department, items: [
    { key: 'ACCOUNTING_MARK_PAYMENT', label: 'Mark Payment Status' },
    { key: 'ACCOUNTING_ADD_STOCK_FOB', label: 'Add Stock No in FOB' },
  ]},
  { dept: 'SALES' as Department, items: [
    { key: 'SALES_SET_PRICE', label: 'Set Price' },
    { key: 'SALES_UPLOAD_DRIVE', label: 'Upload to Drive' },
    { key: 'SALES_UPLOAD_STOCK_GROUP', label: 'Upload Photos To Whatsapp Stock Photos' },
    { key: 'SALES_UPDATE_B2B', label: 'Research B2B Price' },
    { key: 'SALES_GET_B2C_PRICES', label: 'Get B2C Prices from Josh' },
  ]},
  { dept: 'LOGISTICS' as Department, items: [
    { key: 'LOGISTICS_SET_LOCATION', label: 'Set Location' },
    { key: 'LOGISTICS_UPDATE_COST', label: 'Update Logistics Cost' },
    { key: 'LOGISTICS_ACCESSORIES', label: 'Accessories (all)' },
  ]},
]

interface TaskTemplate {
  id: number
  label: string
  department: string
  phase: string
  is_builtin: boolean
  task_type_key: string | null
  default_assignee: string | null
}

interface TestResult {
  name: string
  number: string
  ok: boolean
}

const DEPT_CONFIG = {
  LOGISTICS: { label: 'Logistics', icon: '📦', color: 'text-ink', bg: 'bg-panel', border: 'border-default' },
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-ink', bg: 'bg-panel', border: 'border-default' },
  SALES: { label: 'Sales', icon: '🤝', color: 'text-ink', bg: 'bg-panel', border: 'border-default' },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function SettingsPage() {
  const router = useRouter()
  const { member, isMaster, loading: authLoading } = useCurrentMember()
  const [settingsTab, setSettingsTab] = useState<'integrations' | 'tasks' | 'team' | 'webhook'>('integrations')

  useEffect(() => {
    if (authLoading) return
    if (!member) {
      router.replace('/login?next=/settings')
      return
    }
    if (!isMaster) {
      router.replace('/dashboard')
    }
  }, [authLoading, member, isMaster, router])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const [settings, setSettings] = useState<Settings>({
    greenapi_instance_id: '',
    greenapi_api_token: '',
    greenapi_api_url: 'https://api.green-api.com',
    reminder_interval_minutes: '180',
    whatsapp_auto_send: '1',
    whatsapp_stock_group_name: 'Purosangue team BUY AND SELL',
    whatsapp_stock_group_id: '120363420701421193@g.us',
  })
  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [recentHits, setRecentHits] = useState<WebhookHit[]>([])
  const [loadingHits, setLoadingHits] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ successCount: number; total: number; report: TestResult[] } | null>(null)
  const [testError, setTestError] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [newMember, setNewMember] = useState({ name: '', whatsapp_number: '', department: 'LOGISTICS' as Department })
  const [taskDefaults, setTaskDefaults] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [editingMember, setEditingMember] = useState<number | null>(null)
  const [editNumber, setEditNumber] = useState('')
  const [savingNumber, setSavingNumber] = useState(false)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [newBuyTask, setNewBuyTask] = useState({ label: '', department: 'SALES', default_assignee: '' })
  const [newSellTask, setNewSellTask] = useState({ label: '', department: 'SALES', default_assignee: '' })
  const [addingTemplate, setAddingTemplate] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        try { setTaskDefaults(JSON.parse(data.task_assignment_defaults || '{}')) } catch { /* ignore */ }
      }
    } catch (err) { console.error(err) }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchRecentGroups = async () => {
    setLoadingGroups(true)
    try {
      const res = await fetch('/api/whatsapp/recent-groups')
      if (res.ok) setRecentGroups(await res.json())
    } finally { setLoadingGroups(false) }
  }

  const fetchRecentHits = async () => {
    setLoadingHits(true)
    try {
      const res = await fetch('/api/whatsapp/recent-activity')
      if (res.ok) setRecentHits(await res.json())
    } finally { setLoadingHits(false) }
  }

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/task-templates')
      if (res.ok) setTemplates(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { fetchSettings(); fetchMembers(); fetchTemplates() }, [fetchSettings, fetchMembers, fetchTemplates])

  const testWhatsApp = async () => {
    setTesting(true); setTestResult(null); setTestError('')
    try {
      const res = await fetch('/api/settings/test-whatsapp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setTestError(data.error || 'Test failed'); return }
      setTestResult(data)
    } catch { setTestError('Request failed') }
    finally { setTesting(false) }
  }

  const saveSettings = async () => {
    setSaving(true); setSavedMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, task_assignment_defaults: JSON.stringify(taskDefaults) }),
      })
      if (!res.ok) throw new Error('Failed')
      setSavedMsg('Settings saved!')
      setTimeout(() => setSavedMsg(''), 3000)
    } catch { setSavedMsg('Error saving.') }
    finally { setSaving(false) }
  }

  const toggleWhatsAppAutoSend = async () => {
    const next = settings.whatsapp_auto_send === '1' ? '0' : '1'
    setSettings(prev => ({ ...prev, whatsapp_auto_send: next }))
    setSavedMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_auto_send: next }),
      })
      if (!res.ok) throw new Error('Failed')
      setSavedMsg(next === '1' ? 'WhatsApp auto-send enabled' : 'WhatsApp auto-send disabled')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch {
      // rollback on failure
      setSettings(prev => ({ ...prev, whatsapp_auto_send: next === '1' ? '0' : '1' }))
      setSavedMsg('Error updating WhatsApp auto-send')
    }
  }

  const addTemplate = async (phase: 'BUY' | 'SELL') => {
    const task = phase === 'BUY' ? newBuyTask : newSellTask
    if (!task.label.trim()) return
    setAddingTemplate(true)
    try {
      const res = await fetch('/api/task-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: task.label.trim(), department: task.department, phase, default_assignee: task.default_assignee || null }),
      })
      if (res.ok) {
        if (phase === 'BUY') setNewBuyTask({ label: '', department: 'SALES', default_assignee: '' })
        else setNewSellTask({ label: '', department: 'SALES', default_assignee: '' })
        fetchTemplates()
      }
    } finally { setAddingTemplate(false) }
  }

  const deleteTemplate = async (id: number) => {
    await fetch(`/api/task-templates/${id}`, { method: 'DELETE' })
    fetchTemplates()
  }

  const updateTemplateAssignee = async (id: number, assignee: string) => {
    await fetch(`/api/task-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_assignee: assignee || null }),
    })
    fetchTemplates()
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault(); setMemberError('')
    if (!newMember.name.trim() || !newMember.whatsapp_number.trim()) {
      setMemberError('Name and WhatsApp number are required.'); return
    }
    const cleanNumber = newMember.whatsapp_number.replace(/[^0-9]/g, '')
    if (cleanNumber.length < 10) { setMemberError('Enter a valid phone number (country code + number).'); return }

    setAddingMember(true)
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMember.name.trim(), whatsapp_number: cleanNumber, department: newMember.department }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      setNewMember({ name: '', whatsapp_number: '', department: 'LOGISTICS' })
      fetchMembers()
    } catch (err) { setMemberError(err instanceof Error ? err.message : 'Failed') }
    finally { setAddingMember(false) }
  }

  const deleteMember = async (id: number) => {
    try {
      await fetch(`/api/team-members/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null); fetchMembers()
    } catch (err) { console.error(err) }
  }

  const startEditNumber = (id: number, current: string) => {
    setDeleteConfirm(null)
    setEditingMember(id)
    setEditNumber(current)
  }

  const saveMemberNumber = async (id: number) => {
    const clean = editNumber.replace(/[^0-9]/g, '')
    if (clean.length < 10) { setMemberError('Enter a valid number (country code + number).'); return }
    setSavingNumber(true); setMemberError('')
    try {
      const res = await fetch(`/api/team-members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: clean }),
      })
      if (!res.ok) throw new Error('Failed')
      setEditingMember(null); setEditNumber(''); fetchMembers()
    } catch { setMemberError('Could not update number.') }
    finally { setSavingNumber(false) }
  }

  const inputClass = 'input-field'

  const membersByDept = (dept: Department) => members.filter(m => m.department === dept)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex-1 overflow-y-auto sm:px-8 sm:py-10">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-wide mb-1">Settings</h1>
          <p className="text-muted text-sm sm:text-base">Configure integrations and manage your team</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleWhatsAppAutoSend}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              settings.whatsapp_auto_send === '1'
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-panel border-default text-muted'
            }`}
            title="Toggle all WhatsApp auto messages"
          >
            {settings.whatsapp_auto_send === '1' ? 'WhatsApp: ON' : 'WhatsApp: OFF'}
          </button>
          <button onClick={logout} className="btn-ghost text-sm hover:text-accent flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ['integrations', 'Integrations'],
          ['tasks', 'Task templates'],
          ['team', 'Team'],
          ['webhook', 'Webhook'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSettingsTab(id)}
            className={settingsTab === id ? 'chip-active' : 'chip hover:border-accent/40'}>
            {label}
          </button>
        ))}
      </div>

      {(settingsTab === 'integrations') && (
      <>
      {/* GreenAPI */}
      <section className="card p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1 tracking-wide">WhatsApp Integration</h2>
        <p className="text-muted text-sm mb-5">GreenAPI credentials and auto-message schedule</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="section-label block mb-2">GreenAPI Instance ID</label>
            <input type="text" value={settings.greenapi_instance_id}
              onChange={e => setSettings({ ...settings, greenapi_instance_id: e.target.value })}
              placeholder="e.g. 7107574780" className={inputClass} />
          </div>
          <div>
            <label className="section-label block mb-2">GreenAPI API Token</label>
            <input type="password" value={settings.greenapi_api_token}
              onChange={e => setSettings({ ...settings, greenapi_api_token: e.target.value })}
              placeholder="Your API token..." className={inputClass} />
          </div>
          <div>
            <label className="section-label block mb-2">GreenAPI API URL</label>
            <input type="text" value={settings.greenapi_api_url}
              onChange={e => setSettings({ ...settings, greenapi_api_url: e.target.value })}
              placeholder="e.g. https://7107.api.greenapi.com" className={inputClass} />
            <p className="text-muted text-xs mt-1.5">
              Found in your GreenAPI dashboard under Instance settings (apiUrl field).
            </p>
          </div>

          {/* Test button */}
          <div className="pt-1">
            <button onClick={testWhatsApp} disabled={testing} className="btn-secondary disabled:opacity-50 flex items-center gap-2">
              {testing ? (
                <><span className="animate-spin inline-block">⟳</span> Sending test…</>
              ) : (
                <>📤 Send Test Message</>
              )}
            </button>
            <p className="text-muted text-xs mt-1.5">Sends a test WhatsApp to all team members using the saved credentials.</p>

            {testError && (
              <div className="mt-3 p-3 bg-accent/5 border border-accent/20 rounded-2xl text-sm text-accent">
                {testError}
              </div>
            )}
            {testResult && (
              <div className={`mt-3 p-3 rounded-2xl border text-sm ${
                testResult.successCount === testResult.total
                  ? 'bg-accent/5 border-accent/20 text-accent'
                  : 'bg-sand/40 border-default text-ink'
              }`}>
                <p className="font-bold mb-1.5">
                  {testResult.successCount === testResult.total
                    ? `✓ Sent to all ${testResult.total} member${testResult.total !== 1 ? 's' : ''}`
                    : `⚠ Sent ${testResult.successCount} / ${testResult.total}`}
                </p>
                <div className="flex flex-col gap-1">
                  {testResult.report.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>{r.ok ? '✓' : '✗'}</span>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-xs opacity-70">+{r.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="section-label block mb-2">Reminder Interval</label>
            <select value={settings.reminder_interval_minutes}
              onChange={e => setSettings({ ...settings, reminder_interval_minutes: e.target.value })}
              className={inputClass}>
              <option value="60">Every 60 minutes</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
              <option value="1440">Every 24 hours</option>
            </select>
            <p className="text-muted text-xs mt-1.5">
              Sends pending task reminders to each assignee at this interval (only when there are incomplete tasks).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-default pt-5 mt-1">
            <button type="button" onClick={saveSettings} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm'}
            </button>
            {savedMsg && (
              <span className={`text-sm font-medium ${savedMsg.startsWith('Error') ? 'text-accent' : 'text-accent'}`}>
                {savedMsg}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* WhatsApp Auto-Import */}
      <section className="card p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1 tracking-wide">WhatsApp Auto-Import</h2>
        <p className="text-muted text-sm mb-5">
          Every message posted in this group — image or text-only — is automatically added to the dashboard. The AI reads
          the text to detect brand/model/ref/stock no., and figures out whether it&apos;s a buy (&ldquo;Seller: …&rdquo;) or sale
          (&ldquo;Sold to: …&rdquo;). If a picture is attached it&apos;s saved on the watch; otherwise the watch is created without one.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="section-label block mb-2">Group ID <span className="text-accent normal-case tracking-normal">(preferred)</span></label>
            <input type="text" value={settings.whatsapp_stock_group_id}
              onChange={e => setSettings({ ...settings, whatsapp_stock_group_id: e.target.value })}
              placeholder="120363420701421193@g.us" className={inputClass} />
            <p className="text-muted text-xs mt-1.5">
              Stable identifier — survives group renames and name collisions. Accept either bare ID (<code className="font-mono">120363…</code>) or full form (<code className="font-mono">120363…@g.us</code>). If set, this is used instead of the name.
            </p>
          </div>
          <div>
            <label className="section-label block mb-2">Group Name <span className="text-muted normal-case tracking-normal">(fallback if ID empty)</span></label>
            <input type="text" value={settings.whatsapp_stock_group_name}
              onChange={e => setSettings({ ...settings, whatsapp_stock_group_name: e.target.value })}
              placeholder="e.g. Purosangue team BUY AND SELL" className={inputClass} />
            <p className="text-muted text-xs mt-1.5">
              Used only when no Group ID is set. Must match the display name exactly.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Recently seen groups</span>
              <button type="button" onClick={fetchRecentGroups} disabled={loadingGroups}
                className="btn-ghost text-xs py-1 px-2 disabled:opacity-50">
                {loadingGroups ? '...' : '↻ Refresh'}
              </button>
            </div>
            {recentGroups.length === 0 ? (
              <p className="text-xs text-muted bg-panel rounded-2xl px-3 py-2 border border-default">
                No groups seen yet. Post any message in the target group and refresh — it&apos;ll show here so you can copy the exact name.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {recentGroups.map(g => {
                  const isSelected = settings.whatsapp_stock_group_id === g.chatId
                  return (
                    <button key={g.chatId} type="button"
                      onClick={() => setSettings({ ...settings, whatsapp_stock_group_id: g.chatId, whatsapp_stock_group_name: g.chatName })}
                      className={`text-left px-3 py-2 rounded-2xl border text-sm transition-colors ${
                        isSelected
                          ? 'bg-accent/10 border-accent/30 text-accent'
                          : 'bg-panel border-default hover:border-accent/30 text-ink'
                      }`}>
                      <div className="font-medium">{g.chatName} {isSelected && <span className="text-[10px] ml-1">✓ active</span>}</div>
                      <div className="text-[10px] text-muted font-mono">{g.chatId}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent webhook activity — diagnostic panel */}
          <div className="border-t border-default pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Recent webhook activity</span>
              <button type="button" onClick={fetchRecentHits} disabled={loadingHits}
                className="btn-ghost text-xs py-1 px-2 disabled:opacity-50">
                {loadingHits ? '...' : '↻ Refresh'}
              </button>
            </div>
            {recentHits.length === 0 ? (
              <p className="text-xs text-muted bg-panel rounded-2xl px-3 py-2 border border-default">
                Nothing logged yet. If you just sent a message in the group and see nothing here after Refresh, the webhook URL probably isn&apos;t configured in your GreenAPI dashboard. Set it to <code className="font-mono text-[10px]">/api/webhook/greenapi</code> on this domain.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                {recentHits.map((h, i) => {
                  const isOk = h.outcome.startsWith('✓')
                  const isErr = h.outcome.startsWith('ERROR')
                  return (
                    <div key={i} className={`px-3 py-2 rounded-2xl border text-xs ${
                      isOk ? 'bg-accent/5 border-accent/20 text-accent'
                      : isErr ? 'bg-panel border-default text-ink'
                      : 'bg-panel border-default text-muted'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{h.outcome}</span>
                        <span className="text-[10px] text-muted flex-shrink-0 font-mono">{new Date(h.ts).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[10px] text-muted mt-0.5 font-mono">
                        {h.chatName || '(no name)'} · {h.msgType || 'no type'}{h.hasImage ? ' · 📷' : ''}
                      </div>
                      {h.caption && (
                        <div className="text-[10px] text-muted mt-0.5 truncate italic">&ldquo;{h.caption.slice(0, 100)}&rdquo;</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-default mt-6 pt-5">
          <button type="button" onClick={saveSettings} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
            {saving ? 'Saving…' : 'Confirm'}
          </button>
          {savedMsg && (
            <span className={`text-sm font-medium ${savedMsg.startsWith('Error') ? 'text-accent' : 'text-accent'}`}>
              {savedMsg}
            </span>
          )}
        </div>
      </section>
      </>
      )}

      {(settingsTab === 'tasks') && (
      <>
      {/* Task Assignment Defaults */}
      <section className="card p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1 tracking-wide">Task Assignment Defaults</h2>
        <p className="text-muted text-sm mb-5">Who is auto-assigned to each task when a new watch is added or Auto Assign is clicked.</p>
        <div className="flex flex-col gap-5">
          {TASK_DEFAULT_ROWS.map(({ dept, items }) => {
            const cfg = DEPT_CONFIG[dept]
            return (
              <div key={dept}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 border ${cfg.bg} ${cfg.border}`}>
                  <span>{cfg.icon}</span>
                  <span className={`text-sm font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="flex flex-col gap-2 pl-1">
                  {items.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-muted text-sm w-44 flex-shrink-0">{label}</span>
                      <select
                        value={taskDefaults[key] || ''}
                        onChange={e => setTaskDefaults(prev => ({ ...prev, [key]: e.target.value }))}
                        className="input-field flex-1 py-2 text-sm"
                      >
                        <option value="">— Not set —</option>
                        {members.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={saveSettings} disabled={saving} className="btn-primary px-8 py-3 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {savedMsg && (
          <span className={`text-sm font-medium ${savedMsg.startsWith('Error') ? 'text-accent' : 'text-accent'}`}>
            {savedMsg}
          </span>
        )}
      </div>

      {/* Task Management */}
      <section className="card p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1 tracking-wide">Task Management</h2>
        <p className="text-muted text-sm mb-5">Configure tasks created when a watch is added (Buy) or sold (Sell).</p>

        <div className="mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-3 border bg-panel border-default">
            <span className="text-sm font-semibold uppercase tracking-wide text-ink">Buy Tasks</span>
            <span className="ml-auto text-xs text-muted">{templates.filter(t => t.phase === 'BUY').length} tasks</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {templates.filter(t => t.phase === 'BUY').map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-panel rounded-2xl border border-default">
                <span className="text-muted text-xs w-20 flex-shrink-0">{t.department}</span>
                <span className="text-ink text-sm flex-1 min-w-0">{t.label}</span>
                <select
                  value={t.default_assignee || ''}
                  onChange={e => updateTemplateAssignee(t.id, e.target.value)}
                  className="input-field py-1 text-xs w-28 flex-shrink-0"
                >
                  <option value="">No assignee</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {t.is_builtin
                  ? <span className="text-[10px] text-muted border border-default rounded-full px-2 py-0.5 flex-shrink-0">Built-in</span>
                  : <button onClick={() => deleteTemplate(t.id)} className="text-muted hover:text-accent text-sm transition-colors flex-shrink-0">✕</button>
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <select value={newBuyTask.department} onChange={e => setNewBuyTask(p => ({ ...p, department: e.target.value }))}
              className="input-field py-2 text-sm w-auto">
              <option value="ACCOUNTING">Accounting</option>
              <option value="SALES">Sales</option>
              <option value="LOGISTICS">Logistics</option>
            </select>
            <input type="text" value={newBuyTask.label} onChange={e => setNewBuyTask(p => ({ ...p, label: e.target.value }))}
              placeholder="Task name..." onKeyDown={e => e.key === 'Enter' && addTemplate('BUY')}
              className="input-field flex-1 min-w-0 py-2 text-sm" />
            <select value={newBuyTask.default_assignee} onChange={e => setNewBuyTask(p => ({ ...p, default_assignee: e.target.value }))}
              className="input-field py-2 text-sm w-auto">
              <option value="">No assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button onClick={() => addTemplate('BUY')} disabled={!newBuyTask.label.trim() || addingTemplate}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Add</button>
          </div>
        </div>

        {/* Sell Tasks */}
        <div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-3 border bg-accent/5 border-accent/20">
            <span className="text-sm font-semibold uppercase tracking-wide text-accent">Sell Tasks</span>
            <span className="ml-auto text-xs text-muted">{templates.filter(t => t.phase === 'SELL').length} tasks</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {templates.filter(t => t.phase === 'SELL').map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-panel rounded-2xl border border-default">
                <span className="text-muted text-xs w-20 flex-shrink-0">{t.department}</span>
                <span className="text-ink text-sm flex-1 min-w-0">{t.label}</span>
                <select
                  value={t.default_assignee || ''}
                  onChange={e => updateTemplateAssignee(t.id, e.target.value)}
                  className="input-field py-1 text-xs w-28 flex-shrink-0"
                >
                  <option value="">No assignee</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {t.is_builtin
                  ? <span className="text-[10px] text-muted border border-default rounded-full px-2 py-0.5 flex-shrink-0">Built-in</span>
                  : <button onClick={() => deleteTemplate(t.id)} className="text-muted hover:text-accent text-sm transition-colors flex-shrink-0">✕</button>
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <select value={newSellTask.department} onChange={e => setNewSellTask(p => ({ ...p, department: e.target.value }))}
              className="input-field py-2 text-sm w-auto">
              <option value="ACCOUNTING">Accounting</option>
              <option value="SALES">Sales</option>
              <option value="LOGISTICS">Logistics</option>
            </select>
            <input type="text" value={newSellTask.label} onChange={e => setNewSellTask(p => ({ ...p, label: e.target.value }))}
              placeholder="Task name..." onKeyDown={e => e.key === 'Enter' && addTemplate('SELL')}
              className="input-field flex-1 min-w-0 py-2 text-sm" />
            <select value={newSellTask.default_assignee} onChange={e => setNewSellTask(p => ({ ...p, default_assignee: e.target.value }))}
              className="input-field py-2 text-sm w-auto">
              <option value="">No assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button onClick={() => addTemplate('SELL')} disabled={!newSellTask.label.trim() || addingTemplate}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Add</button>
          </div>
        </div>
      </section>
      </>
      )}

      {(settingsTab === 'team') && (
      <>
      {/* Team Members grouped by department */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-semibold text-ink tracking-wide">Team Members</h2>
          <span className="text-muted text-sm bg-panel px-3 py-1 rounded-full border border-default">
            {members.length} total
          </span>
        </div>
        <p className="text-muted text-sm mb-5">
          Grouped by department. WhatsApp format: 92XXXXXXXXXX
        </p>

        {/* Members by dept */}
        {DEPT_ORDER.map(dept => {
          const cfg = DEPT_CONFIG[dept]
          const deptMembers = membersByDept(dept)
          return (
            <div key={dept} className="mb-5">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 border ${cfg.bg} ${cfg.border}`}>
                <span>{cfg.icon}</span>
                <span className={`text-sm font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                <span className="text-muted text-xs ml-auto">{deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}</span>
              </div>

              {deptMembers.length === 0 ? (
                <div className="text-muted text-sm text-center py-4 bg-panel rounded-2xl border border-default">
                  No members in {cfg.label} yet
                </div>
              ) : (
                <div className="space-y-2">
                  {deptMembers.map(member => (
                    <div key={member.id}
                      className="flex items-center justify-between bg-panel rounded-2xl px-4 py-3 border border-default">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-card font-bold flex-shrink-0 bg-ink">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-ink font-medium text-base">{member.name}</p>
                          {editingMember === member.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="text"
                                value={editNumber}
                                autoFocus
                                onChange={e => setEditNumber(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveMemberNumber(member.id); if (e.key === 'Escape') { setEditingMember(null); setMemberError('') } }}
                                placeholder="923001234567"
                                className="input-field text-sm py-1 px-2 w-44"
                              />
                              <button onClick={() => saveMemberNumber(member.id)} disabled={savingNumber}
                                className="btn-primary text-xs py-1 px-3 disabled:opacity-50">{savingNumber ? '…' : 'Save'}</button>
                              <button onClick={() => { setEditingMember(null); setMemberError('') }}
                                className="btn-ghost text-xs py-1 px-3">Cancel</button>
                            </div>
                          ) : (
                            <p className="text-muted text-sm">+{member.whatsapp_number}</p>
                          )}
                        </div>
                      </div>

                      {editingMember === member.id ? null : deleteConfirm === member.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-muted text-sm">Remove?</span>
                          <button onClick={() => deleteMember(member.id)} className="btn-primary text-xs py-1 px-3">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="btn-ghost text-xs py-1 px-3">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => startEditNumber(member.id, member.whatsapp_number)}
                            title="Edit number"
                            className="text-muted hover:text-ink transition-colors p-2 rounded-full hover:bg-card">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(member.id)}
                            title="Remove member"
                            className="text-muted hover:text-accent transition-colors p-2 rounded-full hover:bg-card">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Add member form */}
        <form onSubmit={addMember} className="border-t border-default pt-6 mt-4">
          <p className="text-muted text-sm mb-3 font-medium">Add new member</p>

          {/* Department selector */}
          <div className="flex gap-2 mb-3">
            {DEPT_ORDER.map(dept => {
              const cfg = DEPT_CONFIG[dept]
              const active = newMember.department === dept
              return (
                <button key={dept} type="button"
                  onClick={() => setNewMember({ ...newMember, department: dept })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl border text-sm font-semibold transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                      : 'bg-panel border-default text-muted hover:text-ink'
                  }`}>
                  <span>{cfg.icon}</span> {cfg.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <input type="text" value={newMember.name}
              onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="Full name"
              className="input-field flex-1" />
            <input type="text" value={newMember.whatsapp_number}
              onChange={e => setNewMember({ ...newMember, whatsapp_number: e.target.value })}
              placeholder="923001234567"
              className="input-field flex-1" />
            <button type="submit" disabled={addingMember} className="btn-primary whitespace-nowrap disabled:opacity-50">
              {addingMember ? '...' : 'Add'}
            </button>
          </div>
          {memberError && (
            <p className="text-accent text-sm mt-2 bg-accent/5 rounded-2xl px-3 py-2 border border-accent/20">{memberError}</p>
          )}
        </form>
      </section>
      </>
      )}

      {(settingsTab === 'webhook') && (
      <>
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-1 tracking-wide">Webhook URL</h2>
        <p className="text-muted text-sm mb-4">Set this in GreenAPI → Instance settings → Webhooks</p>
        <div className="bg-panel rounded-2xl px-4 py-3 font-mono text-sm text-accent border border-default select-all">
          {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.onrender.com'}/api/webhook/greenapi
        </div>
      </section>
      </>
      )}

      <div className="h-8" />
    </div>
  )
}
