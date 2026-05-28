export default function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-10 bg-panel" />
      <div className="aspect-[4/3] bg-panel" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-panel rounded-full w-1/4" />
        <div className="h-5 bg-panel rounded-full w-2/3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-panel rounded-2xl" />
          <div className="h-16 bg-panel rounded-2xl" />
        </div>
        <div className="h-10 bg-panel rounded-full" />
      </div>
    </div>
  )
}
