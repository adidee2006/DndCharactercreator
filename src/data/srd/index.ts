import type { Compendium } from '../../types/compendium';
import { races } from './races';
import { classes } from './classes';
import { backgrounds } from './backgrounds';
import { feats } from './feats';
import { spells } from './spells';
import { items } from './items';

export const srdCompendium: Compendium = {
  races,
  classes,
  backgrounds,
  feats,
  spells,
  items,
};

export const SRD_VERSION = '5.1-bundled-1';
