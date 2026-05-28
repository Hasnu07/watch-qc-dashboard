export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#c7c4d8] overflow-hidden animate-pulse">
      <div className="h-8 bg-slate-100" />
      <div className="h-16 bg-slate-50" />
      <div className="aspect-[4/3] bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-5 bg-slate-100 rounded w-2/3" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 bg-slate-50 rounded-xl" />
          <div className="h-14 bg-slate-50 rounded-xl" />
        </div>
        <div className="h-10 bg-slate-50 rounded-full" />
      </div>
    </div>
  )
}
