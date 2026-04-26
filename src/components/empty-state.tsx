import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-12 text-center flex flex-col items-center gap-3">
      {Icon ? (
        <div className="w-10 h-10 rounded-full bg-muted/40 grid place-items-center">
          <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
