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

export {htmlspecialchars, resetAnimation}