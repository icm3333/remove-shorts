export interface NavInfo{
    url: string;
    isShorts: boolean;
    previousUrl: string | null;
}

export function isShortsPage(url: string = location.href): boolean{
    try{
        return new URL(url, location.href).pathname.startsWith('/shorts/');
    }catch{
        return false;
    }
}

type Listener = (info: NavInfo) => void;
const listeners: Listener[] = [];
let lastHandledUrl: string = location.href;
let lastNonShortsUrl: string | null = isShortsPage(location.href) ? null : location.href;

export function getLastNonShortsUrl(): string | null {
    return lastNonShortsUrl;
}

function handleUrlChange(): void{
    const url: string = location.href;
    if(url === lastHandledUrl) return;

    const previousUrl: string = lastHandledUrl;
    lastHandledUrl = url;

    const shorts: boolean = isShortsPage(url);
    if(!shorts) lastNonShortsUrl = url;

    const info: NavInfo = {url, isShorts:shorts, previousUrl};
    listeners.forEach(cb => cb(info));
}

function patchHistory(): void{
    const w = window as unknown as {__srHistoryPatched?: boolean};
    if(w.__srHistoryPatched) return;
    w.__srHistoryPatched = true;

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = function (this: History, ...args: Parameters<History['pushState']>){
        const ret = origPush(...args);
        handleUrlChange();
        return ret;
    };

    history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>){
        const ret = origReplace(...args);
        handleUrlChange();
        return ret;
    };
}

let started = false;
function startWatching(): void{
    if(started) return;
    started = true;

    window.addEventListener('yt-navigate-finish', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    patchHistory();
}

export function onNavigate(cb: Listener): () => void{
    startWatching();
    listeners.push(cb);

    cb({ url: lastHandledUrl, isShorts: isShortsPage(lastHandledUrl), previousUrl: null,});

    return () => {
        const i = listeners.indexOf(cb);
        if(i >= 0) listeners.splice(i, 1);
    }
}