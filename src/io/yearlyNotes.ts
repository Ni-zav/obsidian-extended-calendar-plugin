import type { Moment } from "moment";
import { Notice, TFile, normalizePath } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

// Get yearly note settings from plugin options
function getYearlyNoteSettings(settings: ISettings) {
  return {
    format: settings.yearlyNoteFormat || "YYYY",
    folder: settings.yearlyNoteFolder || "",
    template: settings.yearlyNoteTemplate || "",
  };
}

/**
 * Read template file contents and fold info
 */
async function getTemplateInfo(template: string): Promise<[string, any]> {
  const { metadataCache, vault } = window.app;
  const templatePath = normalizePath(template);
  
  if (templatePath === "/" || templatePath === "") {
    return Promise.resolve(["", null]);
  }

  try {
    const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
    if (!templateFile) {
      return ["", null];
    }
    const contents = await vault.cachedRead(templateFile);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IFoldInfo = (window.app as any).foldManager.load(templateFile);
    return [contents, IFoldInfo];
  } catch (err) {
    console.error(`Failed to read the yearly note template '${templatePath}'`, err);
    new Notice("Failed to read the yearly note template");
    return ["", null];
  }
}

export async function openOrCreateYearlyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder } = getYearlyNoteSettings(settings);
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
  const { workspace, vault } = window.app;
  const { format, folder, template } = getYearlyNoteSettings(settings);
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

      // Get template contents
      const [templateContents, IFoldInfo] = await getTemplateInfo(template);
      
      // Process template variables
      const moment = window.moment;
      const fileContent = templateContents
        .replace(/{{\\s*date\\s*}}/gi, filename)
        .replace(/{{\\s*time\\s*}}/gi, moment().format("HH:mm"))
        .replace(/{{\\s*title\\s*}}/gi, filename)
        .replace(
          /{{\\s*(date|time)\\s*(([+-]\\d+)([yqmwdhs]))?\\s*(:.+?)?}}/gi,
          (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
            const now = moment();
            const currentDate = date.clone().set({
              hour: now.get("hour"),
              minute: now.get("minute"),
              second: now.get("second"),
            });
            if (calc) {
              currentDate.add(parseInt(timeDelta, 10), unit);
            }
            if (momentFormat) {
              return currentDate.format(momentFormat.substring(1).trim());
            }
            return currentDate.format(format);
          }
        );

      // Create new file with processed template
      const note = await vault.create(path, fileContent || "# " + filename + "\n");
      
      // Save fold info if available
      if (IFoldInfo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.app as any).foldManager.save(note, IFoldInfo);
      }
      
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
      title: "New Yearly Note",
    });
  } else {
    await createFile();
  }
}
