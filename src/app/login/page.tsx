import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getSessionEmail } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Logowanie · Marketing Crew',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const email = await getSessionEmail();
  const sp = await searchParams;
  const next =
    typeof sp.next === 'string' && sp.next.startsWith('/') && !sp.next.startsWith('//')
      ? sp.next
      : undefined;
  if (email) redirect(next ?? '/');

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 py-10 bg-background">
      <LoginForm next={next} />
    </div>
  );
}
