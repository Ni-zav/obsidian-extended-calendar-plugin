import type { Moment } from "moment";
import type { TFile } from "obsidian";
import {
  createMonthlyNote,
  getMonthlyNoteSettings,
  getAllMonthlyNotes,
  getMonthlyNote,
} from "obsidian-daily-notes-interface";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

export async function openOrCreateMonthlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace } = window.app;
  const allMonthlyNotes = getAllMonthlyNotes();
  const existingFile = getMonthlyNote(date, allMonthlyNotes);

  if (existingFile) {
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile, { active: true });
    cb?.(existingFile);
    return;
  }

  await tryToCreateMonthlyNote(date, inNewSplit, settings, cb);
}

/**
 * Create a Monthly Note for a given date.
 */
export async function tryToCreateMonthlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace } = window.app;
  const { format } = getMonthlyNoteSettings();
  const filename = date.format(format);

  const createFile = async () => {
    const note = await createMonthlyNote(date);
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();

    await leaf.openFile(note, { active : true });
    cb?.(note);
  };

  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${filename} does not exist. Would you like to create it?`,
      title: "New Monthly Note",
    });
  } else {
    await createFile();
  }
}
