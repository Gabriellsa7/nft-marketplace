export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold tracking-[0.2em]">KURIO</span>
          <span className="text-xs text-muted-foreground">Feito para colecionadores, criadores e cultura.</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
      </div>
    </footer>
  )
}
