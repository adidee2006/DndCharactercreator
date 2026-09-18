import { useEffect, useRef, useState } from 'react';

const SEARCH_RESULT_LIMIT = 200;

/**
 * A type-to-filter dropdown for picking one entry out of a (possibly huge —
 * compendium spell/item lists can run into the thousands) option list. Unlike
 * a plain <select>, it never holds a persistent selection: picking an option
 * calls onSelect and resets to an empty search box, matching how these "add
 * a thing" pickers already behaved as native selects.
 */
export function SearchableSelect({
  options,
  onSelect,
  placeholder,
}: {
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const shown = matches.slice(0, SEARCH_RESULT_LIMIT);

  function pick(value: string) {
    onSelect(value);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-300 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-800">
          {shown.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-500">No matches.</div>
          ) : (
            shown.map((o) => (
              <button
                key={o.value}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700"
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            ))
          )}
          {matches.length > SEARCH_RESULT_LIMIT && (
            <div className="border-t border-stone-200 px-3 py-1 text-xs text-stone-400 dark:border-stone-700">
              {matches.length - SEARCH_RESULT_LIMIT} more match{matches.length - SEARCH_RESULT_LIMIT === 1 ? '' : 'es'} — keep typing to narrow it down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
