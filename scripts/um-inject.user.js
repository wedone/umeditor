// ==UserScript==
// @name         橙果错题助手
// @namespace    http://example.com/
// @version      2025.10.14.00003
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

    // 主题颜色配置（基于 橙果 色 #ff6000）
    var THEME = {
        // 更暗的主题色，降低明度以减少刺眼感
        primary: '#9b3a00',    // 更沉稳的深橙
        primaryLight: '#b65a00',
        // shadow / focus 使用更深色的 rgba
        shadow: 'rgba(155,58,0,0.22)',
        focus: 'rgba(155,58,0,0.14)'
    };

    // 更鲁棒地检测编辑器 id：在实际目标站点上会有多种占位形式
    // - 先收集几类常见占位元素（script[type="text/plain"], textarea, div, contenteditable 等）
    // - 过滤掉面板本身的 DOM
    // - 优先尝试用 getEditorInstanceById 验证该 id 是否能取到可用的 UM 实例
    // - 如果都没找到可验证的实例，回退到首个候选 id 或 'myEditor'
    function detectEditorId(){
        var panel = document.getElementById('um-inject-panel');
        function insidePanel(node){ try{ return !!(panel && node && node.closest && node.closest('#um-inject-panel')); }catch(e){ return false; } }

        var seen = {};
        var candidates = [];

        // helper to push candidate id if valid and not from panel
        function pushId(id){ if(!id) return; if(seen[id]) return; seen[id]=true; candidates.push(id); }

        // 1) 常见占位元素（有 id 的）
        var elems = document.querySelectorAll('script[type="text/plain"], textarea, div, [contenteditable="true"]');
        Array.prototype.forEach.call(elems, function(node){ if(insidePanel(node)) return; if(node.id) pushId(node.id); if(node.getAttribute && node.getAttribute('name')) pushId(node.getAttribute('name')); });

        // 2) edui / ueditor / umeditor 等 class/id 命名的元素
        var hintRegex = /(?:um|ue|editor|edui|ueditor|cgeditor|cgEditor|content|question|answer)/i;
        var allWithId = document.querySelectorAll('[id]');
        Array.prototype.forEach.call(allWithId, function(node){ if(insidePanel(node)) return; var id = node.id; if(!id) return; if(hintRegex.test(id) || hintRegex.test(node.className || '') || hintRegex.test(node.getAttribute('name')||'')) pushId(id); });

        // 3) data-editor-id 或其它显式标识
        var dataNodes = document.querySelectorAll('[data-editor-id]');
        Array.prototype.forEach.call(dataNodes, function(n){ if(insidePanel(n)) return; if(n.id) pushId(n.id); var v = n.getAttribute('data-editor-id'); if(v) pushId(v); });

        // 4) 最后再尝试一些通用回退：第一个非面板的 script[type=text/plain] 或 textarea
        var fallback = Array.prototype.slice.call(document.querySelectorAll('script[type="text/plain"], textarea, div.edui-editor-container, .edui-editor')).filter(function(node){ return !insidePanel(node); })[0];
        if(fallback && fallback.id) pushId(fallback.id);

        // 尝试逐个 candidate，用 getEditorInstanceById 验证可访问性（跨 iframe 支持）
        for(var i=0;i<candidates.length;i++){
            try{
                var id = candidates[i];
                var inst = getEditorInstanceById(id);
                if(inst && inst.ed) {
                    console.log('detectEditorId -> verified accessible editor id=', id, ' at ', inst.where, inst.src||'');
                    return id;
                }
            }catch(e){ /* ignore and continue */ }
        }

        // 如果没有可验证的实例，仍返回第一个候选 id（可能页面上会在稍后初始化 UM）
        if(candidates.length>0) return candidates[0];
        // 最终回退
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
                // 让面板的右侧与悬浮标的右侧精确对齐（去掉额外偏移）
                var rightPx = Math.max(8, Math.round(window.innerWidth - hr.right));
                // 计算面板底部：基于 handle.top 的位置并稍微增加垂直间距，使整体更靠下
                var bottomPx = Math.max(12, Math.round((window.innerHeight - hr.top) + 10));
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
            <div id="um-inject-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(90deg,#b65a00,#9b3a00);color:#fff;">\
                <div style="display:flex;align-items:center;gap:10px">\
                    <div id="um-inject-badge" style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">🍊</div>\
                    <strong style="font-size:14px;letter-spacing:0.2px">橙果错题助手</strong>\
                </div>\
                <button id="um-inject-close" aria-label="关闭面板" style="background:transparent;border:none;color:rgba(255,255,255,0.9);font-size:12px;cursor:pointer;padding:6px 8px;border-radius:6px">✕</button>\
            </div>\
            <div style="padding:12px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,252,0.98));">\
                <div>\
                    <label style="font-size:12px;color:#444;display:block;margin-bottom:6px">文本+LaTeX混合（支持 $...$ / $$...$$ / \\(...\\) / \\[...\\]）</label>\
                    <textarea id="um-inject-mixed" style="width:100%;height:180px;border:1px solid rgba(0,0,0,0.06);padding:8px;border-radius:6px;resize:vertical;font-family:Menlo,Consolas,monospace;font-size:13px"></textarea>\
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
                        <button id="um-insert-mixed" aria-label="插入混合内容" style="background:linear-gradient(180deg,#b65a00,#9b3a00);color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">插入混合内容</button>\
                    </div>\
                </div>\
            </div>';

        document.body.appendChild(panel);

        // 使用 THEME 统一面板中关键元素的颜色（避免大量内联字符串替换）
        try{
            var hdr = document.getElementById('um-inject-header');
            if(hdr) hdr.style.background = 'linear-gradient(90deg,'+THEME.primaryLight+','+THEME.primary+')';
            var insertBtn = document.getElementById('um-insert-mixed');
            if(insertBtn) insertBtn.style.background = 'linear-gradient(180deg,'+THEME.primaryLight+','+THEME.primary+')';
            var clearBtn = document.getElementById('um-clear-editor');
            if(clearBtn) clearBtn.style.background = THEME.primary;
            var clearYes = document.getElementById('um-clear-confirm-yes');
            if(clearYes) clearYes.style.background = THEME.primary;
        }catch(e){/* ignore styling errors */}

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
            var ids = ['um-inject-close','um-clear-editor','um-clear-confirm-yes','um-clear-confirm-no','um-insert-mixed'];
            ids.forEach(function(id){
                var el = document.getElementById(id);
                if(!el) return;
                el.style.transition = 'all 120ms ease';
                el.addEventListener('mouseenter', function(){ el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; });
                el.addEventListener('mouseleave', function(){ el.style.transform = ''; el.style.boxShadow = ''; });
                el.addEventListener('focus', function(){ el.style.outline = '2px solid '+THEME.focus; });
                el.addEventListener('blur', function(){ el.style.outline = ''; });
            });
        })();

        document.getElementById('um-inject-close').addEventListener('click', function(){ panel.style.display = 'none'; });

        // 已移除预览和单独插入文本按钮：只保留插入混合内容一项
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
            var rightPx = Math.max(8, Math.round(window.innerWidth - hr.right));
            var bottomPx = Math.max(12, Math.round((window.innerHeight - hr.top) + 24));
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
        // 预定义单字符 mathbb 映射（提前应用以覆盖后续替换导致的匹配失败）
        var mathbbMap = {
            'N': '\u2115', // ℕ
            'Z': '\u2124', // ℤ
            'Q': '\u211A', // ℚ
            'R': '\u211D', // ℝ
            'C': '\u2102', // ℂ
            'H': '\u210D', // ℍ
            'P': '\u2119'  // ℙ
        };
        // 提取为 helper，统一处理多种可能的变体（普通大括号、转义的大括号、\left\{...\right\}、以及已经被替换为 \lbrace/\rbrace 的情况）
        function applyMathbbMap(str){
            if(!str) return str;
            return String(str)
                // 最常见的形式：\mathbb{X}
                .replace(/\\mathbb\s*\{([A-Za-z])\}/g, function(_, ch){ return mathbbMap.hasOwnProperty(ch) ? mathbbMap[ch] : ('\\mathbb{' + ch + '}'); })
                // 有时写成不带空格的 \mathbb{X}
                .replace(/\\mathbb\{([A-Za-z])\}/g, function(_, ch){ return mathbbMap.hasOwnProperty(ch) ? mathbbMap[ch] : ('\\mathbb{' + ch + '}'); })
                // 转义的大括号形式： \\{ X \\}
                .replace(/\\mathbb\s*\\\\\{\s*([A-Za-z])\s*\\\\\}/g, function(_, ch){ return mathbbMap.hasOwnProperty(ch) ? mathbbMap[ch] : ('\\mathbb{' + ch + '}'); })
                // \mathbb\left\{X\right\}
                .replace(/\\mathbb\s*\\left\\\{\s*([A-Za-z])\s*\\right\\\}/g, function(_, ch){ return mathbbMap.hasOwnProperty(ch) ? mathbbMap[ch] : ('\\mathbb{' + ch + '}'); })
                // 已被替换为 \lbrace / \rbrace 的情况
                .replace(/\\mathbb\s*\\lbrace\s*([A-Za-z])\s*\\rbrace/g, function(_, ch){ return mathbbMap.hasOwnProperty(ch) ? mathbbMap[ch] : ('\\mathbb{' + ch + '}'); });
        }
        // 先做一次替换，避免后续对大括号的改写干扰匹配
        s = applyMathbbMap(s);
        s = s.replace(/\\\{\s*([^{}]+?)\s*\\\}/g, function(_, inner){ return '\\left\\{' + inner + '\\right\\}'; });
        s = s.replace(/\\left\\\{/g, '<<LEFTLBRACE>>').replace(/\\right\\\}/g, '<<RIGHTRBRACE>>');
        s = s.replace(/\|/g, '\\mid');
        s = s.replace(/\\\{/g, '\\lbrace').replace(/\\\}/g, '\\rbrace');
        s = s.replace(/<<LEFTLBRACE>>/g, '\\left\\{').replace(/<<RIGHTRBRACE>>/g, '\\right\\}');
        s = s.replace(/\s{2,}/g, ' ');
    // MathQuill 对 \mathbb 的支持是有限的，但项目中已有对常见集合的映射。
    // 之前为了稳定渲染把所有 \mathbb{...} 降级为 \mathrm{...}，
    // 这会导致像 "\\mathbb{Z}" 这样的常见符号被错误降级为普通体。
    // 先注释掉全局降级，保留这段作为说明，方便后续回退或做更细粒度的降级：
    // s = s.replace(/\\mathbb\{([^}]+?)\}/g, function(_, inner){ return '\\mathrm{' + inner + '}'; });
        // （之前在这里做第二次替换以保证在其它替换之后仍能命中）
        // 对于多数情况上面的 applyMathbbMap 已足够覆盖常见变体，保留这条注释以说明设计初衷。
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
        // 如果整个输入就是一个单独的公式 token（行内或显示），优先使用编辑器的公式命令插入。
        try{
            var whole = String(mixedText || '').trim();
            var fullRe = /^(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\$]+\$)$/;
            var mFull = whole.match(fullRe);
            if(mFull){
                var token = mFull[1];
                var latex = token;
                if (token.startsWith('$$') && token.endsWith('$$')) { latex = token.slice(2, -2); }
                else if (token.indexOf('\\[') === 0 && token.slice(-2) === '\\]') { latex = token.slice(2, -2); }
                else if (token.indexOf('\\(') === 0 && token.slice(-2) === '\\)') { latex = token.slice(2, -2); }
                else if (token.indexOf('$') === 0 && token.slice(-1) === '$') { latex = token.slice(1, -1); }
                latex = latex.trim();
                var normalizedWhole = normalizeLatexForMathQuill(latex);
                try{
                    // 优先调用官方命令，若成功返回
                    if(typeof editor.execCommand === 'function'){
                        editor.execCommand('formula', normalizedWhole);
                        return;
                    }
                }catch(err){
                    console.warn('execCommand formula failed, falling back to HTML insert', err);
                }
            }
        }catch(e){ /* ignore and continue to fallback */ }
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
    // 整体向下移动悬浮标位置
    h.style.bottom = '20px';
        // 更漂亮的样式：圆形按钮，悬停时展开显示完整域名
        h.style.width = '44px';
        h.style.height = '44px';
    h.style.borderRadius = '8px';
    h.style.background = 'linear-gradient(135deg,'+THEME.primaryLight+','+THEME.primary+')';
    h.style.color = '#fff';
        h.style.display = 'flex';
        h.style.alignItems = 'center';
        h.style.justifyContent = 'center';
    h.style.boxShadow = '0 6px 20px '+THEME.shadow;
        h.style.cursor = 'pointer';
        h.style.zIndex = 1000000;
        h.style.fontWeight = '700';
        h.style.fontSize = '13px';
        h.style.transition = 'width 180ms ease, padding 180ms ease, border-radius 180ms ease';
        h.title = '橙果错题助手 - 点击展开/收起面板';
        // host 用于悬停时显示
        var fullHost = window.location.hostname || 'site';
    // 默认显示简短标识 emoji
    h.textContent = '🍊';
        // 点击切换面板
        h.addEventListener('click', function(){
            if(!document.getElementById('um-inject-panel')) createPanel();
            var p = document.getElementById('um-inject-panel');
            if(!p) return;
            p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
        });
        // active visual: 按下时微缩并减弱阴影
        h.addEventListener('mousedown', function(){ h.style.transform = 'scale(0.96)'; h.style.boxShadow = '0 4px 14px '+THEME.shadow; });
        document.addEventListener('mouseup', function(){ h.style.transform = ''; h.style.boxShadow = '0 6px 20px '+THEME.shadow; });
        // 悬停展开显示完整域名
        h.addEventListener('mouseenter', function(){
            h.style.width = '170px';
            h.style.borderRadius = '8px';
            h.style.padding = '0 12px';
            h.style.justifyContent = 'flex-start';
            h.textContent = '橙果错题助手 — ' + fullHost.replace(/^www\./,'');
        });
        h.addEventListener('mouseleave', function(){
            h.style.width = '44px';
            h.style.borderRadius = '8px';
            h.style.padding = '';
            h.style.justifyContent = 'center';
            h.textContent = '🍊';
        });
        document.body.appendChild(h);
    }

})();
