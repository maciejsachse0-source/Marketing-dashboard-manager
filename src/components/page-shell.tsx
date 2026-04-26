export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
