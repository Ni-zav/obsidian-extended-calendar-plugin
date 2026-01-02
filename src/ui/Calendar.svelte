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

    // Reindex notes stores to get fresh data
    monthlyNotes.reindex();
    quarterlyNotes.reindex();
    yearlyNotes.reindex();

    // Check if notes exist for the displayed month/quarter/year
    const hasMonthlyNote = getMonthlyNote(displayedMonth, $monthlyNotes) !== null;
    const hasQuarterlyNote = getQuarterlyNote(displayedMonth, $quarterlyNotes) !== null;
    const hasYearlyNote = getYearlyNote(displayedMonth, $yearlyNotes) !== null;

    // Helper to create/update a dot indicator
    function updateDotIndicator(parent: HTMLElement, exists: boolean) {
      let dot = parent.querySelector(".extended-calendar-note-indicator") as HTMLElement;
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "extended-calendar-note-indicator";
        dot.style.display = "inline-block";
        dot.style.width = "6px";
        dot.style.height = "6px";
        dot.style.borderRadius = "50%";
        dot.style.marginLeft = "4px";
        dot.style.verticalAlign = "middle";
        parent.appendChild(dot);
      }
      dot.style.backgroundColor = exists ? "var(--text-accent)" : "transparent";
      dot.style.border = exists ? "none" : "1px solid var(--text-muted)";
      dot.title = exists ? "Note exists" : "No note";
    }

    // First, check if wrappers already exist and update them
    const existingMonthWrapper = container.querySelector(".extended-calendar-month-wrapper") as HTMLElement;
    const existingQuarterWrapper = container.querySelector(".extended-calendar-quarter-wrapper") as HTMLElement;
    const existingYearWrapper = container.querySelector(".extended-calendar-year-wrapper") as HTMLElement;

    if (existingMonthWrapper) {
      updateDotIndicator(existingMonthWrapper, hasMonthlyNote);
    }

    if (existingQuarterWrapper) {
      // Update the quarter text (preserve the dot)
      const dot = existingQuarterWrapper.querySelector(".extended-calendar-note-indicator");
      // Get just the text node
      const textNodes = Array.from(existingQuarterWrapper.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
      if (textNodes.length > 0) {
        textNodes[0].textContent = quarter;
      } else if (existingQuarterWrapper.firstChild && existingQuarterWrapper.firstChild.nodeType === Node.TEXT_NODE) {
        existingQuarterWrapper.firstChild.textContent = quarter;
      } else {
        // No text node found, insert one at the beginning
        existingQuarterWrapper.insertBefore(document.createTextNode(quarter), existingQuarterWrapper.firstChild);
      }
      updateDotIndicator(existingQuarterWrapper, hasQuarterlyNote);
      // Update click handler
      existingQuarterWrapper.onclick = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        openOrCreateQuarterlyNote(displayedMonth, false, $settings);
        return false;
      };
    }

    if (existingYearWrapper) {
      updateDotIndicator(existingYearWrapper, hasYearlyNote);
    }

    // If wrappers don't exist yet, create them using tree walker
    if (!existingMonthWrapper || !existingQuarterWrapper || !existingYearWrapper) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node;

      while (node = walker.nextNode()) {
        if (node.nodeValue === monthShort && !existingMonthWrapper) {
          const parent = node.parentElement;
          if (parent && !parent.classList.contains("extended-calendar-month-wrapper")) {
            // Wrap it and add quarterly display after it
            const span = document.createElement("span");
            span.className = "extended-calendar-month-wrapper extended-calendar-hover-effect";
            span.style.cursor = "pointer";
            span.style.userSelect = "none";
            span.style.webkitUserSelect = "none";
            span.onclick = (e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
              openOrCreateMonthlyNote(displayedMonth, false, $settings);
              return false;
            };
            
            node.parentNode.replaceChild(span, node);
            span.appendChild(node);
            updateDotIndicator(span, hasMonthlyNote);
            
            // Insert quarterly span after month
            const quarterSpan = document.createElement("span");
            quarterSpan.className = "extended-calendar-quarter-wrapper extended-calendar-hover-effect";
            quarterSpan.style.cursor = "pointer";
            quarterSpan.style.userSelect = "none";
            quarterSpan.style.webkitUserSelect = "none";
            quarterSpan.style.marginLeft = "0.5em";
            quarterSpan.appendChild(document.createTextNode(quarter));
            quarterSpan.onclick = (e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
              openOrCreateQuarterlyNote(displayedMonth, false, $settings);
              return false;
            };
            updateDotIndicator(quarterSpan, hasQuarterlyNote);
            
            span.parentNode.insertBefore(quarterSpan, span.nextSibling);
          }
        }
        
        if (node.nodeValue === year && !existingYearWrapper) {
          const parent = node.parentElement;
          if (parent && !parent.classList.contains("extended-calendar-year-wrapper")) {
            // Wrap it
            const span = document.createElement("span");
            span.className = "extended-calendar-year-wrapper extended-calendar-hover-effect";
            span.style.cursor = "pointer";
            span.style.userSelect = "none";
            span.style.webkitUserSelect = "none";
            span.onclick = (e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
              openOrCreateYearlyNote(displayedMonth, false, $settings);
              return false;
            };
            
            node.parentNode.replaceChild(span, node);
            span.appendChild(node);
            updateDotIndicator(span, hasYearlyNote);
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
