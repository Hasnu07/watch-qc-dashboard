'use client'

import { useState, useEffect, useCallback } from 'react'

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
  reminder_interval_minutes: string
}

const DEPT_CONFIG = {
  LOGISTICS: { label: 'Logistics', icon: '📦', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  SALES: { label: 'Sales', icon: '🤝', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    greenapi_instance_id: '',
    greenapi_api_token: '',
    reminder_interval_minutes: '20',
  })
  const [members, setMembers] = useState<TeamMember[]>([])
  const [newMember, setNewMember] = useState({ name: '', whatsapp_number: '', department: 'LOGISTICS' as Department })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) setSettings(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { fetchSettings(); fetchMembers() }, [fetchSettings, fetchMembers])

  const saveSettings = async () => {
    setSaving(true); setSavedMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed')
      setSavedMsg('Settings saved!')
      setTimeout(() => setSavedMsg(''), 3000)
    } catch { setSavedMsg('Error saving.') }
    finally { setSaving(false) }
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
    <div className="max-w-3xl mx-auto px-6 py-8 flex-1 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-1">⚙️ Settings</h1>
        <p className="text-slate-500 font-medium">Configure integrations and manage your team</p>
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
            <label className="text-sm text-slate-500 block mb-1.5">Reminder Interval</label>
            <select value={settings.reminder_interval_minutes}
              onChange={e => setSettings({ ...settings, reminder_interval_minutes: e.target.value })}
              className={inputClass}>
              <option value="15">Every 15 minutes</option>
              <option value="20">Every 20 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
            <p className="text-slate-400 text-xs mt-1.5">
              Sends pending task reminders to each department at this interval (only when there are incomplete tasks).
            </p>
          </div>
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

          <div className="flex gap-3">
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
