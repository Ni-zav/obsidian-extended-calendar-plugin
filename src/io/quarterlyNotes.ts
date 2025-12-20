import type { Moment } from "moment";
import { TFile, normalizePath } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

// Get quarterly note settings from plugin options
function getQuarterlyNoteSettings(settings: ISettings) {
  return {
    format: settings.quarterlyNoteFormat || "[Q]Q-YYYY",
    folder: settings.quarterlyNoteFolder || "",
    template: settings.quarterlyNoteTemplate || "",
  };
}

export async function openOrCreateQuarterlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder } = getQuarterlyNoteSettings(settings);
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

  await tryToCreateQuarterlyNote(date, inNewSplit, settings, cb);
}

/**
 * Create a Quarterly Note for a given date.
 */
export async function tryToCreateQuarterlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder } = getQuarterlyNoteSettings(settings);
  const filename = date.format(format);
  const path = normalizePath(`${folder}/${filename}.md`);

  const createFile = async () => {
    try {
      // Check if file already exists before trying to create
      const existingFile = vault.getAbstractFileByPath(path);
      if (existingFile && existingFile instanceof TFile) {
        const leaf = inNewSplit
          ? workspace.splitActiveLeaf()
          : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true });
        cb?.(existingFile);
        return;
      }

      // Create new file
      const note = await vault.create(path, "# " + filename + "\n");
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();

      await leaf.openFile(note, { active : true });
      cb?.(note);
    } catch (error) {
      // If file already exists, try to open it instead
      if (error instanceof Error && error.message.includes("File already exists")) {
        const existingFile = vault.getAbstractFileByPath(path);
        if (existingFile && existingFile instanceof TFile) {
          const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
          await leaf.openFile(existingFile, { active: true });
          cb?.(existingFile);
          return;
        }
      }
      // Re-throw if it's a different error or file wasn't found
      throw error;
    }
  };

  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${filename} does not exist. Would you like to create it?`,
      title: "New Quarterly Note",
    });
  } else {
    await createFile();
  }
}
