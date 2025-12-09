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

  $: today = getToday($settings);

  export let displayedMonth: Moment = today;
  export let sources: ICalendarSource[];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => boolean;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => boolean;
  export let onClickDay: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean;

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

  afterUpdate(() => {
    if (!container) return;

    // Find the header title. It usually contains the month and year.
    // We look for an element that contains the formatted month and year.
    const titleText = displayedMonth.format("MMMM YYYY");
    const titleTextShort = displayedMonth.format("MMM YYYY");

    // Helper to find text node
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node;
    let targetNode: Node | null = null;
    while (node = walker.nextNode()) {
      if (node.nodeValue === titleText || node.nodeValue === titleTextShort) {
        targetNode = node;
        break;
      }
    }

    if (targetNode && targetNode.parentElement) {
      const parent = targetNode.parentElement;
      // Check if we already processed this element for the current month
      // We can check if the text content matches what we expect for the split version
      // But since we clear innerHTML, the text node won't be found next time unless we are careful.
      // Actually, if we replace the text node with spans, the walker won't find the original text node anymore.
      // So we don't need data-processed check if the text changes.
      // However, svelte might re-render and put the text back.
      
      // If we found the text node, it means it's the original text.
      
      parent.innerHTML = "";
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.justifyContent = "center";
      parent.style.gap = "0.25em";

      const monthSpan = document.createElement("span");
      monthSpan.innerText = displayedMonth.format("MMM");
      monthSpan.className = "calendar-title-month";
      monthSpan.style.cursor = "pointer";
      monthSpan.onclick = (e) => {
        e.stopPropagation();
        tryToCreateMonthlyNote(displayedMonth, false, $settings);
      };

      const yearSpan = document.createElement("span");
      yearSpan.innerText = displayedMonth.format("YYYY");
      yearSpan.className = "calendar-title-year";
      yearSpan.style.cursor = "pointer";
      yearSpan.onclick = (e) => {
        e.stopPropagation();
        tryToCreateYearlyNote(displayedMonth, false, $settings);
      };

      parent.appendChild(monthSpan);
      parent.appendChild(yearSpan);
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
  {onClickDay}
  {onClickWeek}
  bind:displayedMonth
  localeData={today.localeData()}
  selectedId={$activeFile}
  showWeekNums={$settings.showWeeklyNote}
/>
</div>
