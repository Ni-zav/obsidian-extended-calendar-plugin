<svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import {
    Calendar as CalendarBase,
    ICalendarSource,
    configureGlobalMomentLocale,
  } from "obsidian-calendar-ui";
  import { onDestroy, afterUpdate } from "svelte";
  import { getMonthlyNote } from "obsidian-daily-notes-interface";

  import type { ISettings } from "src/settings";
  import { 
    activeFile, 
    dailyNotes, 
    settings, 
    weeklyNotes, 
    monthlyNotes, 
    quarterlyNotes, 
    yearlyNotes,
    getQuarterlyNote,
    getYearlyNote 
  } from "./stores";
  import { openOrCreateMonthlyNote } from "src/io/monthlyNotes";
  import { openOrCreateQuarterlyNote } from "src/io/quarterlyNotes";
  import { openOrCreateYearlyNote } from "src/io/yearlyNotes";

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
    monthlyNotes.reindex();
    quarterlyNotes.reindex();
    yearlyNotes.reindex();
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
    // Deprecated
  }

  afterUpdate(() => {
    if (!container) return;

    const monthShort = displayedMonth.format("MMM"); // "Dec"
    const quarter = "Q" + displayedMonth.format("Q"); // "Q1", "Q2", etc.
    const year = displayedMonth.format("YYYY"); // "2025"

    // Check if notes exist for the displayed month/quarter/year
    const hasMonthlyNote = getMonthlyNote(displayedMonth, $monthlyNotes) !== null;
    const hasQuarterlyNote = getQuarterlyNote(displayedMonth, $quarterlyNotes) !== null;
    const hasYearlyNote = getYearlyNote(displayedMonth, $yearlyNotes) !== null;

    // Helper to create a dot indicator
    function createDotIndicator(exists: boolean): HTMLElement {
      const dot = document.createElement("span");
      dot.className = "extended-calendar-note-indicator";
      dot.style.display = "inline-block";
      dot.style.width = "6px";
      dot.style.height = "6px";
      dot.style.borderRadius = "50%";
      dot.style.marginLeft = "4px";
      dot.style.verticalAlign = "middle";
      dot.style.backgroundColor = exists ? "var(--text-accent)" : "transparent";
      dot.style.border = exists ? "none" : "1px solid var(--text-muted)";
      dot.title = exists ? "Note exists" : "No note";
      return dot;
    }

    // Find text nodes for month, quarter, and year
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node;

    while (node = walker.nextNode()) {
      if (node.nodeValue === monthShort) {
        const parent = node.parentElement;
        if (parent && parent.classList.contains("extended-calendar-month-wrapper")) {
          // Update handler
          parent.onclick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("📅 EXTENDED CALENDAR: Clicked month (via onclick)", displayedMonth.format("MMM YYYY"));
            openOrCreateMonthlyNote(displayedMonth, false, $settings);
            return false;
          };
          if (!parent.classList.contains("extended-calendar-hover-effect")) {
            parent.classList.add("extended-calendar-hover-effect");
          }
          // Update or add dot indicator
          let existingDot = parent.querySelector(".extended-calendar-note-indicator");
          if (existingDot) {
            existingDot.remove();
          }
          parent.appendChild(createDotIndicator(hasMonthlyNote));
        } else if (node.parentNode) {
          // Wrap it and add quarterly display after it
          const span = document.createElement("span");
          span.className = "extended-calendar-month-wrapper extended-calendar-hover-effect";
          span.style.cursor = "pointer";
          span.style.userSelect = "none";
          span.style.webkitUserSelect = "none";
          span.onclick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("📅 EXTENDED CALENDAR: Clicked month (via onclick)", displayedMonth.format("MMM YYYY"));
            openOrCreateMonthlyNote(displayedMonth, false, $settings);
            return false;
          };
          
          node.parentNode.replaceChild(span, node);
          span.appendChild(node);
          span.appendChild(createDotIndicator(hasMonthlyNote));
          
          // Insert quarterly span after month
          const quarterSpan = document.createElement("span");
          quarterSpan.className = "extended-calendar-quarter-wrapper extended-calendar-hover-effect";
          quarterSpan.style.cursor = "pointer";
          quarterSpan.style.userSelect = "none";
          quarterSpan.style.webkitUserSelect = "none";
          quarterSpan.style.marginLeft = "0.5em";
          quarterSpan.textContent = quarter;
          quarterSpan.onclick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("📅 EXTENDED CALENDAR: Clicked quarter (via onclick)", displayedMonth.format("[Q]Q YYYY"));
            openOrCreateQuarterlyNote(displayedMonth, false, $settings);
            return false;
          };
          quarterSpan.appendChild(createDotIndicator(hasQuarterlyNote));
          
          span.parentNode.insertBefore(quarterSpan, span.nextSibling);
        }
      }
      
      if (node.nodeValue === year) {
        const parent = node.parentElement;
        if (parent && parent.classList.contains("extended-calendar-year-wrapper")) {
          // Update handler
          parent.onclick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("📅 EXTENDED CALENDAR: Clicked year (via onclick)", displayedMonth.format("YYYY"));
            openOrCreateYearlyNote(displayedMonth, false, $settings);
            return false;
          };
          if (!parent.classList.contains("extended-calendar-hover-effect")) {
            parent.classList.add("extended-calendar-hover-effect");
          }
          // Update or add dot indicator
          let existingDot = parent.querySelector(".extended-calendar-note-indicator");
          if (existingDot) {
            existingDot.remove();
          }
          parent.appendChild(createDotIndicator(hasYearlyNote));
        } else if (node.parentNode) {
          // Wrap it
          const span = document.createElement("span");
          span.className = "extended-calendar-year-wrapper extended-calendar-hover-effect";
          span.style.cursor = "pointer";
          span.style.userSelect = "none";
          span.style.webkitUserSelect = "none";
          span.onclick = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log("📅 EXTENDED CALENDAR: Clicked year (via onclick)", displayedMonth.format("YYYY"));
            openOrCreateYearlyNote(displayedMonth, false, $settings);
            return false;
          };
          
          node.parentNode.replaceChild(span, node);
          span.appendChild(node);
          span.appendChild(createDotIndicator(hasYearlyNote));
        }
      }

      // Update quarterly indicator if it already exists
      if (node.nodeValue === quarter) {
        const parent = node.parentElement;
        if (parent && parent.classList.contains("extended-calendar-quarter-wrapper")) {
          // Update or add dot indicator
          let existingDot = parent.querySelector(".extended-calendar-note-indicator");
          if (existingDot) {
            existingDot.remove();
          }
          parent.appendChild(createDotIndicator(hasQuarterlyNote));
        }
      }

      if (node.nodeValue && node.nodeValue.trim() === "Today") {
        const parent = node.parentElement;
        if (parent) {
          parent.classList.add("extended-calendar-hover-effect");
          parent.style.cursor = "pointer";
        }
      }
    }

    const svgs = container.querySelectorAll('svg');
    svgs.forEach(svg => {
      if (svg.parentElement) {
        svg.parentElement.classList.add("extended-calendar-hover-effect");
        svg.parentElement.style.cursor = "pointer";
      }
    });
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
