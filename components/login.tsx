'use client';
import { useState } from 'react';
import { Flower2, ArrowRight, LockKeyhole } from 'lucide-react';
export function Login() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/' + (register ? 'sign-up/email' : 'sign-in/email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(register ? { 'x-invitation': String(form.get('invite')) } : {}),
        },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          name: form.get('name') || 'Aneesh',
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok)
        throw new Error(data.message || 'Couldn’t sign in. Check your details and try again.');
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-art">
        <div className="brand">
          <Flower2 size={36} />
          <div>
            <strong>JAYANANDA</strong>
            <span>My Sādhana Journey</span>
          </div>
        </div>
        <div className="login-verse">
          <span className="eyebrow">CONSISTENCY · HUMILITY · SERVICE</span>
          <h1>
            A quiet space.
            <br />A sincere beginning.
          </h1>
          <p>
            Hear. Chant. Read. Serve.
            <br />
            Come back to what matters.
          </p>
        </div>
      </div>
      <section className="login-panel">
        <Flower2 size={36} className="gold" />
        <p className="eyebrow">YOUR PERSONAL JOURNAL</p>
        <h2>{register ? 'Begin your journey' : 'Hare Krishna.'}</h2>
        <p className="muted">
          {register
            ? 'Set up your private space for daily sādhana.'
            : 'Welcome back. Continue from here.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input name="name" required defaultValue="Aneesh" autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </label>
          {register && (
            <label>
              Private invitation code
              <input name="invite" required autoComplete="off" />
              <small>Use the code in your private setup file.</small>
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary wide" disabled={busy}>
            {busy ? 'Please wait…' : register ? 'Create my account' : 'Enter my journal'}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register
            ? 'Already have an account? Sign in'
            : 'First visit? Set up with your invitation'}
        </button>
        <p className="privacy-note">
          <LockKeyhole size={14} /> Your reflections belong to you.
        </p>
      </section>
    </main>
  );
}
