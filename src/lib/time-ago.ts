export function timeAgo(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'przed chwilą';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min temu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} godz temu`;
  const day = Math.floor(hour / 24);
  if (day === 1) return 'wczoraj';
  if (day < 7) return `${day} dni temu`;
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
}
