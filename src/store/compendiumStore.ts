import { create } from 'zustand';

/** Bumped whenever compendium data changes (sync, import, clear) so consumers refetch. */
interface CompendiumVersionState {
  version: number;
  bump: () => void;
}

export const useCompendiumVersion = create<CompendiumVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
