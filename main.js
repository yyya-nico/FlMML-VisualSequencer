import './style.scss'
import FlMMLWorkerLocation from './flmml-on-html5.worker.js?url'

import {FlMML} from "flmml-on-html5";
import {htmlspecialchars} from './utils';

const version = import.meta.env.VITE_APP_VER;

document.addEventListener('DOMContentLoaded', () => {
    const mmlForm = document.forms['mml-line'];
    mmlForm.add = {
        field: mmlForm.elements['add-mml'],
        mmlText: mmlForm.elements['add-mml-text'],
        btn: mmlForm.elements['add-button']
    };
    mmlForm.del = {
        field: mmlForm.elements['delete-mml'],
        index: mmlForm.elements['delete-mml-index'],
        btn: mmlForm.elements['delete-button']
    }
    mmlForm.rw = {
        field: mmlForm.elements['rewrite-mml'],
        index: mmlForm.elements['rewrite-mml-index'],
        mmlText: mmlForm.elements['rewrite-mml-text'],
        btn: mmlForm.elements['rewrite-button']
    }
    const editor = document.querySelector('.editor');
    const tones = document.getElementById('tones');
    const action = document.getElementById('action');
    const musicalScore = document.getElementById('musical-score');
    const playBtn = document.getElementById('play');
    const warnOut = document.getElementById('warn-out');
    const mmlOut = document.getElementById('mml');
    const copyBtn = document.getElementById('copy');
    const saveBtn = document.getElementById('save');
    const openBtn = document.getElementById('open');

    class Mml {
        #generatorComment = `#COMMENT Generated by FlMML VisualSequencer ${version}`;
        #mml = [];
        #changeHandler = (arr, mmlText) => {};
        #errorHandler = (error, reason) => {};

        set onChange(fn) {
            this.#changeHandler = fn;
        }

        set onError(fn) {
            this.#errorHandler = fn;
        }

        setMmlArr(arr) {
            this.#mml = arr;
            this.#changeHandler(this.getMmlArr(), this.getMml());
        }

        setMml(str) {
            this.#mml = str.split('\n');
            const isGeneratedMmlText = this.#mml.at(-2) === '' && this.#mml.at(-1) === this.#generatorComment;
            if (isGeneratedMmlText) {
                this.#mml.splice(-2, 2);
            }
            this.#changeHandler(this.getMmlArr(), this.getMml());
        }

        getMmlArr() {
            return this.#mml;
        }

        getMml() {
            if (this.#mml.length) {
                return this.#mml.concat([
                    '',
                    this.#generatorComment
                ]).join('\n');
            } else {
                return '';
            }
        }

        insert(i, str) {
            const valid = Object.hasOwn(this.#mml, i) || i === 0;
            if (valid) {
                this.#mml.splice(i, 0, str);
                this.#changeHandler(this.getMmlArr(), this.getMml());
            } else {
                this.#errorHandler('範囲外の書き換え指定', `範囲${this.#mml.length - 1}までのところ、${i}`);
            }
        }

        append(str) {
            this.#mml.push(str);
            this.#changeHandler(this.getMmlArr(), this.getMml());
        }

        rewrite(i, str) {
            const valid = Object.hasOwn(this.#mml, i);
            if (valid) {
                this.#mml[i] = str;
                this.#changeHandler(this.getMmlArr(), this.getMml());
            } else {
                this.#errorHandler('範囲外の書き換え指定', `範囲${this.#mml.length - 1}までのところ、${i}`);
            }
        }

        delete(i, delCount = 1) {
            const valid = Object.hasOwn(this.#mml, i);
            if (valid && this.#mml.splice(i, delCount).length !== 0) {
                this.#changeHandler(this.getMmlArr(), this.getMml());
            } else {
                this.#errorHandler('無効な指定', `範囲${this.#mml.length - 1}までの中で${i}から${delCount}削除するのはできません`);
            }
        }
    }

    class History {
        #histArr = [[],[]];
        #maxArrLength = 70;
        #popstateHandler = obj => {};

        set onPopstate(fn) {
            this.#popstateHandler = fn;
        }
        
        pushState(obj) {
            this.#histArr[0].push(obj);
            if (this.#histArr[0].length > this.#maxArrLength) {
                this.#histArr[0].shift();
            }
            this.#histArr[1].length = 0;
        }

        undo() {
            const data = this.#histArr[0].pop();
            this.#popstateHandler({
                reason: 'undo',
                data
            });
            data && this.#histArr[1].unshift(data);
        }

        redo() {
            const data = this.#histArr[1].shift();
            this.#popstateHandler({
                reason: 'redo',
                data
            });
            data && this.#histArr[0].push(data);
        }
    }

    FlMML.prepare(`#${playBtn.id}`);
    const flmml = new FlMML({workerURL: FlMMLWorkerLocation});
    const mml = new Mml();
    const history = new History();

    // const noDrop = (...modes) => {
    //     [tones, action, musicalScore].forEach((target, i) => {
    //         if (modes[i]) {
    //             target.classList.add('no-drop');
    //         } else {
    //             target.classList.remove('no-drop');
    //         }
    //     });
    // };
    const createMIsHtml = name => `<span class="material-icons">${name}</span>`;
    const playHtml = createMIsHtml('play_arrow') + '再生';
    const stopHtml = createMIsHtml('stop') + '停止';

    const compileHandler = () => {
        warnOut.innerHTML = flmml.getWarnings().replaceAll('\n','<br>');
    };
    flmml.addEventListener('compilecomplete', compileHandler);
    const completeHandler = () => {
        playBtn.innerHTML = playHtml;
    };
    flmml.addEventListener('complete', completeHandler);

    mml.onChange = (arr, mmlText) => {
        mmlOut.innerHTML = mmlText ? `<pre><code>${htmlspecialchars(mmlText).replaceAll('\n','<br>')}</code></pre>` : '(なし)';
        const mmlIsExist = Boolean(arr.length);
        [mmlForm.del.field, mmlForm.rw.field, copyBtn, saveBtn].forEach(elem => {
            elem.disabled = !mmlIsExist;
        });
        if (mmlIsExist) {
            mmlForm.del.index.max = arr.length - 1;
            mmlForm.rw.index.max = arr.length - 1;
            mmlForm.del.index.value > mmlForm.del.index.max && (mmlForm.del.index.value = mmlForm.del.index.max);
            mmlForm.rw.index.value > mmlForm.rw.index.max && (mmlForm.rw.index.value = mmlForm.rw.index.max);
            localStorage.setItem('mmlArray', JSON.stringify(arr));
        } else {
            localStorage.removeItem('mmlArray');
        }
    };
    mml.onError = (error, reason) => {
        alert(error + '\n' + reason);
    };
    const savedMmlArr = JSON.parse(localStorage.getItem('mmlArray'));
    if (savedMmlArr) {
        mml.setMmlArr(savedMmlArr);
    }

    history.onPopstate = obj => {
        const data = obj.data;
        switch (obj.reason) {
            case 'undo':
                switch (data?.operation) { //元に戻す操作集
                    case 'append':
                        mml.delete(data.index);
                        break;
                    case 'delete':
                        mml.insert(data.index, data.mmlText);
                        break;
                    case 'rewrite':
                        mml.rewrite(data.index, data.beforeMmlText);
                        break;
                }
                break;
            case 'redo':
                switch (data?.operation) { //やり直し操作集
                    case 'append':
                        mml.append(data.mmlText);
                        break;
                    case 'delete':
                        mml.delete(data.index);
                        break;
                    case 'rewrite':
                        mml.rewrite(data.index, data.afterMmlText);
                        break;
                }
                break;
        }
    };

    const rewriteNoteClass = (operation) => {
        [...tones.getElementsByTagName('button')].forEach((elem, index) => {
            const noteClassName = [...elem.classList].find(name => name.includes('note-'));
            elem.classList.replace(noteClassName, `note-${index + 1}`);
            operation === 'remove' && [...musicalScore.getElementsByClassName(noteClassName)].forEach(elem => {
                elem.classList.replace(noteClassName, `note-${index + 1}`);
            });
        });
    }

    document.addEventListener('keydown', e => {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.ctrlKey && history.undo();
                break;
            case 'y':
                e.ctrlKey && history.redo();
                break;
        }
    });

    editor.addEventListener('click', () => {

    });

    editor.addEventListener('contextmenu', e => {
        const parent = e.target.closest('#tones, #musical-score');
        if (parent && e.target.tagName.toLowerCase() === 'button') {
            e.preventDefault();
            const removeTarget = e.target.closest('li');
            const buttonClassName = e.target.className;
            removeTarget.remove();
            if (parent == tones) {
                musicalScore.querySelectorAll(`[class="${buttonClassName}"]`).forEach(elem => {
                    elem.closest('li').remove();
                });
                rewriteNoteClass('remove');
            }
        }
    });

    let dragInfo = null;
    editor.addEventListener('dragstart', e => {
        const editorSectionElem = e.target.nodeType === 1/* ELEMENT */ && e.target.closest('#tones, #action, #musical-score');
        dragInfo = {
            from: editorSectionElem,
            item: e.target
        };
        e.dataTransfer.effectAllowed = 'copyMove';
    });
    let dropEffect = null;
    [tones, action, musicalScore].forEach(target => {
        const dragEventHandler = e => {
            const {from} = dragInfo;
            const dt = e.dataTransfer;
            switch (from) {
                case tones:
                    switch (target) {
                        case tones:
                            e.preventDefault();
                            if (!e.ctrlKey) {
                                dt.dropEffect = 'move';
                            } else {
                                dt.dropEffect = 'copy';
                            }
                            break;
                        case action:
                            break;
                        case musicalScore:
                            e.preventDefault();
                            dt.dropEffect = 'copy';
                            break;
                    }
                    break;
                case action:
                    switch (target) {
                        case tones:
                            break;
                        case action:
                            break;
                        case musicalScore:
                            e.preventDefault();
                            dt.dropEffect = 'copy';
                            break;
                    }
                    break;
                case musicalScore:
                    switch (target) {
                        case tones:
                            break;
                        case action:
                            break;
                        case musicalScore:
                            e.preventDefault();
                            if (!e.ctrlKey) {
                                dt.dropEffect = 'move';
                            } else {
                                dt.dropEffect = 'copy';
                            }
                            break;
                    }
                    break;
            }
            dropEffect = dt.dropEffect;
        };
        target.addEventListener('dragenter', dragEventHandler);
        target.addEventListener('dragover', dragEventHandler);
        target.addEventListener('drop', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.dataTransfer.dropEffect !== 'none' ? e.dataTransfer.dropEffect : dropEffect;
            const {from, item} = dragInfo;
            switch (e.dataTransfer.dropEffect) {
                case 'copy':
                    const ul = e.target.closest('#tones, #musical-score').querySelector('ul');
                    const li = document.createElement('li');
                    li.appendChild(item.cloneNode(true));
                    ul.appendChild(li);
                    if (from === tones && target == tones) {
                        rewriteNoteClass('copy');
                    }
                    break;
                case 'move':
                    
                    break;
            }
        });
    });

    //---------------
    // Form Controls
    //---------------

    mmlForm.addEventListener('submit', async e => {
        e.preventDefault();
        const mmlArr = mml.getMmlArr();
        switch (e.submitter) {
            case mmlForm.add.btn:
                mmlForm.add.field.disabled = true;
                mmlForm.add.btn.textContent = '追加中...';
                const addMmlText = mmlForm.add.mmlText.value;
                mml.append(addMmlText);
                history.pushState({
                    operation: 'append',
                    index: mmlArr.length - 1,
                    mmlText: addMmlText
                });
                mmlArr.length && (mmlForm.add.field.disabled = false);
                mmlForm.add.btn.textContent = '追加';
                break;
            case mmlForm.del.btn:
                mmlForm.del.field.disabled = true;
                mmlForm.del.btn.textContent = '削除中...';
                const delIndex = Number(mmlForm.del.index.value);
                const delMmlText = mmlArr[delIndex];
                mml.delete(delIndex);
                history.pushState({
                    operation: 'delete',
                    index: delIndex,
                    mmlText: delMmlText
                });
                mmlArr.length && (mmlForm.del.field.disabled = false);
                mmlForm.del.btn.textContent = '削除';
                break;
            case mmlForm.rw.btn:
                mmlForm.rw.field.disabled = true;
                mmlForm.rw.btn.textContent = '書換中...';
                const rwIndex = Number(mmlForm.rw.index.value);
                const rwMmlText = mmlForm.rw.mmlText.value;
                const beforeRwMmlText = mmlArr[rwIndex];
                mml.rewrite(rwIndex, rwMmlText);
                history.pushState({
                    operation: 'rewrite',
                    index: rwIndex,
                    beforeMmlText: beforeRwMmlText,
                    afterMmlText: rwMmlText
                });
                mmlArr.length && (mmlForm.rw.field.disabled = false);
                mmlForm.rw.btn.textContent = '書換';
                break;
        }
    });

    //----------------
    // /Form Controls
    //----------------

    playBtn.addEventListener('click', () => {
        const isPlaying = flmml.isPlaying();
        if (!isPlaying) {
            flmml.play(mml.getMml());
        } else {
            flmml.stop();
        }
        playBtn.innerHTML = !isPlaying ? stopHtml : playHtml;
    });

    copyBtn.addEventListener('click', () => {
        const mmlText = mml.getMml();
        const textCache = copyBtn.innerHTML;
        copyBtn.disabled = true;
        navigator.clipboard.writeText(mmlText)
        .then(() => {
            copyBtn.disabled = true;
            copyBtn.innerHTML = createMIsHtml('content_copy') + 'コピーしました';
            setTimeout(() => {
                copyBtn.innerHTML = textCache;
                copyBtn.disabled = false;
            }, 1500);
        })
        .catch(e => alert('コピーできませんでした\n' + e));
    });

    saveBtn.addEventListener('click', () => {
        const mmlText = mml.getMml();
        const blob = new Blob([mmlText], {type: 'text/plain'});
        const link = document.createElement('a');
        link.download = 'Sequence' + '.mml';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    });

    openBtn.addEventListener('click', () => {
        const inputFile = document.createElement('input');
        const fr = new FileReader();
        inputFile.type = 'file';
        inputFile.accept = '.mml,.flmml,.txt,text/plain'
        inputFile.click();
        inputFile.onchange = () => {
            fr.onload = () => {
                mml.setMml(fr.result);
            };
            fr.readAsText(inputFile.files[0]);
        }
    });
});