# Grimoire Sheets — D&D Character Sheet Creator & Manager

A local-first web app for building, playing, and managing D&D 5e-style characters. Runs entirely
in the browser (React + TypeScript + Vite), stores everything in IndexedDB on your device, and
needs no backend or account.

## Features

- **Guided character creation wizard** — race/subrace, class & multiclassing, background,
  ability scores (standard array, point buy, dice roll, or manual), skills, starting equipment,
  and spells, with every derived stat (AC, HP, saves, skill bonuses, spell slots, spell save DC,
  passive perception, carrying capacity, etc.) calculated automatically from the SRD rules engine
  in `src/lib/calc.ts`.
- **Full character manager** — a tabbed sheet (Main / Combat / Spells / Inventory / Features /
  Bio) for playing a character session to session: HP and death-save tracking, spell slot and
  pact-magic usage, hit dice, inspiration, conditions, inventory & currency, and a level-up flow
  that reuses the same wizard.
- **A self-updating compendium**, from the Compendium page:
  - Ships with a bundled SRD-based starter library (races, classes, backgrounds, feats, spells,
    equipment) so it works fully offline out of the box.
  - **Update from the internet** — pulls the full SRD spell and equipment lists from the public
    [dnd5eapi.co](https://www.dnd5eapi.co) API and merges them in, without touching your bundled
    or homebrew data.
  - **Custom/homebrew compendiums** — import your own JSON file of races, classes, backgrounds,
    feats, spells, or items (see the "Expected JSON shape" panel on the Compendium page). Entries
    reuse a key to override existing content, or a new key to add to it.
- **Export** — a standard-layout, multi-page character sheet PDF (generated client-side with
  `pdf-lib`, no server involved) and a portable JSON export/import for backup or sharing between
  browsers/devices.

## Getting started

```bash
npm install
npm run dev      # start the local dev server
npm run build    # type-check and produce a production build in dist/
```

Everything is stored locally in your browser's IndexedDB — there is no server component and no
account system. Exporting a character to JSON is the way to move it between browsers or devices.

## Project layout

- `src/types` — Character and compendium (rules) data models.
- `src/data/srd` — the bundled starter compendium content.
- `src/data/tables.ts` — core 5e numeric tables (proficiency bonus, spell slot progressions, XP).
- `src/lib/calc.ts` — the rules engine: every derived stat is computed here, never stored.
- `src/lib/db.ts` / `src/lib/compendium.ts` — IndexedDB persistence, internet sync, and custom
  compendium import/export.
- `src/lib/characters.ts` — character CRUD.
- `src/lib/pdfExport.ts` / `src/lib/jsonExport.ts` — export.
- `src/pages` — the wizard, character sheet, dashboard, and compendium manager UI.

Rules content is adapted from the D&D 5th Edition SRD. This project is not affiliated with or
endorsed by Wizards of the Coast.
