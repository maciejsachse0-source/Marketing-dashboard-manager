import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getSessionEmail } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Logowanie · Marketing Crew',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const email = await getSessionEmail();
  if (email) redirect('/');

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 py-10 bg-background">
      <LoginForm />
    </div>
  );
}
