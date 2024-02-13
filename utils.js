const htmlspecialchars = unsafeText => {
    if(typeof unsafeText !== 'string'){
        return unsafeText;
    }
    return unsafeText.replace(
        /[&'`"<>]/g, 
        match => {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
        }[match]
        }
    );
};

const resetAnimation = (elem, token) => {
    elem.classList.remove(token);
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            elem.classList.add(token);
        });
    });
};

const useVisualViewportToCss = () => {
    const vv = window.visualViewport;
    const setVvh = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`);     
    vv.addEventListener("resize", setVvh);
    setVvh();
};

export {htmlspecialchars, resetAnimation, useVisualViewportToCss}