const ID_SHORTS: string[]=[
    'ytd-rich-section-renderer.ytd-rich-grid-renderer',
    'ytd-reel-shelf-renderer',
    '[is-shorts]',
    'a[href^="/shorts/"]'
];

function remove_shorts(): void{
    ID_SHORTS.forEach(x =>{
        const elements = document.querySelectorAll(x);
        elements.forEach(el => {
            const htmlElement = el as HTMLElement;
            if(htmlElement.style.display !== 'none'){
                 htmlElement.style.display = 'none';
            }
        });
    });
}

remove_shorts();

let debounceTimer: ReturnType<typeof setTimeout>;

const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        remove_shorts();
    }, 100);
});

observer.observe(document.body, {
    childList: true, subtree: true
});
