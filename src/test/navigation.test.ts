import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Reset the module between tests so its top-level state (lastHandledUrl,
// lastNonShortsUrl, listeners, started) starts fresh each time.
async function freshModule() {
    vi.resetModules();
    return import('../navigation');
}

beforeEach(() => {
    // Start each test on a known non-shorts URL.
    history.replaceState({}, '', 'https://www.youtube.com/');
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('isShortsPage', () => {
    it('classifies shorts and non-shorts URLs', async () => {
        const { isShortsPage } = await freshModule();
        expect(isShortsPage('https://www.youtube.com/shorts/abc123')).toBe(true);
        expect(isShortsPage('https://www.youtube.com/watch?v=abc')).toBe(false);
        expect(isShortsPage('https://www.youtube.com/')).toBe(false);
        expect(isShortsPage('not a url')).toBe(false); // guarded, no throw
    });
});

describe('onNavigate', () => {
    it('fires synchronously once for the current page', async () => {
        const { onNavigate } = await freshModule();
        const calls: unknown[] = [];
        const unsub = onNavigate(info => calls.push(info));
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({ isShorts: false });
        unsub();
    });

    it('fires on navigation to a Short with correct isShorts', async () => {
        const { onNavigate } = await freshModule();
        const infos: any[] = [];
        onNavigate(info => infos.push(info));

        history.pushState({}, '', 'https://www.youtube.com/shorts/xyz');
        window.dispatchEvent(new Event('yt-navigate-finish'));

        const last = infos[infos.length - 1];
        expect(last.isShorts).toBe(true);
        expect(last.url).toContain('/shorts/xyz');
    });

    it('never stores a shorts URL as lastNonShortsUrl', async () => {
        const { onNavigate, getLastNonShortsUrl } = await freshModule();
        onNavigate(() => {});

        history.pushState({}, '', 'https://www.youtube.com/watch?v=vid1');
        window.dispatchEvent(new Event('yt-navigate-finish'));
        history.pushState({}, '', 'https://www.youtube.com/shorts/s1');
        window.dispatchEvent(new Event('yt-navigate-finish'));

        const last = getLastNonShortsUrl();
        expect(last).toContain('/watch?v=vid1');
        expect(last).not.toContain('/shorts/');
    });

    it('stops calling after unsubscribe', async () => {
        const { onNavigate } = await freshModule();
        let count = 0;
        const unsub = onNavigate(() => count++);
        expect(count).toBe(1); // initial

        unsub();
        history.pushState({}, '', 'https://www.youtube.com/watch?v=vid2');
        window.dispatchEvent(new Event('yt-navigate-finish'));
        expect(count).toBe(1); // no further calls
    });
});