<svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import {
    Calendar as CalendarBase,
    ICalendarSource,
    configureGlobalMomentLocale,
  } from "obsidian-calendar-ui";
  import { onDestroy, afterUpdate } from "svelte";

  import type { ISettings } from "src/settings";
  import { activeFile, dailyNotes, settings, weeklyNotes } from "./stores";
  import { tryToCreateMonthlyNote } from "src/io/monthlyNotes";
  import { tryToCreateYearlyNote } from "src/io/yearlyNotes";

  let today: Moment;
  let lastUpdatedMonth: string = ""; // Track the last updated month to prevent duplicate updates

  $: today = getToday($settings);

  export let displayedMonth: Moment = today;
  export let sources: ICalendarSource[];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => boolean;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => boolean;
  export let onClickDay: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean;

  // Wrap handlers with logging
  const wrappedOnClickDay = (date: Moment, isMetaPressed: boolean) => {
    console.log("📅 EXTENDED CALENDAR: Clicked day", date.format("YYYY-MM-DD"), { isMetaPressed });
    return onClickDay?.(date, isMetaPressed);
  };

  const wrappedOnClickWeek = (date: Moment, isMetaPressed: boolean) => {
    console.log("📅 EXTENDED CALENDAR: Clicked week", date.format("YYYY-[W]ww"), { isMetaPressed });
    return onClickWeek?.(date, isMetaPressed);
  };

  export function tick() {
    today = window.moment();
  }

  function getToday(settings: ISettings) {
    configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
    dailyNotes.reindex();
    weeklyNotes.reindex();
    return window.moment();
  }

  // 1 minute heartbeat to keep `today` reflecting the current day
  let heartbeat = setInterval(() => {
    tick();

    const isViewingCurrentMonth = displayedMonth.isSame(today, "day");
    if (isViewingCurrentMonth) {
      // if it's midnight on the last day of the month, this will
      // update the display to show the new month.
      displayedMonth = today;
    }
  }, 1000 * 60);

  let container: HTMLElement;

  function handleTitleClick(e: Event) {
    const target = e.target as HTMLElement;
    if (target.classList.contains("calendar-title-month")) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("📅 EXTENDED CALENDAR: Clicked month", displayedMonth.format("MMM YYYY"));
      tryToCreateMonthlyNote(displayedMonth, false, $settings);
    } else if (target.classList.contains("calendar-title-year")) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("📅 EXTENDED CALENDAR: Clicked year", displayedMonth.format("YYYY"));
      tryToCreateYearlyNote(displayedMonth, false, $settings);
    }
  }

  afterUpdate(() => {
    if (!container) return;

    const monthShort = displayedMonth.format("MMM"); // "Dec"
    const year = displayedMonth.format("YYYY"); // "2025"
    const currentMonthKey = `${monthShort}-${year}`;

    // Skip if we've already updated this month
    if (currentMonthKey === lastUpdatedMonth) {
      return;
    }

    lastUpdatedMonth = currentMonthKey;

    console.log("📅 EXTENDED CALENDAR: Looking for header with month:", monthShort, "and year:", year);

    // Find text nodes for month and year
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node;
    let monthNode: Node | null = null;
    let yearNode: Node | null = null;

    while (node = walker.nextNode()) {
      if (node.nodeValue === monthShort && !monthNode) {
        monthNode = node;
        console.log("📅 EXTENDED CALENDAR: Found month node:", monthShort);
      }
      if (node.nodeValue === year && !yearNode) {
        yearNode = node;
        console.log("📅 EXTENDED CALENDAR: Found year node:", year);
      }
      if (monthNode && yearNode) break;
    }

    if (monthNode && monthNode.parentElement) {
      const parent = monthNode.parentElement;
      console.log("📅 EXTENDED CALENDAR: Found parent element:", parent.className, parent.tagName);
      
      // Clear the parent content
      parent.innerHTML = "";
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.justifyContent = "center";
      parent.style.gap = "0.25em";

      const monthSpan = document.createElement("span");
      monthSpan.innerText = monthShort;
      monthSpan.className = "calendar-title-month";
      monthSpan.style.cursor = "pointer";
      monthSpan.style.userSelect = "none";
      monthSpan.style.WebkitUserSelect = "none";
      monthSpan.style.padding = "0 4px";
      monthSpan.style.transition = "opacity 0.2s";
      // Direct onclick handler
      monthSpan.onclick = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("📅 EXTENDED CALENDAR: Clicked month (via onclick)", displayedMonth.format("MMM YYYY"));
        tryToCreateMonthlyNote(displayedMonth, false, $settings);
        return false;
      };
      monthSpan.onmouseenter = () => {
        monthSpan.style.opacity = "0.6";
      };
      monthSpan.onmouseleave = () => {
        monthSpan.style.opacity = "1";
      };

      const yearSpan = document.createElement("span");
      yearSpan.innerText = year;
      yearSpan.className = "calendar-title-year";
      yearSpan.style.cursor = "pointer";
      yearSpan.style.userSelect = "none";
      yearSpan.style.WebkitUserSelect = "none";
      yearSpan.style.padding = "0 4px";
      yearSpan.style.transition = "opacity 0.2s";
      // Direct onclick handler
      yearSpan.onclick = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("📅 EXTENDED CALENDAR: Clicked year (via onclick)", displayedMonth.format("YYYY"));
        tryToCreateYearlyNote(displayedMonth, false, $settings);
        return false;
      };
      yearSpan.onmouseenter = () => {
        yearSpan.style.opacity = "0.6";
      };
      yearSpan.onmouseleave = () => {
        yearSpan.style.opacity = "1";
      };

      parent.appendChild(monthSpan);
      parent.appendChild(yearSpan);

      console.log("📅 EXTENDED CALENDAR: Created and appended month and year spans");

      // Remove old listener if it exists
      parent.removeEventListener("click", handleTitleClick, true);
      // Add new listener with capture phase
      parent.addEventListener("click", handleTitleClick, true);
    } else {
      console.log("📅 EXTENDED CALENDAR: Could not find month node or parent element");
    }
  });

  onDestroy(() => {
    clearInterval(heartbeat);
  });
</script>

<div bind:this={container}>
<CalendarBase
  {sources}
  {today}
  {onHoverDay}
  {onHoverWeek}
  {onContextMenuDay}
  {onContextMenuWeek}
  onClickDay={wrappedOnClickDay}
  onClickWeek={wrappedOnClickWeek}
  bind:displayedMonth
  localeData={today.localeData()}
  selectedId={$activeFile}
  showWeekNums={$settings.showWeeklyNote}
/>
</div>
