import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Dashboard from './pages/Dashboard.tsx';
import CharacterWizard from './pages/CharacterWizard.tsx';
import CharacterSheet from './pages/CharacterSheet.tsx';
import CompendiumManager from './pages/CompendiumManager.tsx';
import LevelUp from './pages/LevelUp.tsx';
import Account from './pages/Account.tsx';

// iOS standalone/"Add to Home Screen" mode has a longstanding WebKit quirk:
// without any touch listener registered on the document, taps aren't
// treated as real user input until a second tap — there's no actual
// interaction needed here, registering the listener at all is what changes
// iOS's behavior for every element on the page.
document.addEventListener('touchstart', () => {}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<CharacterWizard />} />
          <Route path="character/:id" element={<CharacterSheet />} />
          <Route path="character/:id/edit" element={<CharacterWizard />} />
          <Route path="character/:id/level-up" element={<LevelUp />} />
          <Route path="compendium" element={<CompendiumManager />} />
          <Route path="account" element={<Account />} />
          <Route path="sync" element={<Account />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
