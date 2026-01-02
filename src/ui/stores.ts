import type { TFile } from "obsidian";
import { normalizePath, Vault, TFile as ObsidianTFile } from "obsidian";
import {
  getAllDailyNotes,
  getAllWeeklyNotes,
  getAllMonthlyNotes,
} from "obsidian-daily-notes-interface";
import { writable } from "svelte/store";

import { defaultSettings, ISettings } from "src/settings";

import { getDateUIDFromFile } from "./utils";

const DEFAULT_QUARTERLY_NOTE_FORMAT = "YYYY-[Q]Q";
const DEFAULT_YEARLY_NOTE_FORMAT = "YYYY";

/**
 * Get quarterly note settings from periodic-notes plugin
 */
function getQuarterlyNoteSettings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginManager = (window.app as any).plugins;
  try {
    const periodicNotes = pluginManager.getPlugin("periodic-notes");
    const settings = periodicNotes?.settings?.quarterly || {};
    return {
      format: settings.format || DEFAULT_QUARTERLY_NOTE_FORMAT,
      folder: settings.folder?.trim() || "",
    };
  } catch (err) {
    return { format: DEFAULT_QUARTERLY_NOTE_FORMAT, folder: "" };
  }
}

/**
 * Get yearly note settings from periodic-notes plugin
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
    };
  } catch (err) {
    return { format: DEFAULT_YEARLY_NOTE_FORMAT, folder: "" };
  }
}

/**
 * Get date UID for quarterly notes
 * Format: quarter-YYYY-Q (e.g., "quarter-2026-1")
 */
function getQuarterlyDateUID(date: moment.Moment): string {
  const year = date.year();
  const quarter = date.quarter();
  return `quarter-${year}-${quarter}`;
}

/**
 * Get date UID for yearly notes
 * Format: year-YYYY (e.g., "year-2026")
 */
function getYearlyDateUID(date: moment.Moment): string {
  const year = date.year();
  return `year-${year}`;
}

/**
 * Get date from file for quarterly notes
 */
function getDateFromQuarterlyFile(file: TFile): moment.Moment | null {
  const { format } = getQuarterlyNoteSettings();
  // Get just the filename format (in case folder structure is part of format)
  const filenameFormat = format.split("/").pop() || format;
  const noteDate = window.moment(file.basename, filenameFormat, true);
  if (!noteDate.isValid()) {
    return null;
  }
  return noteDate;
}

/**
 * Get date from file for yearly notes
 */
function getDateFromYearlyFile(file: TFile): moment.Moment | null {
  const { format } = getYearlyNoteSettings();
  // Get just the filename format (in case folder structure is part of format)
  const filenameFormat = format.split("/").pop() || format;
  const noteDate = window.moment(file.basename, filenameFormat, true);
  if (!noteDate.isValid()) {
    return null;
  }
  return noteDate;
}

/**
 * Get all quarterly notes from vault
 */
export function getAllQuarterlyNotes(): Record<string, TFile> {
  const { vault } = window.app;
  const { folder } = getQuarterlyNoteSettings();
  
  // If no folder specified, return empty (don't scan entire vault)
  if (!folder) {
    return {};
  }
  
  const folderPath = normalizePath(folder);
  const quarterlyNotesFolder = vault.getAbstractFileByPath(folderPath);
  
  if (!quarterlyNotesFolder) {
    return {};
  }
  
  const quarterlyNotes: Record<string, TFile> = {};
  Vault.recurseChildren(quarterlyNotesFolder, (note) => {
    if (note instanceof ObsidianTFile) {
      const date = getDateFromQuarterlyFile(note);
      if (date) {
        const dateString = getQuarterlyDateUID(date);
        quarterlyNotes[dateString] = note;
      }
    }
  });
  return quarterlyNotes;
}

/**
 * Get quarterly note for a specific date
 */
export function getQuarterlyNote(date: moment.Moment, quarterlyNotes: Record<string, TFile>): TFile | null {
  return quarterlyNotes[getQuarterlyDateUID(date)] ?? null;
}

/**
 * Get all yearly notes from vault
 */
export function getAllYearlyNotes(): Record<string, TFile> {
  const { vault } = window.app;
  const { folder } = getYearlyNoteSettings();
  
  // If no folder specified, return empty (don't scan entire vault)
  if (!folder) {
    return {};
  }
  
  const folderPath = normalizePath(folder);
  const yearlyNotesFolder = vault.getAbstractFileByPath(folderPath);
  
  if (!yearlyNotesFolder) {
    return {};
  }
  
  const yearlyNotes: Record<string, TFile> = {};
  Vault.recurseChildren(yearlyNotesFolder, (note) => {
    if (note instanceof ObsidianTFile) {
      const date = getDateFromYearlyFile(note);
      if (date) {
        const dateString = getYearlyDateUID(date);
        yearlyNotes[dateString] = note;
      }
    }
  });
  return yearlyNotes;
}

/**
 * Get yearly note for a specific date
 */
export function getYearlyNote(date: moment.Moment, yearlyNotes: Record<string, TFile>): TFile | null {
  return yearlyNotes[getYearlyDateUID(date)] ?? null;
}

function createDailyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const dailyNotes = getAllDailyNotes();
        store.set(dailyNotes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          // Avoid error being shown multiple times
          console.log("[Calendar] Failed to find daily notes folder", err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

function createWeeklyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const weeklyNotes = getAllWeeklyNotes();
        store.set(weeklyNotes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          // Avoid error being shown multiple times
          console.log("[Calendar] Failed to find weekly notes folder", err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

function createMonthlyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const monthlyNotes = getAllMonthlyNotes();
        store.set(monthlyNotes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          // Avoid error being shown multiple times
          console.log("[Calendar] Failed to find monthly notes folder", err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

function createQuarterlyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const notes = getAllQuarterlyNotes();
        store.set(notes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          console.log("[Calendar] Failed to find quarterly notes folder", err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

function createYearlyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const notes = getAllYearlyNotes();
        store.set(notes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          console.log("[Calendar] Failed to find yearly notes folder", err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

export const settings = writable<ISettings>(defaultSettings);
export const dailyNotes = createDailyNotesStore();
export const weeklyNotes = createWeeklyNotesStore();
export const monthlyNotes = createMonthlyNotesStore();
export const quarterlyNotes = createQuarterlyNotesStore();
export const yearlyNotes = createYearlyNotesStore();

function createSelectedFileStore() {
  const store = writable<string>(null);

  return {
    setFile: (file: TFile) => {
      const id = getDateUIDFromFile(file);
      store.set(id);
    },
    ...store,
  };
}

export const activeFile = createSelectedFileStore();

