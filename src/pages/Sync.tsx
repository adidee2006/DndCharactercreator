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
      setMessage({ kind: 'ok', text: 'Set up your sync code and pushed everything currently saved on this device. Reuse this same code from now on — no need to make a new one.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handlePush() {
    if (!code) return;
    setBusy('push');
    setMessage(null);
    try {
      await pushToSyncCode(code);
      setMessage({ kind: 'ok', text: 'Pushed everything currently saved on this device to your sync code.' });
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
        Move your characters between browsers and devices with one reusable code — no account or sign-in required.
      </p>

      <div className="card mb-6 p-5">
        <h2 className="section-title">How this works</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm text-stone-500">
          <li>This uses a free, anonymous JSON storage service as your own private save slot. Setting up sync creates that slot and gives you its code.</li>
          <li>It's one code per device setup, reused every time — push to save your latest changes, pull on another device to fetch them. You don't need to make a new code after every edit.</li>
          <li>Anyone with your code can read or overwrite that data — treat it like an unlisted link, not a password. There's no encryption and no account behind it.</li>
          <li>If this service is ever unreachable or discontinued, Export/Import JSON on the Characters page always works as a reliable manual alternative that doesn't depend on any third party.</li>
          <li>Pulling never deletes local characters, and won't overwrite a local character with an older synced copy.</li>
        </ul>
      </div>

      <div className="card p-5">
        <h2 className="section-title">Your Sync Code</h2>
        {code ? (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="select-all rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-800">
                {code}
              </code>
              <button className="btn-secondary" onClick={copyCode}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn-ghost" onClick={handleForget}>
                Forget this code
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={handlePush} disabled={busy !== null}>
                {busy === 'push' ? 'Pushing…' : 'Push My Characters'}
              </button>
              <button className="btn-secondary" onClick={() => handlePull(code)} disabled={busy !== null}>
                {busy === 'pull' ? 'Pulling…' : 'Pull Latest'}
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              On your other device, open this same page and enter this code under "Load a Different Code" below, then
              Pull Latest. Reuse this code every time — pushing again just updates the same slot.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="mb-2 text-sm text-stone-500">You don't have a sync code on this device yet.</p>
            <button className="btn-primary" onClick={handleCreate} disabled={busy !== null}>
              {busy === 'create' ? 'Setting up…' : 'Set Up Sync'}
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
