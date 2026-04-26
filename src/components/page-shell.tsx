export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
