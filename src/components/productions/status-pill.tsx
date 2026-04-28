import type { ProductionStatus } from '../../../drizzle/schema';

const STATUS_COLORS: Record<ProductionStatus, string> = {
  'email-sent': 'bg-amber-100 text-amber-800 border-amber-300',
  'terms-accepted': 'bg-amber-100 text-amber-800 border-amber-300',
  'cam-meeting-set': 'bg-amber-100 text-amber-800 border-amber-300',
  'cam-date-shared': 'bg-violet-100 text-violet-800 border-violet-300',
  'script-discussed': 'bg-violet-100 text-violet-800 border-violet-300',
  'script-sent': 'bg-violet-100 text-violet-800 border-violet-300',
  shooting: 'bg-blue-100 text-blue-800 border-blue-300',
  editing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  publishing: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
};

export const STATUS_LABEL: Record<ProductionStatus, string> = {
  'email-sent': 'mail wysłany',
  'terms-accepted': 'warunki akcept',
  'cam-meeting-set': 'data ustalona',
  'cam-date-shared': 'data przekazana',
  'script-discussed': 'scenariusz omówiony',
  'script-sent': 'scenariusz wysłany',
  shooting: 'nagrywki',
  editing: 'obróbka',
  publishing: 'publikacja',
  cancelled: 'anulowane',
};

export function ProductionStatusPill({ status }: { status: ProductionStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProductionTypeBadge({ type }: { type: 'with-artist' | 'solo' }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${
        type === 'with-artist'
          ? 'bg-pink-100 text-pink-800 border-pink-300'
          : 'bg-sky-100 text-sky-800 border-sky-300'
      }`}
    >
      {type === 'with-artist' ? 'z artystą' : 'solo'}
    </span>
  );
}
