import { useEffect, useRef, useState } from 'react';

/**
 * A checklist dropdown for picking any number of values from a known list,
 * shown as removable chips, with a small "Other…" field for anything not on
 * the list (homebrew conditions, unusual languages, etc.) so this doesn't
 * regress the flexibility a free-text field had.
 */
export function MultiSelectChips({
  options,
  values,
  onChange,
  placeholder,
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }
  function remove(opt: string) {
    onChange(values.filter((v) => v !== opt));
  }
  function addCustom() {
    const v = customText.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setCustomText('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" className="input text-left" onClick={() => setOpen((o) => !o)}>
        {values.length ? `${values.length} selected` : placeholder}
      </button>
      {values.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-stone-700"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-800">
          <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} />
                {opt}
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-1 border-t border-stone-200 pt-2 dark:border-stone-700">
            <input
              className="input flex-1 text-sm"
              placeholder="Other…"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn-secondary text-sm" onClick={addCustom}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
