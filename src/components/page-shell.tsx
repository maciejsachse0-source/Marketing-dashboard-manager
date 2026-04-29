export function PageShell({
  title,
  description,
  actions,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative px-4 sm:px-6 lg:px-10 pt-16 lg:pt-12 pb-12 max-w-[1800px] mx-auto w-full">
      {/* Ambient blue blob — top-right of the content area */}
      <div
        aria-hidden
        className="blob blob-tint pointer-events-none"
        style={{
          width: '36rem',
          height: '36rem',
          top: '-8rem',
          right: '-12rem',
          opacity: 0.4,
        }}
      />
      <header className="relative mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
        <div className="min-w-0 flex flex-col gap-3">
          {eyebrow ? (
            <span className="pill-label pill-label-sm pill-label-outline self-start">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="display-lg text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm sm:text-[0.95rem] text-muted-foreground max-w-2xl leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </header>
      <div className="relative animate-fade-in" style={{ animationDelay: '120ms' }}>
        {children}
      </div>
    </div>
  );
}
