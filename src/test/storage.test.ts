import { beforeEach, afterEach, describe, it, expect, vi} from "vitest";
import{DEFAULTS, STORAGE_KEY, getSettings, setSettings, getSettingsWithReset, addWatchedSeconds, onSettingsChanged, type Settings} from "../storage";

type Listener = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown}>,
    area:string
) => void;

function makeBrowserMock() {
    const store: Record<string, unknown> = {};
    const listeners: Listener[] = [];
    return {
        _store: store,
        _listeners: listeners,
        storage: {
            local: {
                get: async (key: string) => ({ [key]: store[key] }),
                set: async (obj: Record<string, unknown>) => {
                    const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
                    for (const k of Object.keys(obj)) {
                        changes[k] = { oldValue: store[k], newValue: obj[k] };
                        store[k] = obj[k];
                    }
                    listeners.forEach((fn) => fn(changes, 'local'));
                },
            },
            onChanged: {
                addListener: (fn: Listener) => listeners.push(fn),
                removeListener: (fn: Listener) => {
                    const i = listeners.indexOf(fn);
                    if (i >= 0) listeners.splice(i, 1);
                },
            },
        },
    };
}

let mock: ReturnType<typeof makeBrowserMock>;

/** Seed storage directly, bypassing the module (no listeners fired). */
function seed(partial: Partial<Settings>) {
    mock._store[STORAGE_KEY] = partial;
}

beforeEach(() => {
    mock = makeBrowserMock();
    // @ts-expect-error assign the fake onto the global for the module under test
    globalThis.browser = mock;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00'));
});

afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error cleanup
    delete globalThis.browser;
});

// --- 1.6 Test scenarios ---

describe('storage', () => {
    // 1
    it('returns defaults when storage is empty', async () => {
        const s = await getSettings();
        expect(s).toEqual(DEFAULTS);
        s.dailyLimitMinutes = 999;
        expect(DEFAULTS.dailyLimitMinutes).toBe(10); // no shared reference
    });

    // 2
    it('merges partial stored values over defaults', async () => {
        seed({ enabled: false });
        const s = await getSettings();
        expect(s.enabled).toBe(false);
        expect(s.dailyLimitMinutes).toBe(DEFAULTS.dailyLimitMinutes);
        expect(s.secondsWatchedToday).toBe(0);
        expect(s.lastResetDate).toBe('');
    });

    // 3
    it('setSettings updates only the provided key', async () => {
        seed({ enabled: true, dailyLimitMinutes: 10, secondsWatchedToday: 42, lastResetDate: '2026-09-21' });
        await setSettings({ dailyLimitMinutes: 30 });
        const s = await getSettings();
        expect(s.dailyLimitMinutes).toBe(30);
        expect(s.enabled).toBe(true);
        expect(s.secondsWatchedToday).toBe(42);
        expect(s.lastResetDate).toBe('2026-09-21');
    });

    // 4
    it('resets secondsWatchedToday on a new day and persists', async () => {
        seed({ secondsWatchedToday: 500, lastResetDate: '2026-09-20' });
        const s = await getSettingsWithReset();
        expect(s.secondsWatchedToday).toBe(0);
        expect(s.lastResetDate).toBe('2026-09-21');
        const again = await getSettings();
        expect(again.secondsWatchedToday).toBe(0);
        expect(again.lastResetDate).toBe('2026-09-21');
    });

    // 5
    it('does not reset when lastResetDate is today', async () => {
        seed({ secondsWatchedToday: 120, lastResetDate: '2026-09-21' });
        const s = await getSettingsWithReset();
        expect(s.secondsWatchedToday).toBe(120);
        expect(s.lastResetDate).toBe('2026-09-21');
    });

    // 6
    it('addWatchedSeconds accumulates on the same day', async () => {
        seed({ secondsWatchedToday: 0, lastResetDate: '2026-09-21' });
        await addWatchedSeconds(15);
        const s = await addWatchedSeconds(15);
        expect(s.secondsWatchedToday).toBe(30);
    });

    // 7
    it('addWatchedSeconds resets before adding across a rollover', async () => {
        seed({ secondsWatchedToday: 500, lastResetDate: '2026-09-20' });
        const s = await addWatchedSeconds(10);
        expect(s.secondsWatchedToday).toBe(10);
    });

    // 8
    it('addWatchedSeconds clamps negative deltas', async () => {
        seed({ secondsWatchedToday: 5, lastResetDate: '2026-09-21' });
        const s = await addWatchedSeconds(-5);
        expect(s.secondsWatchedToday).toBe(5);
    });

    // 9
    it('normalizes corrupt stored values', async () => {
        seed({
            dailyLimitMinutes: 'abc' as unknown as number,
            secondsWatchedToday: -3,
            lastResetDate: 42 as unknown as string,
        });
        const s = await getSettings();
        expect(s.dailyLimitMinutes).toBe(DEFAULTS.dailyLimitMinutes);
        expect(s.secondsWatchedToday).toBe(0);
        expect(s.lastResetDate).toBe('');
    });

    // 10
    it('onSettingsChanged notifies with merged settings and can unsubscribe', async () => {
        const received: Settings[] = [];
        const unsubscribe = onSettingsChanged((s) => received.push(s));

        await setSettings({ enabled: false });
        expect(received).toHaveLength(1);
        expect(received[0].enabled).toBe(false);
        expect(received[0].dailyLimitMinutes).toBe(DEFAULTS.dailyLimitMinutes);

        unsubscribe();
        await setSettings({ enabled: true });
        expect(received).toHaveLength(1); // no further calls after unsubscribe
    });
});