import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useUiStore } from './store/uiStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { subscribeToAuth, pushNewerCharactersToCloud, pullCharactersFromCloud } from './lib/account';

function App() {
  const { theme, toggleTheme } = useUiStore();
  const location = useLocation();
  const syncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // iOS can leave a Home Screen "standalone" app's WebView in a stale state
  // after it's been backgrounded (screen locked, app-switched away) — touch
  // handlers appear present but the first tap on return doesn't register.
  // Forcing a reflow when the page becomes visible again is the standard
  // mitigation for that class of bug.
  useEffect(() => {
    function nudge() {
      if (document.visibilityState === 'visible') {
        void document.body.offsetHeight;
      }
    }
    document.addEventListener('visibilitychange', nudge);
    window.addEventListener('pageshow', nudge);
    return () => {
      document.removeEventListener('visibilitychange', nudge);
      window.removeEventListener('pageshow', nudge);
    };
  }, []);

  // Whenever an account is (or becomes) signed in — including a session
  // restored on app load — reconcile this device with the cloud once: pull
  // first (so any deletion tombstones remove stale local characters before
  // they'd otherwise get re-uploaded), then push anything local that's new
  // or newer. Runs app-wide, not just while the Account page happens to be
  // open.
  useEffect(() => {
    return subscribeToAuth((user) => {
      if (!user) {
        syncedUidRef.current = null;
        return;
      }
      if (syncedUidRef.current === user.uid) return;
      syncedUidRef.current = user.uid;
      pullCharactersFromCloud()
        .catch(() => {})
        .finally(() => {
          pushNewerCharactersToCloud().catch(() => {});
        });
    });
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-stone-300/60 bg-stone-100/80 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight transition-opacity hover:opacity-80">
            <span
              aria-hidden
              className="text-xl drop-shadow-[0_1px_2px_rgba(153,27,27,0.4)]"
            >
              {'⚔️'}
            </span>
            <span>
              Grimoire{' '}
              <span className="bg-gradient-to-r from-red-700 to-red-500 bg-clip-text text-transparent dark:from-red-400 dark:to-amber-400">
                Sheets
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link to="/" className="btn-ghost">
              Characters
            </Link>
            <Link to="/compendium" className="btn-ghost">
              Compendium
            </Link>
            <Link to="/account" className="btn-ghost">
              Account
            </Link>
            <Link to="/new" className="btn-primary">
              + New Character
            </Link>
            <button className="btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-stone-500">
        Rules content adapted from the D&D 5th Edition SRD. Not affiliated with or endorsed by Wizards of the Coast.
      </footer>
    </div>
  );
}

export default App;
