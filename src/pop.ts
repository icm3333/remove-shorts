import { getSettingsWithReset, setSettings, onSettingsChanged, Settings } from './storage';

const DEBOUNCE_MS = 300;

/** Format a duration in seconds as "Xm Ys". */
function fmt(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Null-safe DOM lookups.
const enabledEl = document.getElementById('enabled') as HTMLInputElement | null;
const limitEl = document.getElementById('limit') as HTMLInputElement | null;
const watchedEl = document.getElementById('watched');
const remainingEl = document.getElementById('remaining');

// Track the last valid limit so we can revert on invalid input.
let lastValidLimit = 0;

function render(s: Settings): void {
  if (enabledEl) enabledEl.checked = s.enabled;
  if (limitEl) limitEl.value = String(s.dailyLimitMinutes);
  lastValidLimit = s.dailyLimitMinutes;
  if (watchedEl) watchedEl.textContent = fmt(s.secondsWatchedToday);
  if (remainingEl) {
    const rem = s.dailyLimitMinutes * 60 - s.secondsWatchedToday;
    remainingEl.textContent = rem <= 0 ? 'Limit reached' : fmt(rem);
  }
}

/**
 * Parse and clamp the limit input. Returns null when the value is
 * blank or non-numeric so callers can revert to the last valid value.
 */
function parseLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, n);
}

function commitLimit(raw: string): void {
  const value = parseLimit(raw);
  if (value === null) {
    // Revert to last valid value; never persist NaN.
    if (limitEl) limitEl.value = String(lastValidLimit);
    return;
  }
  lastValidLimit = value;
  if (limitEl) limitEl.value = String(value);
  void setSettings({ dailyLimitMinutes: value });
}

// Wire the enabled checkbox.
if (enabledEl) {
  enabledEl.addEventListener('change', () => {
    void setSettings({ enabled: enabledEl.checked });
  });
}

// Wire the limit input: debounced writes on 'input', authoritative on 'change'.
if (limitEl) {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  limitEl.addEventListener('input', () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const value = parseLimit(limitEl.value);
      if (value !== null) {
        lastValidLimit = value;
        void setSettings({ dailyLimitMinutes: value });
      }
    }, DEBOUNCE_MS);
  });

  limitEl.addEventListener('change', () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    commitLimit(limitEl.value);
  });
}

// Re-render live as settings change (e.g. watch-time ticking in another tab).
onSettingsChanged((s) => render(s));

// Initial load.
void getSettingsWithReset().then(render);
