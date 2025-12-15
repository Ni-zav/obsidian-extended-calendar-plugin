import type { Moment } from "moment";
import { TFile, normalizePath } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

// Fallback implementations
function getYearlyNoteSettingsFallback() {
  return { format: "YYYY", folder: "", template: "" };
}

async function createYearlyNoteFallback(date: Moment): Promise<TFile> {
  const { vault } = window.app;
  const { format, folder } = getYearlyNoteSettingsFallback();
  const filename = date.format(format);
  const path = normalizePath(`${folder}/${filename}.md`);

  const existingFile = vault.getAbstractFileByPath(path);
  if (existingFile && existingFile instanceof TFile) {
    return existingFile;
  }

  return await vault.create(path, "");
}

export async function openOrCreateYearlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder } = getYearlyNoteSettingsFallback();
  const filename = date.format(format);
  const path = normalizePath(`${folder}/${filename}.md`);

  const existingFile = vault.getAbstractFileByPath(path);
  if (existingFile && existingFile instanceof TFile) {
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile, { active: true });
    cb?.(existingFile);
    return;
  }

  await tryToCreateYearlyNote(date, inNewSplit, settings, cb);
}

/**
 * Create a Yearly Note for a given date.
 */
export async function tryToCreateYearlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace } = window.app;
  const { format } = getYearlyNoteSettingsFallback();
  const filename = date.format(format);

  const createFile = async () => {
    const note = await createYearlyNoteFallback(date);
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
      title: "New Yearly Note",
    });
  } else {
    await createFile();
  }
}
