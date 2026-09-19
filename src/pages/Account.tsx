import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeToAuth,
  signUp,
  logIn,
  logOut,
  resetPassword,
  pushCharactersToCloud,
  pullCharactersFromCloud,
} from '../lib/account';
import {
  getStoredSyncCode,
  setStoredSyncCode,
  createSyncCode,
  pushToSyncCode,
  pullFromSyncCode,
  type PullResult,
} from '../lib/sync';

function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResetSent(false);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await logIn(email, password);
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email above first, then click "Forgot password?".');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 flex gap-1 rounded-lg bg-stone-200/60 p-1 dark:bg-stone-800/60">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === 'login' ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'}`}
          onClick={() => { setMode('login'); setError(null); setResetSent(false); }}
        >
          Log In
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === 'signup' ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'}`}
          onClick={() => { setMode('signup'); setError(null); setResetSent(false); }}
        >
          Sign Up
        </button>
      </div>

      <div className="mb-3">
        <label className="label">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          className="input w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label className="label">Password</label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="input w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {resetSent && (
        <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-400">
          Password reset email sent — check your inbox.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn-ghost text-xs" onClick={handleForgotPassword} disabled={busy}>
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
}

function CloudPanel({ user }: { user: User }) {
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function handlePush() {
    setBusy('push');
    setMessage(null);
    try {
      const count = await pushCharactersToCloud();
      setMessage({ kind: 'ok', text: `Uploaded ${count} character${count === 1 ? '' : 's'} to your account.` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handlePull() {
    setBusy('pull');
    setMessage(null);
    try {
      const result = await pullCharactersFromCloud();
      setMessage({
        kind: 'ok',
        text: `Downloaded ${result.imported} character${result.imported === 1 ? '' : 's'}.${
          result.keptLocal > 0 ? ` Kept ${result.keptLocal} local version${result.keptLocal === 1 ? '' : 's'} that looked newer than the cloud copy.` : ''
        }`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">
        Signed in as <span className="font-medium text-stone-700 dark:text-stone-300">{user.email}</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={handlePush} disabled={busy !== null}>
          {busy === 'push' ? 'Uploading…' : 'Upload My Characters'}
        </button>
        <button className="btn-secondary" onClick={handlePull} disabled={busy !== null}>
          {busy === 'pull' ? 'Downloading…' : 'Download My Characters'}
        </button>
        <button className="btn-ghost" onClick={() => logOut()} disabled={busy !== null}>
          Sign Out
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Upload sends everything currently saved on this device to your account. Download pulls everything from your
        account into this device — a local character is only overwritten if the cloud copy is newer.
      </p>
      {message && (
        <p className={`mt-3 text-sm ${message.kind === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function OfflineCodePanel() {
  const [code, setCode] = useState<string | null>(() => getStoredSyncCode());
  const [pasteCode, setPasteCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [lastPull, setLastPull] = useState<PullResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setBusy('create');
    setMessage(null);
    try {
      const newCode = await createSyncCode();
      setCode(newCode);
      setMessage({ kind: 'ok', text: 'Generated a code for everything currently saved on this device.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handlePush() {
    setBusy('push');
    setMessage(null);
    try {
      const newCode = await pushToSyncCode();
      setCode(newCode);
      setMessage({ kind: 'ok', text: 'Generated a fresh code — share this new one, the old one won’t reflect these changes.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handlePull(codeToUse: string) {
    if (!codeToUse.trim()) return;
    setBusy('pull');
    setMessage(null);
    try {
      const result = await pullFromSyncCode(codeToUse.trim());
      setCode(codeToUse.trim());
      setLastPull(result);
      setPasteCode('');
      setMessage({
        kind: 'ok',
        text: `Pulled in ${result.imported} character${result.imported === 1 ? '' : 's'}.${
          result.keptLocal > 0 ? ` Kept ${result.keptLocal} local version${result.keptLocal === 1 ? '' : 's'} that looked newer than the synced copy.` : ''
        }`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function handleForget() {
    if (!confirm('Forget this sync code on this device? The data itself isn’t deleted — you can still pull it again later if you have the code.')) return;
    setStoredSyncCode(null);
    setCode(null);
    setMessage(null);
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still shown as selectable text.
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">
        No account, no internet, nothing uploaded anywhere — the code below <em>is</em> your character data,
        compressed into text. Anyone with it can read the data, so treat it like an unlisted link, not a password.
      </p>
      {code ? (
        <div className="mb-4">
          <textarea
            readOnly
            value={code}
            onFocus={(e) => e.target.select()}
            rows={4}
            className="input w-full font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={copyCode}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn-primary" onClick={handlePush} disabled={busy !== null}>
              {busy === 'push' ? 'Regenerating…' : 'Regenerate (latest changes)'}
            </button>
            <button className="btn-ghost" onClick={handleForget}>
              Forget this code
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <button className="btn-primary" onClick={handleCreate} disabled={busy !== null}>
            {busy === 'create' ? 'Generating…' : 'Generate Sync Code'}
          </button>
        </div>
      )}

      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {message.text}
        </p>
      )}
      {lastPull && (
        <p className="mb-4 text-xs text-stone-500">Last synced snapshot was saved {new Date(lastPull.savedAt).toLocaleString()}.</p>
      )}

      <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
        <label className="label">Load a Different Code</label>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-xs"
            placeholder="Paste a sync code…"
            value={pasteCode}
            onChange={(e) => setPasteCode(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => handlePull(pasteCode)} disabled={busy !== null || !pasteCode.trim()}>
            {busy === 'pull' ? 'Pulling…' : 'Pull From This Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => subscribeToAuth(setUser), []);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Account</h1>
      <p className="mb-6 max-w-3xl text-sm text-stone-500">
        Log in to save your characters to your own private account and pick them up on any device.
      </p>

      <div className="card mb-6 p-5">
        <h2 className="section-title">Your Account</h2>
        {user === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : user ? (
          <CloudPanel user={user} />
        ) : (
          <AuthForm onDone={() => {}} />
        )}
      </div>

      <div className="card p-5">
        <button
          type="button"
          className="section-title flex w-full items-center justify-between text-left"
          onClick={() => setShowOffline((v) => !v)}
        >
          <span>Or: Transfer By Code (No Account Needed)</span>
          <span className="text-xs font-normal text-stone-500">{showOffline ? 'Hide' : 'Show'}</span>
        </button>
        {showOffline && (
          <div className="mt-3">
            <OfflineCodePanel />
          </div>
        )}
      </div>
    </div>
  );
}
