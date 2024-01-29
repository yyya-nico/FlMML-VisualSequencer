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
}

export {htmlspecialchars}