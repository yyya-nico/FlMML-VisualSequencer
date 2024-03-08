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

let scrollResolveTimeout;

const waitScroll = (target = window) => {
  return new Promise(resolve => {
    const scrollTimeout = setTimeout(() => {
      resolve();
    }, 100);
    const scrollHandler = () => {
        clearTimeout(scrollTimeout);
        clearTimeout(scrollResolveTimeout);
        scrollResolveTimeout = setTimeout(() => {
          target.removeEventListener('scroll', scrollHandler);
          resolve();
        }, 100);
      }
    target.addEventListener('scroll', scrollHandler);
  });
}

export {htmlspecialchars, resetAnimation, useVisualViewportToCss, waitScroll}