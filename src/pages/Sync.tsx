import { useState } from 'react';
import { getStoredSyncCode, setStoredSyncCode, createSyncCode, importSyncCode, type PullResult } from '../lib/sync';

export default function Sync() {
  const [code, setCode] = useState<string | null>(() => getStoredSyncCode());
  const [pasteCode, setPasteCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [lastPull, setLastPull] = useState<PullResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setBusy('create');
    setMessage(null);
    try {
      const newCode = await createSyncCode();
      setCode(newCode);
      setMessage({ kind: 'ok', text: 'Generated a fresh code for everything currently saved on this device.' });
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
      const result = await importSyncCode(codeToUse.trim());
      setLastPull(result);
      setPasteCode('');
      setMessage({
        kind: 'ok',
        text: `Imported ${result.imported} character${result.imported === 1 ? '' : 's'}.${
          result.keptLocal > 0 ? ` Kept ${result.keptLocal} local version${result.keptLocal === 1 ? '' : 's'} that looked newer than the code.` : ''
        }`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function handleForget() {
    if (!confirm('Forget this sync code on this device? This only clears it from this browser — your characters are unaffected.')) return;
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
        Move your characters between browsers and devices with a shareable code — no account, sign-in, or server required.
      </p>

      <div className="card mb-6 p-5">
        <h2 className="section-title">How this works</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm text-stone-500">
          <li>The code <em>is</em> your character data — compressed and encoded as text. Nothing is uploaded anywhere; it never leaves your devices except however you choose to send it (copy/paste, message, etc.).</li>
          <li>Generate a code here, copy it, then paste it into this same page on your other device.</li>
          <li>A code is a snapshot. If you change a character afterward, generate a new code to share the update.</li>
          <li>Importing never deletes local characters, and won't overwrite a local character with an older snapshot.</li>
          <li>Because there's no server, the code can be long — that's expected. Export/Import JSON on the Characters page works too, as a file-based alternative.</li>
        </ul>
      </div>

      <div className="card p-5">
        <h2 className="section-title">Your Sync Code</h2>
        <div className="mb-4">
          <button className="btn-primary" onClick={handleCreate} disabled={busy !== null}>
            {busy === 'create' ? 'Generating…' : code ? 'Generate a New Code' : 'Generate Sync Code'}
          </button>
          {code && (
            <>
              <div className="mt-3">
                <textarea
                  className="input font-mono text-xs"
                  rows={4}
                  readOnly
                  value={code}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={copyCode}>
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
                <button className="btn-ghost" onClick={handleForget}>
                  Forget this code
                </button>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                On your other device, open this same page, paste this code under "Load a Sync Code" below, and import it.
              </p>
            </>
          )}
        </div>

        {message && (
          <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {message.text}
          </p>
        )}

        {lastPull && (
          <p className="mb-4 text-xs text-stone-500">Last imported snapshot was generated {new Date(lastPull.savedAt).toLocaleString()}.</p>
        )}

        <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
          <label className="label">Load a Sync Code</label>
          <textarea
            className="input mb-2 font-mono text-xs"
            rows={4}
            placeholder="Paste a sync code…"
            value={pasteCode}
            onChange={(e) => setPasteCode(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => handlePull(pasteCode)} disabled={busy !== null || !pasteCode.trim()}>
            {busy === 'pull' ? 'Importing…' : 'Import This Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
