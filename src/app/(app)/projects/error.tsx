"use client"

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-sm font-semibold text-danger">
        Algo deu errado
      </div>
      <pre className="max-w-md whitespace-pre-wrap break-all rounded-sm border border-danger/30 bg-surface p-3 text-[10px] font-mono text-danger/70">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="h-8 px-4 text-[10px] font-mono font-semibold tracking-wider border border-teal text-teal rounded-sm hover:bg-teal/10 transition-colors"
      >
        TENTAR NOVAMENTE
      </button>
    </div>
  )
}
