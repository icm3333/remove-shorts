export interface Settings{
    enabled: boolean;
    dailyLimitMinutes: number;
    secondsWatchedToday: number;
    lastResetDate: string;
}

export const DEFAULTS: Settings = {
    enabled: true,
    dailyLimitMinutes: 10,
    secondsWatchedToday: 0,
    lastResetDate: '',
};

export const STORAGE_KEY = 'shortsRemover';

function todayISO(): string{
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function isValidDate(v: unknown): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normalize(s: Partial<Settings>): Settings {
    const dailyLimitMinutes =
        typeof s.dailyLimitMinutes === 'number' && Number.isFinite(s.dailyLimitMinutes) && s.dailyLimitMinutes >= 0
            ? s.dailyLimitMinutes : DEFAULTS.dailyLimitMinutes;
    const secondsWatchedToday =
        typeof s.secondsWatchedToday === 'number' && Number.isFinite(s.secondsWatchedToday) && s.secondsWatchedToday >= 0
            ? s.secondsWatchedToday : 0;
    return {
        enabled: !!s.enabled,
        dailyLimitMinutes,
        secondsWatchedToday,
        lastResetDate: isValidDate(s.lastResetDate) ? s.lastResetDate : '',
    };
}

export async function getSettings(): Promise<Settings>{
    const raw = await browser.storage.local.get(STORAGE_KEY);
    const stored = (raw?.[STORAGE_KEY] ?? {}) as Partial<Settings>;
    return normalize({ ...DEFAULTS, ...stored });
}

export async function setSettings(patch: Partial<Settings>): Promise<void>{
    const current = await getSettings();
    const next = normalize({ ...current, ...patch });
    await browser.storage.local.set({ [STORAGE_KEY]: next });
}

export async function getSettingsWithReset(): Promise<Settings>{
    const s = await getSettings();
    const today = todayISO();
    if(s.lastResetDate !== today){
        const reset = { ...s, secondsWatchedToday: 0, lastResetDate: today};
        await browser.storage.local.set({ [STORAGE_KEY]: reset});
        return reset;
    }
    return s;
}

export async function addWatchedSeconds(delta: number): Promise<Settings>{
    const s = await getSettingsWithReset();
    const next = { ...s, secondsWatchedToday: s.secondsWatchedToday + Math.max(0, delta)};
    await browser.storage.local.set({[STORAGE_KEY]: next});
    return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void{
    const handler = (changes: Record<string, browser.storage.StorageChange>, area:string) => {
        if (area !== 'local' || !(STORAGE_KEY in changes)) return;
        const nv = (changes[STORAGE_KEY].newValue ?? {}) as Partial<Settings>;
        cb(normalize({...DEFAULTS, ...nv}));
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
}

