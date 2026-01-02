import type { Moment } from "moment";
import { Notice, TFile, normalizePath } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

const DEFAULT_YEARLY_NOTE_FORMAT = "YYYY";

/**
 * Read the user settings for the `periodic-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getYearlyNoteSettings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginManager = (window.app as any).plugins;
  try {
    const periodicNotes = pluginManager.getPlugin("periodic-notes");
    const settings = periodicNotes?.settings?.yearly || {};
    
    return {
      format: settings.format || DEFAULT_YEARLY_NOTE_FORMAT,
      folder: settings.folder?.trim() || "",
      template: settings.template?.trim() || "",
    };
  } catch (err) {
    console.info("No custom yearly note settings found!", err);
    return {
      format: DEFAULT_YEARLY_NOTE_FORMAT,
      folder: "",
      template: "",
    };
  }
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
  const { format, folder } = getYearlyNoteSettings();
  const filename = date.format(format);
  const normalizedPath = normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);

  const existingFile = vault.getAbstractFileByPath(normalizedPath);
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
  const { format, folder, template } = getYearlyNoteSettings();
  const filename = date.format(format);
  const normalizedPath = normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);

  const createFile = async () => {
    try {
      // Check if file already exists before trying to create
      const existingFile = vault.getAbstractFileByPath(normalizedPath);
      if (existingFile && existingFile instanceof TFile) {
        const leaf = inNewSplit
          ? workspace.splitActiveLeaf()
          : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true });
        cb?.(existingFile);
        return;
      }

      // Ensure folder exists
      if (folder) {
        const folderPath = normalizePath(folder);
        if (!vault.getAbstractFileByPath(folderPath)) {
          await vault.createFolder(folderPath);
        }
      }

      // Get template contents
      const [templateContents, IFoldInfo] = await getTemplateInfo(template);
      
      // Process template variables (same as obsidian-daily-notes-interface)
      const moment = window.moment;
      const fileContent = templateContents
        .replace(/{{\s*date\s*}}/gi, filename)
        .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
        .replace(/{{\s*title\s*}}/gi, filename)
        .replace(
          /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
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
        )
        .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
        .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format));

      // Create new file with processed template
      const note = await vault.create(normalizedPath, fileContent || "");
      
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
        const existingFile = vault.getAbstractFileByPath(normalizedPath);
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
