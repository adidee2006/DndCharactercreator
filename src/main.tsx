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
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
