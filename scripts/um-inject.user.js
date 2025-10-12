// ==UserScript==
// @name         UMEditor Quick Injector
// @namespace    http://example.com/
// @version      1.0
// @description  快速在页面中注入文本与 LaTeX 到 UMEditor（浮动面板，支持热键 Ctrl+Alt+I）
// @author       Generated
// @match        https://umeditor.vercel.app/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    // 快速检测编辑器 id（优先带 id 的占位元素）
    function detectEditorId(){
        var el = document.querySelector('script[type="text/plain"][id], textarea[id], div.edui-editor-container[id]');
        if(el && el.id) return el.id;
        // 回退：查找第一个 data-editor 或 class 包含 edui 的容器
        var alt = document.querySelector('[data-editor-id], .edui-editor');
        if(alt && alt.id) return alt.id;
        return 'myEditor';
    }

    function waitForUM(cb){
        var t = setInterval(function(){
            if(window.UM && typeof UM.getEditor === 'function'){
                clearInterval(t); cb();
            }
        }, 200);
        setTimeout(function(){ clearInterval(t); }, 15000);
    }

    // 创建浮动面板
    function createPanel(){
        if(document.getElementById('um-inject-panel')) return;
        var panel = document.createElement('div');
        panel.id = 'um-inject-panel';
        panel.style.position = 'fixed';
        panel.style.right = '20px';
        panel.style.bottom = '20px';
        panel.style.width = '360px';
        panel.style.zIndex = 999999;
        panel.style.background = 'rgba(255,255,255,0.98)';
        panel.style.border = '1px solid #ccc';
        panel.style.padding = '8px';
        panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        panel.style.fontFamily = 'Arial, sans-serif';
        
        // 改为包含混合输入与按钮
        panel.innerHTML = '\
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">\
                <strong style="font-size:13px">UM Injector</strong>\
                <button id="um-inject-close" style="font-size:12px">关闭</button>\
            </div>\
            <div style="margin-bottom:6px">\
                <label style="font-size:12px">文本 (HTML 可用)</label>\
                <textarea id="um-inject-content" style="width:100%;height:58px"></textarea>\
            </div>\
            <div style="margin-bottom:6px">\
                <label style="font-size:12px">LaTeX (原文，例如 \\\\frac{a}{b})</label>\
                <input id="um-inject-latex" style="width:100%"/>\
            </div>\
            <div style="margin-bottom:6px">\
                <label style="font-size:12px">混合文本+LaTeX（支持 $...$, $$...$$, \\\\(...\\\\) 与 \\\\[...\\\\]）</label>\
                <textarea id="um-inject-mixed" style="width:100%;height:80px"></textarea>\
            </div>\
            <div style="display:flex;gap:6px;justify-content:flex-end">\
                <button id="um-insert-content">插入文本</button>\
                <button id="um-insert-latex">插入公式</button>\
                <button id="um-insert-both">插入二者</button>\
                <button id="um-insert-mixed">插入混合内容</button>\
            </div>';

        document.body.appendChild(panel);

        document.getElementById('um-inject-close').addEventListener('click', function(){ panel.style.display = 'none'; });

        document.getElementById('um-insert-content').addEventListener('click', function(){
            var c = document.getElementById('um-inject-content').value || '';
            insertContent(c);
        });
        document.getElementById('um-insert-latex').addEventListener('click', function(){
            var l = document.getElementById('um-inject-latex').value || '';
            insertLatex(l);
        });
        document.getElementById('um-insert-both').addEventListener('click', function(){
            var c = document.getElementById('um-inject-content').value || '';
            var l = document.getElementById('um-inject-latex').value || '';
            if(c) insertContent(c);
            if(l) insertLatex(l);
        });
        document.getElementById('um-insert-mixed').addEventListener('click', function(){
            var mixed = document.getElementById('um-inject-mixed').value || '';
            if(!mixed) return alert('混合内容为空');
            var id = detectEditorId();
            var ed = UM.getEditor(id) || UM.getEditor('myEditor');
            if(!ed) return alert('找不到编辑器实例');
            injectMixedContentToUM(ed, mixed);
        });
    }

    // 注入混合内容函数（与 demo-inject.html 中一致）
    // LaTeX 预处理，和 demo 页面保持一致
    function normalizeLatexForMathQuill(latex){
        if(!latex) return latex;
        var s = String(latex);
        s = s.replace(/\\\{\s*([^{}]+?)\s*\\\}/g, function(_, inner){ return '\\left\\{' + inner + '\\right\\}'; });
        s = s.replace(/\\left\\\{/g, '<<LEFTLBRACE>>').replace(/\\right\\\}/g, '<<RIGHTRBRACE>>');
        s = s.replace(/\|/g, '\\mid');
        s = s.replace(/\\\{/g, '\\lbrace').replace(/\\\}/g, '\\rbrace');
        s = s.replace(/<<LEFTLBRACE>>/g, '\\left\\{').replace(/<<RIGHTRBRACE>>/g, '\\right\\}');
        s = s.replace(/\s{2,}/g, ' ');
        // MathQuill 对 \mathbb 支持有限，降级为 \mathrm 以保证渲染
        s = s.replace(/\\mathbb\{([^}]+?)\}/g, function(_, inner){ return '\\mathrm{' + inner + '}'; });
        // 处理 mhchem 的 \ce{...}：支持嵌套大括号的解析，保留内部内容并用大括号包裹以保留分组
        s = (function(str){
            var out = '';
            var i = 0;
            while (i < str.length) {
                var p = str.indexOf('\\ce{', i);
                if (p === -1) { out += str.slice(i); break; }
                out += str.slice(i, p);
                var j = p + 4; // position after '\\ce{'
                var depth = 1;
                while (j < str.length && depth > 0) {
                    if (str[j] === '{') depth++;
                    else if (str[j] === '}') depth--;
                    j++;
                }
                var inner = str.slice(p + 4, Math.max(p + 4, j - 1));
                out += '{' + inner + '}';
                i = j;
            }
            return out;
        })(s);
        // 将 \xlongequal{...}（长等号）替换为普通等号 '='
        s = s.replace(/\\xlongequal\{[^}]*\}/g, '=');
        return s;
    }

    function injectMixedContentToUM(editor, mixedText) {
        if (!editor || !editor.execCommand) { console.error('editor not found or invalid'); return; }
        function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
        function textToHtml(s) { if(!s) return ''; s = String(s).replace(/\r\n/g,'\n').replace(/\r/g,'\n'); var esc = escapeHtml(s); esc = esc.replace(/\n{2,}/g,'<br><br>'); esc = esc.replace(/\n/g,'<br>'); return esc; }
        var re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\$]+\$)/g;
        var lastIndex = 0; var m; var parts = [];
        while ((m = re.exec(mixedText)) !== null) {
            var idx = m.index;
            if (idx > lastIndex) { var textSegment = mixedText.slice(lastIndex, idx); if (textSegment) parts.push(textToHtml(textSegment)); }
            var token = m[0]; var latex = token; var isDisplay = false;
            if (token.startsWith('$$') && token.endsWith('$$')) { latex = token.slice(2, -2); isDisplay = true; }
            else if (token.startsWith('\\[') && token.endsWith('\\]')) { latex = token.slice(2, -2); isDisplay = true; }
            else if (token.startsWith('\\(') && token.endsWith('\\)')) { latex = token.slice(2, -2); isDisplay = false; }
            else if (token.startsWith('$') && token.endsWith('$')) { latex = token.slice(1, -1); isDisplay = false; }
            latex = latex.trim();
            // 预处理 latex
            var normalized = normalizeLatexForMathQuill(latex);
            var span = '<span class="mathquill-embedded-latex">' + escapeHtml(normalized) + '</span>';
            if (isDisplay) parts.push('<div class="math-display">' + span + '</div>'); else parts.push(span);
            lastIndex = re.lastIndex;
        }
        if (lastIndex < mixedText.length) { var tail = mixedText.slice(lastIndex); if (tail) parts.push(textToHtml(tail)); }
        var html = parts.join('');
        try { var id = detectEditorId(); var ed = UM.getEditor(id) || UM.getEditor('myEditor'); if(!ed) return alert('找不到编辑器实例'); ed.execCommand('inserthtml', html); }
        catch(e) { console.error('inserthtml failed', e); alert('插入失败: '+e.message); }
    }

    function insertContent(html){
        try{
            var id = detectEditorId();
            var ed = UM.getEditor(id);
            if(!ed) ed = UM.getEditor('myEditor');
            if(!ed) return alert('找不到编辑器实例');
            ed.execCommand('inserthtml', html, true);
        }catch(e){ console.error('insertContent error', e); alert('插入失败: '+e.message); }
    }

    function insertLatex(latex){
        try{
            if(!latex) return alert('LaTeX 为空');
            var id = detectEditorId();
            var ed = UM.getEditor(id);
            if(!ed) ed = UM.getEditor('myEditor');
            if(!ed) return alert('找不到编辑器实例');
            ed.execCommand('formula', latex);
        }catch(e){ console.error('insertLatex error', e); alert('插入公式失败: '+e.message); }
    }

    // 热键 Ctrl+Alt+I 打开/切换面板显示
    document.addEventListener('keydown', function(e){
        if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'i'){
            e.preventDefault();
            if(!document.getElementById('um-inject-panel')) createPanel();
            var panel = document.getElementById('um-inject-panel');
            panel.style.display = (panel.style.display === 'none') ? 'block' : 'block';
            document.getElementById('um-inject-latex').focus();
        }
    }, false);

    // 初始化：等 UM 可用后创建面板（面板只在按热键时显示）
    waitForUM(function(){
        console.log('UM detected - UM Injector available (Ctrl+Alt+I)');
        // 提前不渲染 panel，等热键按下创建
    });

})();
