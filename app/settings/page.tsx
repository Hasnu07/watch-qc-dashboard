'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
}

const TASK_DEFAULT_ROWS = [
  { dept: 'ACCOUNTING' as Department, items: [{ key: 'ACCOUNTING_MARK_PAYMENT', label: 'Mark Payment Status' }] },
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
  LOGISTICS: { label: 'Logistics', icon: '📦', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  SALES: { label: 'Sales', icon: '🤝', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function SettingsPage() {
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const [settings, setSettings] = useState<Settings>({
    greenapi_instance_id: '',
    greenapi_api_token: '',
    greenapi_api_url: 'https://api.green-api.com',
    reminder_interval_minutes: '180',
  })
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

  const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors'

  const membersByDept = (dept: Department) => members.filter(m => m.department === dept)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex-1 overflow-y-auto sm:px-6 sm:py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 sm:text-3xl">⚙️ Settings</h1>
          <p className="text-slate-500 font-medium text-sm sm:text-base">Configure integrations and manage your team</p>
        </div>
        <button onClick={logout}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl text-sm font-semibold border border-slate-200 hover:border-red-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>

      {/* GreenAPI */}
      <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-1 flex items-center gap-2">💬 WhatsApp Integration</h2>
        <p className="text-slate-500 text-sm mb-5">GreenAPI credentials and auto-message schedule</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-slate-500 block mb-1.5">GreenAPI Instance ID</label>
            <input type="text" value={settings.greenapi_instance_id}
              onChange={e => setSettings({ ...settings, greenapi_instance_id: e.target.value })}
              placeholder="e.g. 7107574780" className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1.5">GreenAPI API Token</label>
            <input type="password" value={settings.greenapi_api_token}
              onChange={e => setSettings({ ...settings, greenapi_api_token: e.target.value })}
              placeholder="Your API token..." className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1.5">GreenAPI API URL</label>
            <input type="text" value={settings.greenapi_api_url}
              onChange={e => setSettings({ ...settings, greenapi_api_url: e.target.value })}
              placeholder="e.g. https://7107.api.greenapi.com" className={inputClass} />
            <p className="text-slate-400 text-xs mt-1.5">
              Found in your GreenAPI dashboard under Instance settings (apiUrl field).
            </p>
          </div>

          {/* Test button */}
          <div className="pt-1">
            <button onClick={testWhatsApp} disabled={testing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2">
              {testing ? (
                <><span className="animate-spin inline-block">⟳</span> Sending test…</>
              ) : (
                <>📤 Send Test Message</>
              )}
            </button>
            <p className="text-slate-400 text-xs mt-1.5">Sends a test WhatsApp to all team members using the saved credentials.</p>

            {testError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                ✗ {testError}
              </div>
            )}
            {testResult && (
              <div className={`mt-3 p-3 rounded-xl border text-sm ${
                testResult.successCount === testResult.total
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
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
            <label className="text-sm text-slate-500 block mb-1.5">Reminder Interval</label>
            <select value={settings.reminder_interval_minutes}
              onChange={e => setSettings({ ...settings, reminder_interval_minutes: e.target.value })}
              className={inputClass}>
              <option value="60">Every 60 minutes</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
              <option value="1440">Every 24 hours</option>
            </select>
            <p className="text-slate-400 text-xs mt-1.5">
              Sends pending task reminders to each department at this interval (only when there are incomplete tasks).
            </p>
          </div>
        </div>
      </section>

      {/* Task Assignment Defaults */}
      <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-1 flex items-center gap-2">📋 Task Assignment Defaults</h2>
        <p className="text-slate-500 text-sm mb-5">Who is auto-assigned to each task when a new watch is added or Auto Assign is clicked.</p>
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
                      <span className="text-slate-600 text-sm w-44 flex-shrink-0">{label}</span>
                      <select
                        value={taskDefaults[key] || ''}
                        onChange={e => setTaskDefaults(prev => ({ ...prev, [key]: e.target.value }))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-400 transition-colors"
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
        <button onClick={saveSettings} disabled={saving}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-base transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {savedMsg && (
          <span className={`text-sm font-medium ${savedMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
            {savedMsg}
          </span>
        )}
      </div>

      {/* Task Management */}
      <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-1 flex items-center gap-2">📝 Task Management</h2>
        <p className="text-slate-500 text-sm mb-5">Configure tasks created when a watch is added (Buy) or sold (Sell). Set who each task is assigned to by default.</p>

        {/* Buy Tasks */}
        <div className="mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 border bg-indigo-50 border-indigo-200">
            <span>🛒</span>
            <span className="text-sm font-bold uppercase tracking-wide text-indigo-700">Buy Tasks</span>
            <span className="ml-auto text-xs text-indigo-500">{templates.filter(t => t.phase === 'BUY').length} tasks</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {templates.filter(t => t.phase === 'BUY').map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-xs w-20 flex-shrink-0">{
                  t.department === 'ACCOUNTING' ? '💰' : t.department === 'SALES' ? '🤝' : '📦'
                } {t.department}</span>
                <span className="text-slate-800 text-sm flex-1 min-w-0">{t.label}</span>
                <select
                  value={t.default_assignee || ''}
                  onChange={e => updateTemplateAssignee(t.id, e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-400 w-28 flex-shrink-0"
                >
                  <option value="">No assignee</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {t.is_builtin
                  ? <span className="text-[10px] text-slate-400 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">Built-in</span>
                  : <button onClick={() => deleteTemplate(t.id)} className="text-slate-300 hover:text-red-500 text-sm transition-colors flex-shrink-0">✕</button>
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <select value={newBuyTask.department} onChange={e => setNewBuyTask(p => ({ ...p, department: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-400">
              <option value="ACCOUNTING">💰 Accounting</option>
              <option value="SALES">🤝 Sales</option>
              <option value="LOGISTICS">📦 Logistics</option>
            </select>
            <input type="text" value={newBuyTask.label} onChange={e => setNewBuyTask(p => ({ ...p, label: e.target.value }))}
              placeholder="Task name..." onKeyDown={e => e.key === 'Enter' && addTemplate('BUY')}
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-400" />
            <select value={newBuyTask.default_assignee} onChange={e => setNewBuyTask(p => ({ ...p, default_assignee: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-400">
              <option value="">No assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button onClick={() => addTemplate('BUY')} disabled={!newBuyTask.label.trim() || addingTemplate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Add</button>
          </div>
        </div>

        {/* Sell Tasks */}
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 border bg-orange-50 border-orange-200">
            <span>🏷️</span>
            <span className="text-sm font-bold uppercase tracking-wide text-orange-700">Sell Tasks</span>
            <span className="ml-auto text-xs text-orange-500">{templates.filter(t => t.phase === 'SELL').length} tasks</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {templates.filter(t => t.phase === 'SELL').map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-xs w-20 flex-shrink-0">{
                  t.department === 'ACCOUNTING' ? '💰' : t.department === 'SALES' ? '🤝' : '📦'
                } {t.department}</span>
                <span className="text-slate-800 text-sm flex-1 min-w-0">{t.label}</span>
                <select
                  value={t.default_assignee || ''}
                  onChange={e => updateTemplateAssignee(t.id, e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-orange-400 w-28 flex-shrink-0"
                >
                  <option value="">No assignee</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {t.is_builtin
                  ? <span className="text-[10px] text-slate-400 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">Built-in</span>
                  : <button onClick={() => deleteTemplate(t.id)} className="text-slate-300 hover:text-red-500 text-sm transition-colors flex-shrink-0">✕</button>
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <select value={newSellTask.department} onChange={e => setNewSellTask(p => ({ ...p, department: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-400">
              <option value="ACCOUNTING">💰 Accounting</option>
              <option value="SALES">🤝 Sales</option>
              <option value="LOGISTICS">📦 Logistics</option>
            </select>
            <input type="text" value={newSellTask.label} onChange={e => setNewSellTask(p => ({ ...p, label: e.target.value }))}
              placeholder="Task name..." onKeyDown={e => e.key === 'Enter' && addTemplate('SELL')}
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-400" />
            <select value={newSellTask.default_assignee} onChange={e => setNewSellTask(p => ({ ...p, default_assignee: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-400">
              <option value="">No assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button onClick={() => addTemplate('SELL')} disabled={!newSellTask.label.trim() || addingTemplate}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Add</button>
          </div>
        </div>
      </section>

      {/* Team Members grouped by department */}
      <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">👥 Team Members</h2>
          <span className="text-slate-400 text-sm bg-slate-100 px-3 py-1 rounded-full">
            {members.length} total
          </span>
        </div>
        <p className="text-slate-400 text-sm mb-5">
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
                <span className="text-slate-400 text-xs ml-auto">{deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}</span>
              </div>

              {deptMembers.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-3 bg-slate-50 rounded-xl border border-slate-100">
                  No members in {cfg.label} yet
                </div>
              ) : (
                <div className="space-y-2">
                  {deptMembers.map(member => (
                    <div key={member.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                          dept === 'LOGISTICS' ? 'bg-blue-500' : dept === 'ACCOUNTING' ? 'bg-amber-500' : 'bg-green-500'
                        }`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-slate-900 font-medium text-base">{member.name}</p>
                          <p className="text-slate-400 text-sm">+{member.whatsapp_number}</p>
                        </div>
                      </div>

                      {deleteConfirm === member.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">Remove?</span>
                          <button onClick={() => deleteMember(member.id)}
                            className="px-3 py-1 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(member.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Add member form */}
        <form onSubmit={addMember} className="border-t border-slate-200 pt-5 mt-2">
          <p className="text-slate-500 text-sm mb-3 font-medium">Add new member</p>

          {/* Department selector */}
          <div className="flex gap-2 mb-3">
            {DEPT_ORDER.map(dept => {
              const cfg = DEPT_CONFIG[dept]
              const active = newMember.department === dept
              return (
                <button key={dept} type="button"
                  onClick={() => setNewMember({ ...newMember, department: dept })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
            <input type="text" value={newMember.whatsapp_number}
              onChange={e => setNewMember({ ...newMember, whatsapp_number: e.target.value })}
              placeholder="923001234567"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
            <button type="submit" disabled={addingMember}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-base transition-colors disabled:opacity-50 whitespace-nowrap">
              {addingMember ? '...' : 'Add'}
            </button>
          </div>
          {memberError && (
            <p className="text-red-600 text-sm mt-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{memberError}</p>
          )}
        </form>
      </section>

      {/* Webhook info */}
      <section className="bg-white rounded-2xl border-2 border-slate-200 p-6 mt-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-1 flex items-center gap-2">🔗 Webhook URL</h2>
        <p className="text-slate-400 text-sm mb-4">Set this in GreenAPI → Instance settings → Webhooks</p>
        <div className="bg-slate-50 rounded-xl px-4 py-3 font-mono text-sm text-blue-600 border border-slate-200 select-all">
          {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.onrender.com'}/api/webhook/greenapi
        </div>
      </section>

      <div className="h-8" />
    </div>
  )
}
