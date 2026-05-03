'use client';

import { useActionState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type LoginState } from '@/server/actions/auth';

const initialState: LoginState = undefined;

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="w-full max-w-sm">
      <div className="card-editorial p-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-12 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, var(--accent-blue-soft) 0%, transparent 70%)',
            opacity: 0.5,
            filter: 'blur(24px)',
          }}
        />
        <div className="relative flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-foreground grid place-items-center">
            <Sparkles className="w-5 h-5 text-background" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">Marketing Crew</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
              dyspozytornia
            </div>
          </div>
        </div>

        <h1 className="relative text-xl font-semibold tracking-tight mb-1">Zaloguj się</h1>
        <p className="relative text-xs text-muted-foreground mb-6">
          Dostęp tylko dla zalogowanych.
        </p>

        <form action={action} className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              key={state?.email ?? ''}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state?.email ?? ''}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error ? (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-2">
              {state.error}
            </div>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full mt-1">
            {pending ? 'Logowanie…' : 'Zaloguj'}
          </Button>
        </form>
      </div>
    </div>
  );
}
