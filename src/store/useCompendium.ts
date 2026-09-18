import { useEffect, useState } from 'react';
import { loadMergedCompendium } from '../lib/compendium';
import type { Compendium } from '../types/compendium';
import { emptyCompendium } from '../types/compendium';
import { useCompendiumVersion } from './compendiumStore';

export function useCompendium(): { compendium: Compendium; loading: boolean } {
  const version = useCompendiumVersion((s) => s.version);
  const [compendium, setCompendium] = useState<Compendium>(emptyCompendium());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadMergedCompendium().then((c) => {
      if (!cancelled) {
        setCompendium(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { compendium, loading };
}
