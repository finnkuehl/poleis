// Texts for save slots (pure, no DOM).
import type { SaveListEntry, SaveSlot, SaveSummary } from '../save';
import { en } from '../i18n/en';
import { fill } from '../i18n/format';

/** "Turn 12, Athens" (name = typed civilization name or the default name). */
export function saveSummaryText(summary: SaveSummary): string {
  return fill(en.gameMenu.summary, {
    turn: summary.turn,
    name: summary.playerName.trim() || en.defaultPlayerName,
  });
}

/** "Saved Nov 21, 2026, 2:05 PM"; empty text if the date is invalid. */
export function savedAtText(iso: string, locale = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return fill(en.gameMenu.savedAt, {
    date: d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
  });
}

/** Name of a slot: "Autosave" or "Slot 2". */
export function slotName(slot: SaveSlot): string {
  return slot === 'auto' ? en.gameMenu.autosave : fill(en.gameMenu.slot, { n: slot });
}

/** The save in `slot`, if there is one. */
export function findSave(
  saves: readonly SaveListEntry[],
  slot: SaveSlot,
): SaveListEntry | undefined {
  return saves.find((s) => s.slot === slot);
}

/** Message for a failed save or load (`error` is the code from src/save). */
export function formatSaveError(error: keyof typeof en.saveErrors): string {
  return en.saveErrors[error];
}
