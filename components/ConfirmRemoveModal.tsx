'use client'

interface Props {
  watchName: string
  stockNo?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmRemoveModal({ watchName, stockNo, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-slate-900 mb-1">Remove watch?</h3>
        <p className="text-sm text-slate-600 mb-1">
          <span className="font-semibold">{watchName}</span>
          {stockNo && <span className="text-slate-400"> · #{stockNo}</span>}
        </p>
        <p className="text-xs text-slate-400 mb-5">Deletes watch and tasks. No WhatsApp notification.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
