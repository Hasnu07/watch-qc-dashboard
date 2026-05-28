'use client'

interface Props {
  watchName: string
  stockNo?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmRemoveModal({ watchName, stockNo, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="card w-full max-w-sm shadow-none p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-1 tracking-wide">Remove watch?</h3>
        <p className="text-sm text-muted mb-1">
          <span className="font-semibold text-ink">{watchName}</span>
          {stockNo && <span className="font-mono-data"> · #{stockNo}</span>}
        </p>
        <p className="text-xs text-muted mb-5">Deletes watch and tasks. No WhatsApp notification.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-ghost">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
