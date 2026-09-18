import { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useUiStore } from './store/uiStore';

function App() {
  const { theme, toggleTheme } = useUiStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-stone-300/60 bg-stone-100/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span aria-hidden className="text-xl">{'⚔️'}</span>
            <span>
              Grimoire <span className="text-red-800 dark:text-red-400">Sheets</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/" className="btn-ghost">
              Characters
            </Link>
            <Link to="/compendium" className="btn-ghost">
              Compendium
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
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-stone-500">
        Rules content adapted from the D&D 5th Edition SRD. Not affiliated with or endorsed by Wizards of the Coast.
      </footer>
    </div>
  );
}

export default App;
