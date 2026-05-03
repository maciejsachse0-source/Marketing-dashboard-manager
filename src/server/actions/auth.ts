'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkCredentials, createSession, destroySession } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email({ error: 'Podaj poprawny email.' }).trim(),
  password: z.string().min(1, { error: 'Wpisz hasło.' }),
});

export type LoginState = {
  error?: string;
  email?: string;
} | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Niepoprawne dane.';
    return { error: first, email: String(formData.get('email') ?? '') };
  }

  const { email, password } = parsed.data;
  if (!checkCredentials(email, password)) {
    return { error: 'Niepoprawny email lub hasło.', email };
  }

  await createSession(email);
  // Honour ?next= so users who deep-linked into a gated page land back
  // there. Strict relative-path check rejects open-redirect payloads
  // (`//attacker.com`, `https://...`) and anything that doesn't start
  // with a single slash.
  const nextRaw = formData.get('next');
  const safeNext =
    typeof nextRaw === 'string' && nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : '/';
  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
