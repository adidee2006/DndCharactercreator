import { useState } from 'react';
import {
  getStoredSyncCode,
  setStoredSyncCode,
  createSyncCode,
  pushToSyncCode,
  pullFromSyncCode,
  type PullResult,
} from '../lib/sync';

export default function Sync() {
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
      setMessage({ kind: 'ok', text: 'Generated a code for everything currently saved on this device. Copy it and paste it into this same page on your other device.' });
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
      setMessage({ kind: 'ok', text: 'Generated a fresh code with everything currently saved on this device — share this new code, the old one won’t reflect these changes.' });
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
      <h1 className="mb-1 text-2xl font-bold">Sync Across Devices</h1>
      <p className="mb-6 max-w-3xl text-sm text-stone-500">
        Move your characters between browsers and devices with a code — no account, sign-in, or internet connection
        required.
      </p>

      <div className="card mb-6 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <strong>Work in progress:</strong> a short, reusable account-style code (instead of the long one below) is
        on hold until there's a properly secure backend for it. The code-based sync below is unaffected and works
        today.
      </div>

      <div className="card mb-6 p-5">
        <h2 className="section-title">How this works</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm text-stone-500">
          <li>
            The code <em>is</em> your character data, compressed directly into text — nothing is ever uploaded
            anywhere, so there's no third-party service that can go down, rate-limit, or require an account.
          </li>
          <li>
            Because of that, the code changes (and gets longer) every time you push — copy the fresh one and share
            it again rather than expecting the old one to update itself.
          </li>
          <li>Anyone with your code can read the data it contains — treat it like an unlisted link, not a password. There's no encryption.</li>
          <li>
            For a large roster the code can get long; Export/Import JSON on the Characters page is the better option
            at that point, or if you'd rather send a file than paste a block of text.
          </li>
          <li>Pulling never deletes local characters, and won't overwrite a local character with an older synced copy.</li>
        </ul>
      </div>

      <div className="card p-5">
        <h2 className="section-title">Your Sync Code</h2>
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
            <p className="mt-2 text-xs text-stone-500">
              Copy this code and paste it into this same page on your other device, under "Load a Different Code"
              below. Made a change since? Click Regenerate first — the code above won't update on its own.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="mb-2 text-sm text-stone-500">You don't have a sync code on this device yet.</p>
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
          <p className="mt-1 text-xs text-stone-400">This replaces the sync code remembered on this device with the one you enter.</p>
        </div>
      </div>
    </div>
  );
}
