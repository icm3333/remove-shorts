import{getSettingsWithReset, onSettingsChanged} from './storage';

const ID_SHORTS: string[]=[
    'ytd-rich-section-renderer.ytd-rich-grid-renderer',
    'ytd-reel-shelf-renderer',
    '[is-shorts]',
    'a[href^="/shorts/"]'
];

const HIDE_ATTRIBUTE = 'data-sr-hidden';
let enabled = true;

function ensureStyle(): void{
    if(document.getElementById('sr-style')) return;
    const style = document.createElement('style');
    style.id = 'sr-style';
    style.textContent = `[${HIDE_ATTRIBUTE}="1"]{display:none !important;}`;
    document.documentElement.appendChild(style);
}

function removeShorts(): void{
    if(!enabled) return;

    for(const sel of ID_SHORTS){
        document.querySelectorAll<HTMLElement>(sel).forEach(el =>{
            if(el.getAttribute(HIDE_ATTRIBUTE) !== '1'){
                el.setAttribute(HIDE_ATTRIBUTE, '1');
            }
        });
    }
}

function restoreShorts(): void{
    document.querySelectorAll<HTMLElement>(`[${HIDE_ATTRIBUTE}="1"]`).forEach(el => {
        el.removeAttribute(HIDE_ATTRIBUTE);
    })
}

let debouceTimer: ReturnType<typeof setTimeout>;
const observer = new MutationObserver(() => {
    clearTimeout(debouceTimer);
    debouceTimer = setTimeout(() => {
        removeShorts()
    }, 100);
});

async function init(): Promise<void>{
    ensureStyle();

    const s = await getSettingsWithReset();
    enabled = s.enabled;
    if(enabled) removeShorts();

    observer.observe(document.body, {childList: true, subtree: true});

    onSettingsChanged(next => {
        if(next.enabled === enabled) return;
        enabled = next.enabled;
        if(enabled){
            removeShorts();
        }else{
            restoreShorts();
        }
    });
}

init();