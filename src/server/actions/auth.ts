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
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
