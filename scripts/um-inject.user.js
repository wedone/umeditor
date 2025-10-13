// ==UserScript==
// @name         UMEditor Quick Injector
// @namespace    http://example.com/
// @version      2025.10.14.00002
// @updateURL    http://127.0.0.1:8000/scripts/um-inject.user.js
// @downloadURL  http://127.0.0.1:8000/scripts/um-inject.user.js
// @description  快速在页面中注入文本与 LaTeX 到 UMEditor（浮动面板，支持热键 Ctrl+Alt+I）
// @author       Generated
// @match        https://umeditor.vercel.app/*
// @match        https://www.91chengguo.com/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    // 快速检测编辑器 id（优先带 id 的占位元素）
    function detectEditorId(){
        // 首先查找页面上带 id 的编辑器占位元素，但排除位于油猴面板内的元素
        var el = Array.prototype.slice.call(document.querySelectorAll('script[type="text/plain"][id], textarea[id], div.edui-editor-container[id]'))
            .filter(function(node){ return !node.closest || !node.closest('#um-inject-panel'); })[0];
        if(el && el.id) return el.id;
        // 回退：查找第一个 data-editor 或 class 包含 edui 的容器，亦跳过面板内元素
        var alt = Array.prototype.slice.call(document.querySelectorAll('[data-editor-id], .edui-editor'))
            .filter(function(node){ return !node.closest || !node.closest('#um-inject-panel'); })[0];
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

    // 尝试根据 editor id 在当前 window 或同源 iframes 中获取 UM editor 实例
    function getEditorInstanceById(id){
        try{
            if(window.UM && typeof window.UM.getEditor === 'function'){
                var ed = window.UM.getEditor(id);
                if(ed) return {ed: ed, win: window, where: 'top'};
            }
        }catch(e){ /* ignore */ }
        // 搜索同源 iframe
        var iframes = document.getElementsByTagName('iframe');
        for(var i=0;i<iframes.length;i++){
            var fr = iframes[i];
            try{
                var cw = fr.contentWindow;
                if(!cw) continue;
                if(cw.UM && typeof cw.UM.getEditor === 'function'){
                    var ed2 = cw.UM.getEditor(id);
                    if(ed2) return {ed: ed2, win: cw, where: 'iframe', src: fr.src||fr.getAttribute('data-src')||fr.id||''};
                }
            }catch(e){
                // 可能跨域访问被拒绝，跳过
                // console.log('iframe access denied', e);
            }
        }
        return null;
    }

    // 创建浮动面板
    function createPanel(){
        if(document.getElementById('um-inject-panel')) return;
        var panel = document.createElement('div');
        panel.id = 'um-inject-panel';
        panel.style.position = 'fixed';
        // 如果悬浮标存在，把面板放在悬浮标的上方并略微左移；否则使用默认右下角位置
        var handle = document.getElementById('um-inject-handle');
        if (handle) {
            try {
                var hr = handle.getBoundingClientRect();
                // 计算 right 为视口右边到 handle 右边的距离，再加一个小间距
                var rightPx = Math.max(12, (window.innerWidth - hr.right) + 8);
                // 计算 bottom 为视口底部到 handle.top 的距离，再加一些间距使面板悬于其上方
                var bottomPx = Math.max(12, (window.innerHeight - hr.top) + 12);
                panel.style.right = rightPx + 'px';
                panel.style.bottom = bottomPx + 'px';
            } catch (e) {
                panel.style.right = '20px';
                panel.style.bottom = '20px';
            }
        } else {
            panel.style.right = '20px';
            panel.style.bottom = '20px';
        }
    panel.style.width = '480px';
    panel.style.zIndex = 999999;
    panel.style.background = 'rgba(255,255,255,0.98)';
    panel.style.border = '1px solid rgba(0,0,0,0.08)';
    panel.style.padding = '0';
    panel.style.boxShadow = '0 10px 30px rgba(12,30,80,0.12)';
    panel.style.fontFamily = 'Helvetica, Arial, sans-serif';
    panel.style.borderRadius = '10px';
    panel.style.overflow = 'hidden';
        
        // 改为包含混合输入与按钮（带头部样式）
        panel.innerHTML = '\
            <div id="um-inject-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(90deg,#1e88e5,#1976d2);color:#fff;">\
                <div style="display:flex;align-items:center;gap:10px">\
                    <div style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">UM</div>\
                    <strong style="font-size:14px;letter-spacing:0.2px">橙果错题助手</strong>\
                </div>\
                <button id="um-inject-close" aria-label="关闭面板" style="background:transparent;border:none;color:rgba(255,255,255,0.9);font-size:12px;cursor:pointer;padding:6px 8px;border-radius:6px">✕</button>\
            </div>\
            <div style="padding:12px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,252,0.98));">\
                <div>\
                    <label style="font-size:12px;color:#444;display:block;margin-bottom:6px">预览（HTML 可用）</label>\
                    <textarea id="um-inject-content" style="width:100%;height:62px;border:1px solid rgba(0,0,0,0.06);padding:8px;border-radius:6px;resize:vertical;font-family:inherit;font-size:13px"></textarea>\
                </div>\
                <div>\
                    <label style="font-size:12px;color:#444;display:block;margin-bottom:6px">混合文本+LaTeX（支持 $...$ / $$...$$ / \\(...\\) / \\[...\\]）</label>\
                    <textarea id="um-inject-mixed" style="width:100%;height:110px;border:1px solid rgba(0,0,0,0.06);padding:8px;border-radius:6px;resize:vertical;font-family:Menlo,Consolas,monospace;font-size:13px"></textarea>\
                </div>\
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px">\
                    <div style="display:flex;align-items:center">\
                        <button id="um-clear-editor" aria-label="清空编辑器" style="background:#ff4d4f;color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">清空编辑器</button>\
                        <span id="um-clear-confirm" style="display:none;opacity:0;margin-left:8px;padding:6px;border-radius:6px;background:#fff;border:1px solid #eee;box-shadow:0 6px 12px rgba(0,0,0,0.06);font-size:12px;align-items:center;transition:opacity 180ms ease;">\
                            <span style="margin-right:8px;color:#333">确定清空？</span>\
                            <button id="um-clear-confirm-yes" aria-label="确认清空" style="background:#ff4d4f;color:#fff;border:none;padding:6px 10px;border-radius:6px;margin-right:6px;cursor:pointer">确认</button>\
                            <button id="um-clear-confirm-no" aria-label="取消清空" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">取消</button>\
                        </span>\
                    </div>\
                    <div style="display:flex;gap:8px">\
                        <button id="um-insert-content" aria-label="插入文本" style="background:linear-gradient(180deg,#f3f4f6,#eef1f6);border:1px solid rgba(0,0,0,0.06);padding:8px 10px;border-radius:6px;cursor:pointer">插入文本</button>\
                        <button id="um-insert-mixed" aria-label="插入混合内容" style="background:linear-gradient(180deg,#1e88e5,#1976d2);color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">插入混合内容</button>\
                    </div>\
                </div>\
            </div>';

        document.body.appendChild(panel);

        // 强制面板内元素使用 border-box，避免 width:100% + padding 导致溢出
        (function(){
            try{
                var style = document.createElement('style');
                style.type = 'text/css';
                style.appendChild(document.createTextNode('\n#um-inject-panel, #um-inject-panel * { box-sizing: border-box; }\n#um-inject-panel textarea { max-width: 100%; width: 100%; }\n#um-inject-panel button { min-width: 0; }\n'));
                document.head.appendChild(style);
            }catch(e){/* ignore */}
        })();

        // 简单美化交互：按钮 hover 动画和 focus 样式（通过 JS 绑定以避免复杂样式注入）
        (function(){
            var ids = ['um-inject-close','um-clear-editor','um-clear-confirm-yes','um-clear-confirm-no','um-insert-content','um-insert-mixed'];
            ids.forEach(function(id){
                var el = document.getElementById(id);
                if(!el) return;
                el.style.transition = 'all 120ms ease';
                el.addEventListener('mouseenter', function(){ el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 12px rgba(15,40,80,0.06)'; });
                el.addEventListener('mouseleave', function(){ el.style.transform = ''; el.style.boxShadow = ''; });
                el.addEventListener('focus', function(){ el.style.outline = '2px solid rgba(30,136,229,0.16)'; });
                el.addEventListener('blur', function(){ el.style.outline = ''; });
            });
        })();

        document.getElementById('um-inject-close').addEventListener('click', function(){ panel.style.display = 'none'; });

        document.getElementById('um-insert-content').addEventListener('click', function(){
            var c = document.getElementById('um-inject-content').value || '';
            insertContent(c);
        });
        // 已移除重复按钮：只保留插入文本与插入混合内容两项
        document.getElementById('um-insert-mixed').addEventListener('click', function(){
            var mixed = document.getElementById('um-inject-mixed').value || '';
            if(!mixed) return alert('混合内容为空');
            var id = detectEditorId();
            var ed = UM.getEditor(id) || UM.getEditor('myEditor');
            if(!ed) return alert('找不到编辑器实例');
            injectMixedContentToUM(ed, mixed);
        });

        // 内联确认：在清空按钮旁显示确认框（包含“确认 / 取消”），并在若干秒后自动隐藏
        (function(){
            var btn = document.getElementById('um-clear-editor');
            var box = document.getElementById('um-clear-confirm');
            var yes = document.getElementById('um-clear-confirm-yes');
            var no = document.getElementById('um-clear-confirm-no');
            var hideTimer = null;
            function restoreButton(){ try{ if(btn) btn.style.display = ''; }catch(e){} }
            function hideBox(){ if(!box) return; box.style.opacity = '0'; if(hideTimer){ clearTimeout(hideTimer); hideTimer = null; } // wait for transition end to set display none
                var onEnd = function(){ try{ box.style.display = 'none'; box.removeEventListener('transitionend', onEnd); }catch(e){} }; box.addEventListener('transitionend', onEnd);
                restoreButton(); }
            function showBox(){ if(!box) return; if(btn) btn.style.display = 'none'; box.style.display = 'inline-flex'; box.style.alignItems = 'center'; // ensure the browser registers the display change before opacity
                requestAnimationFrame(function(){ box.style.opacity = '1'; }); if(hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(hideBox, 6000); }
            if(!btn || !box || !yes || !no) return;
            btn.addEventListener('click', function(e){
                e.stopPropagation();
                if(box.style.display === 'inline-flex') hideBox(); else showBox();
            });
            no.addEventListener('click', function(e){ e.stopPropagation(); hideBox(); });
            yes.addEventListener('click', function(e){
                e.stopPropagation(); hideBox();
                try{
                    var id = detectEditorId();
                    var inst = getEditorInstanceById(id) || getEditorInstanceById('myEditor');
                    if(!inst || !inst.ed) return alert('找不到可访问的编辑器实例（可能在跨域 iframe 中）');
                    var ed = inst.ed;
                    if(typeof ed.setContent === 'function'){
                        ed.setContent('');
                    } else if(typeof ed.execCommand === 'function'){
                        ed.execCommand('inserthtml', '');
                    } else {
                        return alert('编辑器不支持清空操作');
                    }
                }catch(err){ console.error('clear editor failed', err); alert('清空失败: '+(err && err.message?err.message:err)); }
                // 操作完成后恢复按钮（hideBox 已调用）
            });
            // 点击页面其它区域时隐藏确认框并恢复按钮
            document.addEventListener('click', function(ev){ if(box && box.style.display === 'inline-flex'){ hideBox(); } });
        })();
    }

    // 如果面板存在，重新计算它的位置以确保在悬浮标上方
    function repositionPanelAboveHandle(){
        var panel = document.getElementById('um-inject-panel');
        var handle = document.getElementById('um-inject-handle');
        if(!panel || !handle) return;
        try{
            var hr = handle.getBoundingClientRect();
            var rightPx = Math.max(12, (window.innerWidth - hr.right) + 8);
            var bottomPx = Math.max(12, (window.innerHeight - hr.top) + 12);
            panel.style.right = rightPx + 'px';
            panel.style.bottom = bottomPx + 'px';
        }catch(e){/* ignore */}
    }

    window.addEventListener('resize', function(){ repositionPanelAboveHandle(); });

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
        try {
            var id = detectEditorId();
            var inst = getEditorInstanceById(id) || getEditorInstanceById('myEditor');
            if(!inst || !inst.ed) return alert('找不到可访问的编辑器实例（可能在跨域 iframe 中）');
            console.log('injectMixedContentToUM -> target id=', id, 'found at', inst.where, 'src=', inst.src||'');
            inst.ed.execCommand('inserthtml', html);
        }
        catch(e) { console.error('inserthtml failed', e); alert('插入失败: '+(e && e.message ? e.message : e)); }
    }

    function insertContent(html){
        try{
            var id = detectEditorId();
            var inst = getEditorInstanceById(id) || getEditorInstanceById('myEditor');
            if(!inst || !inst.ed) return alert('找不到可访问的编辑器实例（可能在跨域 iframe 中）');
            console.log('insertContent -> target id=', id, 'found at', inst.where, 'src=', inst.src||'');
            var ed = inst.ed;
            // 改为替换整个编辑器内容（覆盖），而不是在当前位置插入
            if (typeof ed.setContent === 'function') {
                ed.setContent(html);
            } else {
                // 回退到插入方式（老版本可能没有 setContent）
                ed.execCommand('inserthtml', html, true);
            }
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
            // 已移除独立 LaTeX 输入，改为聚焦混合输入框
            var mixedEl = document.getElementById('um-inject-mixed');
            if(mixedEl) mixedEl.focus();
        }
    }, false);

    // 初始化：等 UM 可用后创建面板（面板只在按热键时显示）
    waitForUM(function(){
        console.log('UM detected - UM Injector available (Ctrl+Alt+I)');
        // 提前不渲染 panel，等热键按下创建
        // 创建页面右下角的小悬浮标（显示简短域名），点击展开/收起面板
        try{
            createHandle();
        }catch(e){console.error('createHandle failed', e)}
    });

    function createHandle(){
        if(document.getElementById('um-inject-handle')) return;
        var h = document.createElement('div');
        h.id = 'um-inject-handle';
        h.style.position = 'fixed';
        h.style.right = '20px';
        h.style.bottom = '90px';
        // 更漂亮的样式：圆形按钮，悬停时展开显示完整域名
        h.style.width = '44px';
        h.style.height = '44px';
    h.style.borderRadius = '8px';
        h.style.background = 'linear-gradient(135deg,#1e88e5,#1976d2)';
        h.style.color = '#fff';
        h.style.display = 'flex';
        h.style.alignItems = 'center';
        h.style.justifyContent = 'center';
        h.style.boxShadow = '0 6px 20px rgba(25,118,210,0.24)';
        h.style.cursor = 'pointer';
        h.style.zIndex = 1000000;
        h.style.fontWeight = '700';
        h.style.fontSize = '13px';
        h.style.transition = 'width 180ms ease, padding 180ms ease, border-radius 180ms ease';
        h.title = 'UM Injector - 点击展开/收起面板';
        // host 用于悬停时显示
        var fullHost = window.location.hostname || 'site';
        // 默认显示简短标识 "UM"
        h.textContent = 'UM';
        // 点击切换面板
        h.addEventListener('click', function(){
            if(!document.getElementById('um-inject-panel')) createPanel();
            var p = document.getElementById('um-inject-panel');
            if(!p) return;
            p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
        });
        // 悬停展开显示完整域名
        h.addEventListener('mouseenter', function(){
            h.style.width = '170px';
            h.style.borderRadius = '8px';
            h.style.padding = '0 12px';
            h.style.justifyContent = 'flex-start';
            h.textContent = 'UM Injector — ' + fullHost.replace(/^www\./,'');
        });
        h.addEventListener('mouseleave', function(){
            h.style.width = '44px';
            h.style.borderRadius = '8px';
            h.style.padding = '';
            h.style.justifyContent = 'center';
            h.textContent = 'UM';
        });
        document.body.appendChild(h);
    }

})();
