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
    const dialog = document.getElementById('dialog');
    const dialogForm = document.forms['dialog-form'];
    dialogForm._title = dialogForm.querySelector('.form-title');
    dialogForm.inputs = dialogForm.querySelector('.inputs');
    dialogForm.buttons = dialogForm.querySelector('.buttons');
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

    class Block {
        #blocksData = [];

        constructor(areaElem) {
            this.areaElem = areaElem;
        }

        blocksDataUpdate() {
            this.#blocksData = [...this.areaElem.getElementsByTagName('button')].map(elem => ({
                label: elem.ariaLabel,
                noteClassName: [...elem.classList].find(name => name.includes('note-')),
                tone: {
                    tone: elem.dataset.tone,
                    tonePitch: elem.dataset.tonePitch
                },
                noteValue: elem.dataset.noteValue,
                rest: elem.dataset.rest,
                tempo: elem.dataset.tempo,
                elem: elem
            }));
        }
        
        exportMml(mml) {
            mml.setMmlArr([]);
            let mmlText = '';
            this.#blocksData.forEach(block => {
                const {tone, tonePitch} = block.tone;
                mmlText += tonePitch || block.noteValue || block.rest || block.tempo || '';
            });
            mml.append(mmlText);
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

        clear() {
            this.#histArr[0].length = 0;
            this.#histArr[1].length = 0;
        }
    }

    class DialogFormManager {
        #dialogDefinitions = {
            tone: {
                title: '音色設定',
                inputs: [
                    {
                        label: '名前',
                        type: 'text',
                        name: 'tone-name'
                    },
                    {
                        label: '音の定義',
                        type: 'text',
                        name: 'tone-def'
                    },
                ],
                buttons: [
                    {
                        class: 'primaly',
                        value: 'set-tone',
                        textContent: '確定'
                    }
                ]
            },
            noteValue: {
                title: '音価設定',
                inputs: [
                    {
                        label: '音価(音の長さ)',
                        type: 'number',
                        name: 'note-value'
                    }
                ],
                buttons: [
                    {
                        class: 'primaly',
                        value: 'set-note-value',
                        textContent: '確定'
                    }
                ]
            },
            rest: {
                title: '休符設定',
                inputs: [
                    {
                        label: '休符の長さ',
                        type: 'number',
                        name: 'rest'
                    }
                ],
                buttons: [
                    {
                        class: 'primaly',
                        value: 'set-rest',
                        textContent: '確定'
                    }
                ]
            },
            tempo: {
                title: 'テンポ設定',
                inputs: [
                    {
                        label: 'テンポ指定(BPM)',
                        type: 'number',
                        name: 'tempo'
                    }
                ],
                buttons: [
                    {
                        class: 'primaly',
                        value: 'set-tempo',
                        textContent: '確定'
                    }
                ]
            }
        }
        #createElems = (type) => {
            const def = this.#dialogDefinitions[type];
            Object.keys(def).forEach(key => {
                switch (key) {
                    case 'title':
                        dialogForm._title.textContent = def.title;
                        break;
                    case 'inputs':
                        def.inputs.forEach(inputDef => {
                            const input = document.createElement('input');
                            let appendElem = input;
                            Object.entries(inputDef).forEach(entry => {
                                if (entry[0] === 'label') {
                                    const label = document.createElement('label');
                                    label.textContent = entry[1];
                                    label.appendChild(input);
                                    appendElem = label;
                                } else {
                                    input.setAttribute(entry[0], entry[1]);
                                }
                            });
                            dialogForm.inputs.appendChild(appendElem);
                        });
                        break;
                    case 'buttons':
                        def.buttons.forEach(buttonDef => {
                            const button = document.createElement('button');
                            Object.entries(buttonDef).forEach(entry => {
                                if (entry[0] === 'textContent') {
                                    button.textContent = entry[1];
                                } else {
                                    button.setAttribute(entry[0], entry[1]);
                                }
                            });
                            dialogForm.buttons.appendChild(button);
                        });
                        break;
                }
            });
        }

        #set = (type, initVals) => {
            dialogForm._title.textContent = '';
            dialogForm.inputs.textContent = '';
            dialogForm.buttons.textContent = '';
            this.#createElems(type);
            for (const [name, value] of Object.entries(initVals)) {
                dialogForm.elements[name].value = value;
            }
            this.type = type;
        }

        constructor() {
            this.type = null;
            this.submitTarget = null;
            this.resolve = null;
        }

        async prompt(type, initVals, submitTarget) {
            this.#set(type, initVals);
            this.submitTarget = submitTarget;
            dialog.showModal();
            return new Promise(resolve => this.resolve = resolve);
        }
    }

    FlMML.prepare(`#${playBtn.id}`);
    const flmml = new FlMML({workerURL: FlMMLWorkerLocation});
    const mml = new Mml();
    const block = new Block(musicalScore);
    const history = new History();
    const dialogFormManager = new DialogFormManager();

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

    const getNonExistNoteClassName = () => {
        const noteClassNames = [...tones.getElementsByTagName('button')].map(elem => [...elem.classList].find(name => name.includes('note-')));
        for (let index = 1; ; index++) {
            if (!noteClassNames.includes('note-' + index)) {
                return 'note-' + index;
            }
        }
    };

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

    let lastAddedButton = tones.querySelector('button');
    editor.addEventListener('click', async e => {
        const is = id => Boolean(e.target.closest('#' + id));
        const isButton =  e.target.tagName.toLowerCase() === 'button';
        if (is('tones')) {
            if (isButton) {
                dialogFormManager.prompt('tone', {
                    'tone-name': e.target.ariaLabel,
                    'tone-def': e.target.dataset.tone
                }, e.target);
            } else {
                const ul = tones.querySelector('ul');
                const li = document.createElement('li');
                const nonExistClassName = getNonExistNoteClassName();
                const toneButton = `<button class="material-icons plain ${nonExistClassName}" aria-label="無調整" draggable="true" data-tone="" data-tone-pitch="c">music_note</button>`;
                li.innerHTML = toneButton;
                await dialogFormManager.prompt('tone', {
                    'tone-name': li.firstElementChild.ariaLabel,
                    'tone-def': li.firstElementChild.dataset.tone
                }, li.firstElementChild);
                ul.appendChild(li);
                lastAddedButton = li.firstElementChild;
            }
        } else if (is('action')) {
        } else if (is('musical-score')) {
            if (isButton) {
                if ('tone' in e.target.dataset) {
                    flmml.play(e.target.dataset.tone + e.target.dataset.tonePitch);
                }
            } else {
                if (lastAddedButton) {
                    const ul = musicalScore.querySelector('ul');
                    const li = document.createElement('li');
                    const newItem = lastAddedButton.cloneNode(true);
                    li.appendChild(newItem);
                    ul.appendChild(li);
                    lastAddedButton = newItem;
                    block.blocksDataUpdate();
                    block.exportMml(mml);
                    if ('tonePitch' in newItem.dataset) {
                        flmml.play(newItem.dataset.tone + newItem.dataset.tonePitch);
                    }
                }
            }
        }
        if (isButton) {
            if ('noteValue' in e.target.dataset) {
                await dialogFormManager.prompt('noteValue', {
                    'note-value': e.target.dataset.noteValue.replace('l', '')
                }, e.target);
            } else if ('rest' in e.target.dataset) {
                await dialogFormManager.prompt('rest', {
                    'rest': e.target.dataset.rest.replace('r', '')
                }, e.target);
            } else if ('tempo' in e.target.dataset) {
                await dialogFormManager.prompt('tempo', {
                    'tempo': e.target.dataset.tempo.replace('t', '')
                }, e.target);
            }
            block.blocksDataUpdate();
            block.exportMml(mml);
        }
    });

    editor.addEventListener('contextmenu', e => {
        const parent = e.target.closest('#tones, #musical-score');
        const isButton =  e.target.tagName.toLowerCase() === 'button';
        if (parent && isButton) {
            e.preventDefault();
            const removeTarget = e.target.parentElement;
            const buttonClassName = e.target.className;
            removeTarget.remove();
            if (parent === tones) {
                musicalScore.querySelectorAll(`[class="${buttonClassName}"]`).forEach(elem => {
                    elem.parentElement.remove();
                });
            }
            block.blocksDataUpdate();
            block.exportMml(mml);
        }
    });

    editor.addEventListener('wheel', e => {
        const parentMusicalScore = e.target.closest('#musical-score');
        const isButton =  e.target.tagName.toLowerCase() === 'button';
        if (parentMusicalScore && isButton && 'tone' in e.target.dataset) { //TODO
            e.preventDefault();
            const pitches = ['c','c+','d','d+','e','f','f+','g','g+','a','a+','b'];
            const octave = ['>', '<'];
            const currentPitch = e.target.dataset.tonePitch;
            const currentPitchIndex = pitches.findIndex(pitch => currentPitch.replaceAll(octave[0], '').replaceAll(octave[1], '') === pitch);
            const countStr = str => (currentPitch.match(new RegExp(str, 'g')) || []).length;
            const octaveCount = [
                countStr(octave[0]),
                countStr(octave[1])
            ]
            const octaveStr = octave[0].repeat(octaveCount[0]) + octave[1].repeat(octaveCount[1]);
            if (e.deltaY < 0) { // Up
                if (currentPitchIndex === pitches.length - 1) {
                    if (octaveCount[0]) {
                        e.target.dataset.tonePitch = octaveStr.substring(1) + pitches.at(0);
                    } else {
                        e.target.dataset.tonePitch = octaveStr + octave[1] + pitches.at(0);
                    }
                } else {
                    e.target.dataset.tonePitch = octaveStr + pitches[currentPitchIndex + 1];
                }
            } else if (e.deltaY > 0) { // Down
                if (currentPitchIndex === 0) {
                    if (octaveCount[1]) {
                        e.target.dataset.tonePitch = octaveStr.substring(1) + pitches.at(-1);
                    } else {
                        e.target.dataset.tonePitch = octaveStr + octave[0] + pitches.at(-1);
                    }
                } else {
                    e.target.dataset.tonePitch = octaveStr + pitches[currentPitchIndex - 1];
                }
            }
            flmml.play(e.target.dataset.tone + e.target.dataset.tonePitch);
            block.blocksDataUpdate();
            block.exportMml(mml);
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
        target.addEventListener('drop', async e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.dataTransfer.dropEffect !== 'none' ? e.dataTransfer.dropEffect : dropEffect;
            const {from, item} = dragInfo;
            const ul = e.target.closest('#tones, #musical-score').querySelector('ul');
            const targetIsButton =  e.target.tagName.toLowerCase() === 'button';
            let newNode;
            switch (e.dataTransfer.dropEffect) {
                case 'copy':
                    const li = document.createElement('li')
                    const newItem = item.cloneNode(true);
                    if (target === tones) {
                        const noteClassName = [...item.classList].find(name => name.includes('note-'));
                        newItem.classList.replace(noteClassName, getNonExistNoteClassName());
                    } else if (from === action) {
                        if ('noteValue' in item.dataset) {
                            await dialogFormManager.prompt('noteValue', {
                                'note-value': item.dataset.noteValue.replace('l', '')
                            }, e.target);
                        } else if ('rest' in item.dataset) {
                            await dialogFormManager.prompt('rest', {
                                'rest': item.dataset.rest.replace('r', '')
                            }, e.target);
                        } else if ('tempo' in item.dataset) {
                            await dialogFormManager.prompt('tempo', {
                                'tempo': item.dataset.tempo.replace('t', '')
                            }, e.target);
                        }
                    }
                    li.appendChild(newItem);
                    newNode = li;
                    break;
                case 'move':
                    newNode = item.parentElement;
                    break;
            }
            if (targetIsButton) {
                ul.insertBefore(newNode, e.target.parentElement);
            } else {
                ul.appendChild(newNode);
            }
            lastAddedButton = newNode.firstElementChild;
            if (target === musicalScore) {
                block.blocksDataUpdate();
                block.exportMml(mml);
                if ('tonePitch' in item.dataset) {
                    flmml.play(item.dataset.tone + item.dataset.tonePitch);
                }
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

    dialog.addEventListener('click', e => {
        if (e.target === dialog) {
            dialog.close();
        }
    });

    dialogForm.addEventListener('submit', e => {
        const submitTarget = dialogFormManager.submitTarget;
        switch (e.submitter.value) {
            case 'set-tone':
                const buttonClassName = submitTarget.className;
                document.querySelectorAll(`[class="${buttonClassName}"]`).forEach(elem => {
                    elem.ariaLabel = dialogForm.elements['tone-name'].value;
                    elem.dataset.tone = dialogForm.elements['tone-def'].value;
                });
                flmml.play(submitTarget.dataset.tone + submitTarget.dataset.tonePitch);
                break;
            case 'set-note-value':
                submitTarget.dataset.noteValue = 'l' + dialogForm.elements['note-value'].value;
                break;
            case 'set-rest':
                submitTarget.dataset.rest = 'r' + dialogForm.elements['rest'].value;
                break;
            case 'set-tempo':
                submitTarget.dataset.tempo = 't' + dialogForm.elements['tempo'].value;
                break;
        }
        dialogFormManager.resolve();
    });

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
                history.clear();
            };
            fr.readAsText(inputFile.files[0]);
        }
    });
});