import { Mail, Briefcase } from 'lucide-react';
import { PersonAvatar } from '@/components/productions/artist-avatar';

export type OtherPerson = {
  name: string;
  role: string;
  email?: string;
  description?: string;
};

/**
 * "Inne" — internal team members who aren't artists or videographers but show
 * up in the team page so the org chart is complete in one place. Read-only by
 * design: this list is short and stable, edited in code rather than via UI.
 */
export const OTHER_TEAM: OtherPerson[] = [
  {
    name: 'Jan Sachse',
    role: 'Marketing & koordynacja',
    email: 'jan.sachse@assecods.pl',
    description: 'Prowadzi dyspozytornię kampanii — kalendarz, produkcje, agenci AI.',
  },
  {
    name: 'Maciej Sachse',
    role: 'Zespół wewnętrzny',
    description: 'Wsparcie operacyjne i strategia.',
  },
];

export function OthersShell({ people = OTHER_TEAM }: { people?: OtherPerson[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {people.map((p) => (
        <OtherCard key={p.name} person={p} />
      ))}
    </div>
  );
}

function OtherCard({ person }: { person: OtherPerson }) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-foreground/20 transition flex flex-col">
      <div className="flex items-start gap-3">
        <PersonAvatar name={person.name} size="xl" kind="other" showBadge={false} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base leading-tight truncate">{person.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <Briefcase className="w-3 h-3 shrink-0" />
            <span className="truncate">{person.role}</span>
          </p>
        </div>
      </div>

      {person.description ? (
        <p className="mt-3 text-xs text-foreground/85 leading-relaxed">{person.description}</p>
      ) : null}

      {person.email ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <a
            href={`mailto:${person.email}`}
            className="flex items-center gap-1.5 hover:text-foreground truncate"
          >
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{person.email}</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
