// ==UserScript==
// @name         橙果错题助手
// @namespace    http://example.com/
// @version      9.1.0
// @updateURL    http://127.0.0.1:8000/scripts/um-inject.user.js
// @downloadURL  https://gh-proxy.com/https://raw.githubusercontent.com/wedone/umeditor/refs/heads/marked/scripts/um-inject.user.js
// @description  快速在页面中注入文本与 LaTeX 到 UMEditor（浮动面板，支持热键 Ctrl+Alt+I）
// @author       Generated
// @match        https://umeditor.vercel.app/*
// @match        https://www.91chengguo.com/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    // ========================================
    // 配置模块
    // ========================================

    /** 脚本版本号（从元数据中提取） */
    var SCRIPT_VERSION = '9.1.0';

    /** 调试模式：true 时输出详细日志，false 时只输出关键信息 */
    var DEBUG_MODE = false;

    /**
     * 图床配置
     * 使用 UAPIS.CN 免费图床服务
     */
    var IMAGE_HOST_CONFIG = {
        // 是否启用图床上传（false 则回退到 base64）
        enableUpload: true
    };

    /**
     * 公式图片尺寸控制配置
     * 
     * ✨ v9.0.6 新策略：高分辨率渲染 + CSS 缩小显示
     *    - 渲染：正常大小（1em）+ 2x 分辨率 → 清晰的大图
     *    - 显示：通过 width 属性缩小到 72% → 匹配官方尺寸
     *    - 优势：图片清晰 + 尺寸匹配
     * 
     * 参数说明：
     * - renderScale: html2canvas 的渲染倍率（2 = 2x 分辨率，Retina 屏幕标准）
     * - displayScale: 最终显示时的缩放比例（0.72 = 缩小到 72%）
     * - baseFontSize: KaTeX 渲染时的字体大小（1em = 正常大小）
     */
    var IMAGE_SIZE_CONFIG = {
        baseFontSize: '1em',     // ✨ KaTeX 渲染时使用正常字体大小
        renderScale: 2,          // ✨ html2canvas 渲染倍率（2x 清晰度）
        displayScale: 0.75,      // ✨ 最终显示时缩小到 72%（匹配官方）
        debugSize: false         // 是否在控制台输出尺寸调试信息
    };

    /**
     * KaTeX 渲染样式自定义配置
     * 
     * ✨ v9.0.8 优化：采用 HTML v6.6.8 的分数样式（更好的可读性，避免重叠）
     * 
     * 关键改进：
     * - 使用精确选择器 `.mfrac > span > span` 而不是 `.mfrac > .vlist-t .sizing`
     * - 分子分母字体从默认 0.7em 增大到 0.9em（避免挤在一起）
     * - 分数线粗细设为 0.08em（更清晰）
     */
    var KATEX_CUSTOM_STYLES = {
        enabled: true,  // ✨ 默认启用（使用 HTML 文件的优化样式）
        
        // ✨ 采用 HTML v6.6.8 的分数优化 CSS
        css: `
            /* v6.6.8 修正：调整 KaTeX 分数样式 - 使用更精确的选择器 */
            .katex .mfrac > span > span {
                font-size: 1.4em !important;  /* 调大分子分母字体 */
            }
            .katex .mfrac .frac-line {
                border-top-width: 0.08em !important;  /* 调整分数线粗细 */
            }
        `
    };

    /**
     * 主题颜色配置（基于橙果色 #ff6000 的暗色调整）
     */
    var THEME = {
        primary: '#9b3a00',        // 主色：深橙色
        primaryLight: '#b65a00',   // 浅主色：用于渐变
        shadow: 'rgba(155,58,0,0.22)',  // 阴影色
        focus: 'rgba(155,58,0,0.14)'    // 聚焦色
    };

    // ========================================
    // 工具函数模块
    // ========================================

    /**
     * 查找包含 MathQuill 的窗口（主窗口或 iframe）
     * @returns {{window: Window, jQuery: Object}|null} 返回包含 MathQuill 的窗口及其 jQuery 对象
     */
    function findMathQuillWindow(){
        // 检查主窗口
        if(window.jQuery && typeof window.jQuery.fn.mathquill === 'function'){
            if(DEBUG_MODE) console.log('🔍 MathQuill 找到：主窗口');
            return {window: window, jQuery: window.jQuery};
        }

        // 检查所有 iframe
        var iframes = document.getElementsByTagName('iframe');
        for(var i = 0; i < iframes.length; i++){
            try{
                var cw = iframes[i].contentWindow;
                if(cw && cw.jQuery && typeof cw.jQuery.fn.mathquill === 'function'){
                    if(DEBUG_MODE) console.log('🔍 MathQuill 找到：iframe', i);
                    return {window: cw, jQuery: cw.jQuery};
                }
            }catch(e){
                // 跨域 iframe，忽略
            }
        }
        return null;
    }

    /**
     * 剥离 LaTeX 定界符，返回纯 LaTeX 和显示模式标志
     * @param {string} token 带定界符的 LaTeX 字符串
     * @returns {{latex: string, isDisplay: boolean}}
     */
    function stripLatexDelimiters(token){
        var latex = token;
        var isDisplay = false;

        if(token.indexOf('$$') === 0 && token.lastIndexOf('$$') === token.length - 2){
            latex = token.slice(2, -2);
            isDisplay = true;
        }else if(token.indexOf('\\[') === 0 && token.slice(-2) === '\\]'){
            latex = token.slice(2, -2);
            isDisplay = true;
        }else if(token.indexOf('\\(') === 0 && token.slice(-2) === '\\)'){
            latex = token.slice(2, -2);
            isDisplay = false;
        }else if(token.indexOf('$') === 0 && token.slice(-1) === '$'){
            latex = token.slice(1, -1);
            isDisplay = false;
        }

        return {latex: latex.trim(), isDisplay: isDisplay};
    }

    /**
     * 计算 LaTeX 公式复杂度得分（基于符号权重和嵌套深度）
     * 
     * 评估方法：
     * 1. 符号权重分：统计高级结构符号（积分、分式、矩阵等），每种符号对应固定权重
     * 2. 嵌套深度分：计算 {} 的最大嵌套层数
     * 3. 综合得分 = 符号权重分 * 0.7 + 嵌套深度分 * 0.3
     * 
     * 判断逻辑：
     * - 得分 >= 4.0 → 复杂（用图片）
     * - 得分 < 4.0 → 简单（用 MathQuill）
     * 
     * @param {string} latex 纯 LaTeX 代码（不含定界符）
     * @returns {Object} {isSimple: boolean, score: number, details: Object}
     */
    function calculateComplexity(latex){
        if(!latex) return {isSimple: true, score: 0, details: {symbolScore: 0, depthScore: 0}};
        var s = String(latex).trim();
        if(s.length === 0) return {isSimple: true, score: 0, details: {symbolScore: 0, depthScore: 0}};

        // 1. 计算符号权重分
        var symbolScore = 0;
        var complexSymbols = [
            // 高复杂度符号（权重 4+）
            {regex: /\\begin\{matrix\}|\\begin\{pmatrix\}|\\begin\{bmatrix\}|\\begin\{vmatrix\}|\\begin\{array\}/g, weight: 5, name: '矩阵/数组'},
            {regex: /\\begin\{cases\}|\\begin\{aligned\}|\\begin\{align\}/g, weight: 5, name: '分段/对齐环境'},
            
            // 中高复杂度符号（权重 3-4）
            {regex: /\\int|\\iint|\\iiint|\\oint/g, weight: 3.5, name: '积分'},
            {regex: /\\sum|\\prod/g, weight: 3, name: '求和/乘积'},
            {regex: /\\lim|\\limsup|\\liminf/g, weight: 3, name: '极限'},
            {regex: /\\bigcup|\\bigcap|\\bigvee|\\bigwedge/g, weight: 3, name: '大运算符'},
            
            // 中复杂度符号（权重 2-3）
            {regex: /\\frac|\\dfrac|\\tfrac/g, weight: 2.5, name: '分式'},
            {regex: /\\sqrt|\\root/g, weight: 2, name: '根号'},
            {regex: /\\binom|\\choose/g, weight: 2.5, name: '组合数'},
            {regex: /\\forall|\\exists|\\nexists/g, weight: 2.5, name: '逻辑量词'},
            {regex: /\\left|\\right/g, weight: 2, name: '自适应括号'},
            
            // 低中复杂度符号（权重 1.5-2）
            {regex: /\\sin|\\cos|\\tan|\\cot|\\sec|\\csc/g, weight: 1.5, name: '三角函数'},
            {regex: /\\log|\\ln|\\lg|\\exp/g, weight: 1.5, name: '对数/指数函数'},
            {regex: /\\vec|\\overrightarrow|\\overleftarrow/g, weight: 1.8, name: '向量'},
            {regex: /\\dot|\\ddot|\\hat|\\tilde|\\bar/g, weight: 1.5, name: '上标符号'},
            {regex: /\\mathbb|\\mathcal|\\mathfrak|\\mathbf/g, weight: 1.5, name: '特殊字体'},
            
            // 低复杂度符号（权重 1）
            {regex: /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\phi|\\omega/gi, weight: 0.8, name: '希腊字母'},
            {regex: /\\in|\\notin|\\subset|\\subseteq|\\supset|\\supseteq/g, weight: 1, name: '集合符号'},
            {regex: /\\pm|\\mp|\\times|\\div|\\cdot/g, weight: 0.5, name: '基础运算符'}
        ];

        for(var i = 0; i < complexSymbols.length; i++){
            var matches = s.match(complexSymbols[i].regex);
            if(matches){
                var count = matches.length;
                var contribution = count * complexSymbols[i].weight;
                symbolScore += contribution;
                if(DEBUG_MODE) console.log('  � 符号匹配:', complexSymbols[i].name, '数量:', count, '权重:', complexSymbols[i].weight, '贡献:', contribution.toFixed(2));
            }
        }

        // 2. 计算嵌套深度分
        var currentDepth = 0;
        var maxDepth = 0;
        for(var j = 0; j < s.length; j++){
            var char = s.charAt(j);
            if(char === '{'){
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if(char === '}'){
                currentDepth = Math.max(currentDepth - 1, 0);
            }
        }
        var depthScore = maxDepth;

        // 3. 计算字符长度兜底分（避免漏判冗长但简单的公式）
        var lengthScore = s.length * 0.2; // 每个字符贡献 0.02 分

        // 4. 综合得分计算
        var finalScore = symbolScore * 0.7 + depthScore * 0.3 + lengthScore;

        // 5. 判断阈值（收紧：从 5.0 降低到 4.0，让更多公式走图片）
        var COMPLEXITY_THRESHOLD = 2.5;
        var isSimple = finalScore < COMPLEXITY_THRESHOLD;

        if(DEBUG_MODE){
            console.log('� 复杂度评估:', s.substring(0, 40), '...');
            console.log('  - 符号权重分:', symbolScore.toFixed(2));
            console.log('  - 嵌套深度分:', depthScore);
            console.log('  - 字符长度分:', lengthScore.toFixed(2));
            console.log('  - 综合得分:', finalScore.toFixed(2), '(阈值:', COMPLEXITY_THRESHOLD + ')');
            console.log('  - 判定结果:', isSimple ? '✅ 简单（MathQuill）' : '🔥 复杂（图片）');
        }

        return {
            isSimple: isSimple,
            score: finalScore,
            details: {
                symbolScore: symbolScore,
                depthScore: depthScore,
                lengthScore: lengthScore
            }
        };
    }

    /**
     * 判断 LaTeX 公式是否简单（适合 MathQuill 渲染）
     * 
     * 使用复杂度评估系统：
     * - 得分 >= 4.0 → 复杂（用图片）
     * - 得分 < 4.0 → 简单（用 MathQuill）
     * 
     * @param {string} latex 纯 LaTeX 代码（不含定界符）
     * @returns {boolean} true=简单（用 MathQuill），false=复杂（用图片）
     */
    function isSimpleFormula(latex){
        var result = calculateComplexity(latex);
        return result.isSimple;
    }

    /**
     * HTML 实体转义
     * @param {string} s
     * @returns {string}
     */
    function escapeHtml(s){
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 文本转 HTML 回退（简单换行处理）
     * @param {string} s
     * @returns {string}
     */
    function textToHtmlFallback(s){
        if(!s) return '';
        s = String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var tmp = escapeHtml(s);
        tmp = tmp.replace(/\n{2,}/g, '<br><br>');
        tmp = tmp.replace(/\n/g, '<br>');
        return tmp;
    }

    /**
     * 更新进度条显示
     * @param {number} progress 进度（0-100）
     * @param {string} message 进度消息
     */
    function updateProgress(progress, message){
        var progressEl = document.getElementById('um-inject-progress');
        var progressBar = document.getElementById('um-inject-progress-bar');
        var progressText = document.getElementById('um-progress-text');
        
        if(progressEl && progressBar && progressText){
            // 显示进度条区域
            if(progress > 0 && progress < 100){
                progressEl.style.display = 'block';
            } else if(progress >= 100){
                // 完成后延迟隐藏进度条
                setTimeout(function(){
                    progressEl.style.display = 'none';
                }, 1000);
            }
            
            // 更新进度条宽度
            progressBar.style.width = progress + '%';
            progressText.textContent = progress + '%';
            
            // 在调试模式下输出进度信息
            if(message && DEBUG_MODE){
                console.log('📊 进度:', progress + '%', message);
            }
        }
    }

    /**
     * 动态加载 marked 库
     * @returns {Promise<Object|null>}
     */
    function loadMarked(){
        return new Promise(function(resolve){
            if(window.marked) return resolve(window.marked);
            try{
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/marked@5.1.1/marked.min.js';
                s.onload = function(){ resolve(window.marked || null); };
                s.onerror = function(){ resolve(null); };
                document.head.appendChild(s);
            }catch(e){
                resolve(null);
            }
        });
    }

    /**
     * 动态加载 KaTeX 库
     * @returns {Promise<Object|null>}
     */
    function loadKaTeX(){
        return new Promise(function(resolve){
            if(window.katex) return resolve(window.katex);

            // 加载 KaTeX CSS
            if(!document.querySelector('link[href*="katex"]')){
                try{
                    var link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
                    document.head.appendChild(link);
                }catch(e){
                    console.warn('KaTeX CSS 加载失败', e);
                }
            }

            // 加载 KaTeX JS
            try{
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
                s.onload = function(){
                    console.log('✅ KaTeX 加载成功');
                    resolve(window.katex || null);
                };
                s.onerror = function(){
                    console.warn('⚠️ KaTeX 加载失败');
                    resolve(null);
                };
                document.head.appendChild(s);
            }catch(e){
                console.warn('KaTeX 脚本加载异常', e);
                resolve(null);
            }
        });
    }

    /**
     * 动态加载 html2canvas 库
     * @returns {Promise<Object|null>}
     */
    function loadHtml2Canvas(){
        return new Promise(function(resolve){
            if(window.html2canvas) return resolve(window.html2canvas);
            try{
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = function(){
                    console.log('✅ html2canvas 加载成功');
                    resolve(window.html2canvas || null);
                };
                s.onerror = function(){
                    console.warn('⚠️ html2canvas 加载失败');
                    resolve(null);
                };
                document.head.appendChild(s);
            }catch(e){
                console.warn('html2canvas 脚本加载异常', e);
                resolve(null);
            }
        });
    }

    /**
     * 上传 base64 图片到 UAPIS.CN 图床
     *
     * @param {string} base64Data base64 图片数据（包含 data:image/png;base64, 前缀）
     * @returns {Promise<string|null>} 返回图片 URL，失败返回 null
     */
    async function uploadBase64ToImageHost(base64Data){
        if(!base64Data || !IMAGE_HOST_CONFIG.enableUpload){
            return null;
        }

        try{
            console.log('📤 上传图片到 UAPIS.CN ...');

            var response = await fetch('https://uapis.cn/api/v1/image/frombase64', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData: base64Data
                })
            });

            if(!response.ok){
                throw new Error('HTTP ' + response.status);
            }

            var result = await response.json();

            // 响应格式：{ code: 200, image_url: "https://...", msg: "success" }
            if(result && result.code === 200 && result.image_url){
                console.log('✅ 上传成功:', result.image_url);
                return result.image_url;
            }else{
                var errMsg = result && result.msg ? result.msg : '未知错误';
                throw new Error('上传失败: ' + errMsg);
            }

        }catch(e){
            console.error('❌ UAPIS.CN 上传失败:', e.message || e);
            return null;
        }
    }


    /**
     * 使用 KaTeX + html2canvas 将公式渲染为图片并上传到图床
     * 
     * ✨ 尺寸控制策略（详见 docs/FORMULA_IMAGE_SIZING.md）：
     *    通过 baseFontSize 在渲染时就控制公式大小，而非事后缩放
     *    优势：图片清晰 + 尺寸精确
     * 
     * @param {string} latex 纯 LaTeX 代码（不含定界符）
     * @param {boolean} isDisplay 是否为显示模式（块级公式）
     * @returns {Promise<Object|null>} 返回 {url, width, height} 或 null
     */
    async function renderFormulaToImage(latex, isDisplay){
        try{
            // 1. 加载依赖库
            var katex = window.katex || await loadKaTeX();
            var html2canvas = window.html2canvas || await loadHtml2Canvas();

            if(!katex || !html2canvas){
                console.warn('KaTeX 或 html2canvas 未加载，跳过图片渲染');
                return null;
            }

            // 2. 创建临时容器
            var container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            
            // ✨ 关键：设置基础字体大小（使用配置项）
            // 在 KaTeX 渲染时就控制尺寸，而非事后缩放（保持清晰度）
            container.style.fontSize = IMAGE_SIZE_CONFIG.baseFontSize || '0.8em';
            
            container.style.background = 'transparent';
            document.body.appendChild(container);

            // 3. 使用 KaTeX 渲染（简化配置，不需要 macros）
            try{
                katex.render(latex, container, {
                    displayMode: isDisplay,
                    throwOnError: false,
                    strict: false,        // ✨ 非严格模式，支持更多 LaTeX 命令
                    trust: true           // ✨ 信任模式，允许 HTML 和扩展功能
                });
                
                // ✨ 应用自定义样式（如果启用）
                if(KATEX_CUSTOM_STYLES.enabled && KATEX_CUSTOM_STYLES.css){
                    var styleId = 'katex-custom-styles-' + Date.now();
                    var styleEl = document.createElement('style');
                    styleEl.id = styleId;
                    styleEl.textContent = KATEX_CUSTOM_STYLES.css;
                    document.head.appendChild(styleEl);
                    
                    // 记录 style 元素，稍后清理
                    container.setAttribute('data-style-id', styleId);
                }
            }catch(e){
                console.warn('KaTeX 渲染失败:', e.message);
                document.body.removeChild(container);
                return null;
            }

            // 4. 检查渲染结果是否为空
            if(!container.textContent || container.textContent.trim().length === 0){
                console.warn('KaTeX 渲染结果为空');
                document.body.removeChild(container);
                return null;
            }

            // 5. 等待字体加载（KaTeX 字体可能需要时间）
            await new Promise(function(resolve){ setTimeout(resolve, 100); });

            // 6. 转换为 base64 图片
            var canvas = null;
            var dataUrl = null;
            var originalWidth = 0;
            var originalHeight = 0;
            try{
                // 获取容器尺寸（已经是正确尺寸，无需缩放）
                originalWidth = container.offsetWidth;
                originalHeight = container.offsetHeight;

                // 调试输出
                if(IMAGE_SIZE_CONFIG.debugSize || DEBUG_MODE){
                    console.log('📐 公式尺寸:', {
                        latex: latex.substring(0, 30),
                        isDisplay: isDisplay,
                        baseFontSize: IMAGE_SIZE_CONFIG.baseFontSize,
                        宽度: originalWidth + 'px',
                        高度: originalHeight + 'px'
                    });
                }

                // 使用橙果官方 html2canvas 配置 + 高分辨率渲染
                canvas = await html2canvas(container, {
                    scale: IMAGE_SIZE_CONFIG.renderScale || 2,  // ✨ 2x 分辨率渲染（清晰）
                    backgroundColor: 'transparent',
                    logging: false,
                    allowTaint: true,
                    taintTest: false
                });

                if(canvas){
                    dataUrl = canvas.toDataURL('image/png');
                }
            }catch(e){
                console.warn('html2canvas 转换失败:', e.message);
                document.body.removeChild(container);
                return null;
            }

            // 7. 清理临时容器和样式
            var styleId = container.getAttribute('data-style-id');
            if(styleId){
                var styleEl = document.getElementById(styleId);
                if(styleEl){
                    document.head.removeChild(styleEl);
                }
            }
            document.body.removeChild(container);

            if(!dataUrl){
                console.warn('生成 base64 数据失败');
                return null;
            }

            // 8. 上传到图床获取公网链接
            var filename = 'katex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.png';
            var imageUrl = await uploadBase64ToImageHost(dataUrl, filename);

            if(imageUrl){
                if(DEBUG_MODE){
                    console.log('✅ 公式渲染并上传成功:', latex.substring(0, 30), '→', imageUrl);
                }
                
                // ✨ 应用显示缩放比例（高分辨率图片，缩小显示）
                var displayWidth = Math.round(originalWidth * (IMAGE_SIZE_CONFIG.displayScale || 0.72));
                var displayHeight = Math.round(originalHeight * (IMAGE_SIZE_CONFIG.displayScale || 0.72));
                
                // 返回带尺寸信息的对象
                return {
                    url: imageUrl,
                    width: displayWidth,   // ✨ 缩小后的显示宽度
                    height: displayHeight  // ✨ 缩小后的显示高度
                };
            }else{
                console.warn('⚠️ 图片上传失败，将使用 base64（可能导致保存问题）');
                
                // ✨ base64 回退也应用缩放
                var displayWidth = Math.round(originalWidth * (IMAGE_SIZE_CONFIG.displayScale || 0.72));
                var displayHeight = Math.round(originalHeight * (IMAGE_SIZE_CONFIG.displayScale || 0.72));
                
                // base64 回退也返回对象格式
                return {
                    url: dataUrl,
                    width: displayWidth,
                    height: displayHeight
                };
            }

        }catch(e){
            console.error('renderFormulaToImage 异常:', e);
            return null;
        }
    }

    /**
     * 检测页面中可用的编辑器 ID
     * 策略：
     * 1. 收集常见占位元素（script[type="text/plain"], textarea, div 等）
     * 2. 过滤掉面板本身的 DOM
     * 3. 优先验证能否通过 getEditorInstanceById 获取可用实例
     * 4. 回退到首个候选 ID 或 'myEditor'
     *
     * @returns {string} 编辑器 ID
     */
    function detectEditorId(){
        var panel = document.getElementById('um-inject-panel');

        /**
         * 判断节点是否在面板内部
         * @param {HTMLElement} node
         * @returns {boolean}
         */
        function insidePanel(node){
            try{
                return !!(panel && node && node.closest && node.closest('#um-inject-panel'));
            }catch(e){
                return false;
            }
        }

        var seen = {};
        var candidates = [];

        /**
         * 添加候选 ID（去重且排除面板内元素）
         * @param {string} id
         */
        function pushId(id){
            if(!id || seen[id]) return;
            seen[id] = true;
            candidates.push(id);
        }

        // 1) 常见占位元素（script[type="text/plain"], textarea, div, contenteditable）
        var elems = document.querySelectorAll('script[type="text/plain"], textarea, div, [contenteditable="true"]');
        Array.prototype.forEach.call(elems, function(node){
            if(insidePanel(node)) return;
            if(node.id) pushId(node.id);
            if(node.getAttribute && node.getAttribute('name')) pushId(node.getAttribute('name'));
        });

        // 2) 具有编辑器特征的 class/id 命名元素
        var hintRegex = /(?:um|ue|editor|edui|ueditor|cgeditor|cgEditor|content|question|answer)/i;
        var allWithId = document.querySelectorAll('[id]');
        Array.prototype.forEach.call(allWithId, function(node){
            if(insidePanel(node)) return;
            var id = node.id;
            if(!id) return;
            if(hintRegex.test(id) || hintRegex.test(node.className || '') || hintRegex.test(node.getAttribute('name')||'')){
                pushId(id);
            }
        });

        // 3) 显式标识 data-editor-id
        var dataNodes = document.querySelectorAll('[data-editor-id]');
        Array.prototype.forEach.call(dataNodes, function(n){
            if(insidePanel(n)) return;
            if(n.id) pushId(n.id);
            var v = n.getAttribute('data-editor-id');
            if(v) pushId(v);
        });

        // 4) 回退：首个非面板的 script/textarea/容器
        var fallback = Array.prototype.slice.call(
            document.querySelectorAll('script[type="text/plain"], textarea, div.edui-editor-container, .edui-editor')
        ).filter(function(node){ return !insidePanel(node); })[0];
        if(fallback && fallback.id) pushId(fallback.id);

        // 逐个验证候选 ID 是否能获取可用的编辑器实例
        for(var i=0; i<candidates.length; i++){
            try{
                var id = candidates[i];
                var inst = getEditorInstanceById(id);
                if(inst && inst.ed){
                    console.log('detectEditorId -> verified accessible editor id=', id, 'at', inst.where, inst.src||'');
                    return id;
                }
            }catch(e){
                // 忽略并继续
            }
        }

        // 如果没有可验证的实例，返回首个候选或默认值
        return candidates.length > 0 ? candidates[0] : 'myEditor';
    }

    /**
     * 等待 UM 编辑器库加载完成
     * @param {Function} cb 回调函数
     */
    function waitForUM(cb){
        var timer = setInterval(function(){
            if(window.UM && typeof UM.getEditor === 'function'){
                clearInterval(timer);
                cb();
            }
        }, 200);
        // 15 秒超时
        setTimeout(function(){ clearInterval(timer); }, 15000);
    }

    /**
     * 根据 ID 在当前 window 或同源 iframe 中获取 UM 编辑器实例
     * 支持跨 iframe 查找（同源限制）
     *
     * @param {string} id 编辑器 ID
     * @returns {Object|null} {ed: 编辑器实例, win: 所在 window, where: 'top'|'iframe', src: iframe源}
     */
    function getEditorInstanceById(id){
        // 优先在当前 window 中查找
        try{
            if(window.UM && typeof window.UM.getEditor === 'function'){
                var ed = window.UM.getEditor(id);
                if(ed) return {ed: ed, win: window, where: 'top'};
            }
        }catch(e){
            // 忽略错误
        }

        // 在同源 iframe 中查找
        var iframes = document.getElementsByTagName('iframe');
        for(var i=0; i<iframes.length; i++){
            var fr = iframes[i];
            try{
                var cw = fr.contentWindow;
                if(!cw) continue;
                if(cw.UM && typeof cw.UM.getEditor === 'function'){
                    var ed2 = cw.UM.getEditor(id);
                    if(ed2){
                        return {
                            ed: ed2,
                            win: cw,
                            where: 'iframe',
                            src: fr.src || fr.getAttribute('data-src') || fr.id || ''
                        };
                    }
                }
            }catch(e){
                // 跨域访问被拒绝，跳过
            }
        }
        return null;
    }

    /**
     * 处理粘贴到 textarea 的逻辑（先清空，再从剪贴板读取）
     * 支持多种剪贴板访问方式，兼容权限策略限制
     *
     * @param {HTMLTextAreaElement} textarea 目标文本框
     */
    function handlePasteToTextarea(textarea){
        if(!textarea) return alert('找不到输入框');

        // 清空输入框
        try{ textarea.value = ''; }catch(e){}

        /**
         * 方法 1: 尝试使用 Clipboard API（可能被权限策略阻止）
         */
        function tryClipboardAPI(){
            if(!navigator.clipboard || typeof navigator.clipboard.readText !== 'function'){
                return Promise.reject(new Error('Clipboard API 不可用'));
            }

            return navigator.clipboard.readText()
                .then(function(text){
                    textarea.value = text;
                    return true;
                })
                .catch(function(err){
                    // 被权限策略阻止或用户拒绝
                    console.warn('Clipboard API 失败:', err.message || err);
                    return Promise.reject(err);
                });
        }

        /**
         * 方法 2: 使用 execCommand('paste') + paste 事件监听（兼容性更好）
         */
        function tryExecCommandPaste(){
            return new Promise(function(resolve, reject){
                var handled = false;

                // 监听 paste 事件
                var onPaste = function(e){
                    handled = true;
                    textarea.removeEventListener('paste', onPaste);

                    try{
                        var clipboardData = e.clipboardData || window.clipboardData;
                        if(clipboardData){
                            var text = clipboardData.getData('text/plain') || clipboardData.getData('text');
                            if(text){
                                e.preventDefault();
                                textarea.value = text;
                                resolve(true);
                                return;
                            }
                        }
                    }catch(err){
                        console.warn('paste 事件处理失败:', err);
                    }

                    reject(new Error('无法从 paste 事件获取数据'));
                };

                textarea.addEventListener('paste', onPaste);
                textarea.focus();

                // 尝试触发粘贴
                try{
                    var success = document.execCommand('paste');
                    if(!success){
                        textarea.removeEventListener('paste', onPaste);
                        reject(new Error('execCommand paste 失败'));
                    }else{
                        // 等待事件触发
                        setTimeout(function(){
                            textarea.removeEventListener('paste', onPaste);
                            if(!handled){
                                reject(new Error('paste 事件未触发'));
                            }
                        }, 500);
                    }
                }catch(err){
                    textarea.removeEventListener('paste', onPaste);
                    reject(err);
                }
            });
        }

        /**
         * 方法 3: 回退到 prompt 手动粘贴
         */
        function fallbackToPrompt(){
            try{
                var text = window.prompt('剪贴板访问受限，请手动粘贴内容（Ctrl+V）：') || '';
                textarea.value = text;
                return Promise.resolve(true);
            }catch(e){
                textarea.value = '';
                return Promise.reject(e);
            }
        }

        // 依次尝试各种方法
        tryClipboardAPI()
            .catch(function(){
                // Clipboard API 失败，尝试 execCommand
                return tryExecCommandPaste();
            })
            .catch(function(){
                // execCommand 也失败，回退到 prompt
                return fallbackToPrompt();
            })
            .catch(function(err){
                console.error('所有粘贴方法均失败:', err);
                alert('粘贴失败，请手动复制内容到输入框');
            });
    }

    // ========================================
    // UI 模块
    // ========================================

    /**
     * 创建浮动面板 DOM 结构
     * 面板包含混合输入框、Markdown 开关、插入/粘贴/清空按钮
     */
    function createPanel(){
        if(document.getElementById('um-inject-panel')) return;

        var panel = document.createElement('div');
        panel.id = 'um-inject-panel';
        panel.style.position = 'fixed';
        panel.style.width = '480px';
        panel.style.zIndex = 999999;
        panel.style.background = 'rgba(255,255,255,0.98)';
        panel.style.border = '1px solid rgba(0,0,0,0.08)';
        panel.style.padding = '0';
        panel.style.boxShadow = '0 10px 30px rgba(12,30,80,0.12)';
        panel.style.fontFamily = 'Helvetica, Arial, sans-serif';
        panel.style.borderRadius = '10px';
        panel.style.overflow = 'hidden';

        // 如果悬浮标存在，将面板定位在其上方
        var handle = document.getElementById('um-inject-handle');
        if(handle){
            try{
                var hr = handle.getBoundingClientRect();
                var rightPx = Math.max(8, Math.round(window.innerWidth - hr.right));
                var bottomPx = Math.max(12, Math.round((window.innerHeight - hr.top) + 10));
                panel.style.right = rightPx + 'px';
                panel.style.bottom = bottomPx + 'px';
            }catch(e){
                panel.style.right = '20px';
                panel.style.bottom = '20px';
            }
        }else{
            panel.style.right = '20px';
            panel.style.bottom = '20px';
        }

        // 面板 HTML 结构
        panel.innerHTML = `
            <div id="um-inject-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(90deg,#b65a00,#9b3a00);color:#fff;">
                <div style="display:flex;align-items:center;gap:10px">
                    <div id="um-inject-badge" style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">🍊</div>
                    <strong style="font-size:14px;letter-spacing:0.2px">橙果错题助手</strong>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.75);font-family:Menlo,Consolas,monospace">v${SCRIPT_VERSION}</span>
                    <button id="um-inject-close" aria-label="关闭面板" style="background:transparent;border:none;color:rgba(255,255,255,0.9);font-size:12px;cursor:pointer;padding:6px 8px;border-radius:6px">✕</button>
                </div>
            </div>
            <div style="padding:12px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,252,0.98));">
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <label style="font-size:12px;color:#444;display:block;margin-bottom:6px">文本+LaTeX混合（支持 $...$ / $$...$$ / \\(...\\) / \\[...\\]）</label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#333;margin-left:6px">
                            <input id="um-enable-markdown" type="checkbox" style="width:14px;height:14px;vertical-align:middle">
                            <span style="font-size:13px">支持 MarkDown</span>
                        </label>
                    </div>
                    <textarea id="um-inject-mixed" style="width:100%;height:180px;border:1px solid rgba(0,0,0,0.06);padding:8px;border-radius:6px;resize:vertical;font-family:Menlo,Consolas,monospace;font-size:13px"></textarea>
                </div>
                
                <!-- 进度条区域 -->
                <div id="um-inject-progress" style="display:none;margin:8px 0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:12px;color:#666;">处理进度</span>
                        <span id="um-progress-text" style="font-size:11px;color:#999;font-family:Menlo,Consolas,monospace">0%</span>
                    </div>
                    <div style="width:100%;height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;">
                        <div id="um-inject-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#b65a00,#9b3a00);border-radius:3px;transition:width 0.3s ease;"></div>
                    </div>
                </div>
                
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px">
                    <div style="display:flex;align-items:center">
                        <button id="um-clear-editor" aria-label="清空编辑器" style="background:#ff4d4f;color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">清空编辑器</button>
                        <span id="um-clear-confirm" style="display:none;opacity:0;margin-left:8px;padding:6px;border-radius:6px;background:#fff;border:1px solid #eee;box-shadow:0 6px 12px rgba(0,0,0,0.06);font-size:12px;align-items:center;transition:opacity 180ms ease;">
                            <span style="margin-right:8px;color:#333">确定清空？</span>
                            <button id="um-clear-confirm-yes" aria-label="确认清空" style="background:#ff4d4f;color:#fff;border:none;padding:6px 10px;border-radius:6px;margin-right:6px;cursor:pointer">确认</button>
                            <button id="um-clear-confirm-no" aria-label="取消清空" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">取消</button>
                        </span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button id="um-paste-content" aria-label="从剪贴板粘贴" style="background:linear-gradient(180deg,#fff8e6,#fff1d6);border:1px solid rgba(0,0,0,0.06);padding:8px 10px;border-radius:6px;cursor:pointer">粘贴</button>
                        <button id="um-insert-mixed" aria-label="插入混合内容" style="background:linear-gradient(180deg,#b65a00,#9b3a00);color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">插入混合内容</button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(panel);

        // 应用主题颜色
        applyThemeToPanel();

        // 注入全局样式（border-box 修正）
        injectPanelStyles();

        // 绑定事件
        bindPanelEvents();
    }

    /**
     * 应用主题颜色到面板关键元素
     */
    function applyThemeToPanel(){
        try{
            var hdr = document.getElementById('um-inject-header');
            if(hdr) hdr.style.background = 'linear-gradient(90deg,'+THEME.primaryLight+','+THEME.primary+')';

            var insertBtn = document.getElementById('um-insert-mixed');
            if(insertBtn) insertBtn.style.background = 'linear-gradient(180deg,'+THEME.primaryLight+','+THEME.primary+')';

            var clearBtn = document.getElementById('um-clear-editor');
            if(clearBtn) clearBtn.style.background = THEME.primary;

            var clearYes = document.getElementById('um-clear-confirm-yes');
            if(clearYes) clearYes.style.background = THEME.primary;
        }catch(e){
            // 忽略样式错误
        }
    }

    /**
     * 注入面板全局样式（避免 box-sizing 问题）
     */
    function injectPanelStyles(){
        try{
            var style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(
                '\n#um-inject-panel, #um-inject-panel * { box-sizing: border-box; }\n' +
                '#um-inject-panel textarea { max-width: 100%; width: 100%; }\n' +
                '#um-inject-panel button { min-width: 0; }\n'
            ));
            document.head.appendChild(style);
        }catch(e){
            // 忽略
        }
    }

    /**
     * 绑定面板按钮和交互事件
     */
    function bindPanelEvents(){
        // 关闭按钮
        document.getElementById('um-inject-close').addEventListener('click', function(){
            document.getElementById('um-inject-panel').style.display = 'none';
        });

        // 粘贴按钮
        var pasteBtn = document.getElementById('um-paste-content');
        if(pasteBtn){
            pasteBtn.addEventListener('click', function(){
                var ta = document.getElementById('um-inject-mixed');
                handlePasteToTextarea(ta);
            });
        }

        // 插入混合内容按钮
        document.getElementById('um-insert-mixed').addEventListener('click', function(){
            var mixed = document.getElementById('um-inject-mixed').value || '';
            if(!mixed) return alert('混合内容为空');

            var id = detectEditorId();
            var ed = UM.getEditor(id) || UM.getEditor('myEditor');
            if(!ed) return alert('找不到编辑器实例');

            // 直接插入（不需要预加载，MathQuill 会在渲染 span 时自动加载）
            injectMixedContentToUM(ed, mixed);
        });

        // 清空编辑器逻辑（内联确认）
        createClearConfirmLogic();

        // 按钮 hover 和 focus 美化
        enhanceButtonInteractions();
    }

    /**
     * 创建清空编辑器的确认逻辑（内联确认框）
     */
    function createClearConfirmLogic(){
        var btn = document.getElementById('um-clear-editor');
        var box = document.getElementById('um-clear-confirm');
        var yes = document.getElementById('um-clear-confirm-yes');
        var no = document.getElementById('um-clear-confirm-no');

        if(!btn || !box || !yes || !no) return;

        var hideTimer = null;

        function restoreButton(){
            try{ if(btn) btn.style.display = ''; }catch(e){}
        }

        function hideBox(){
            if(!box) return;
            box.style.opacity = '0';
            if(hideTimer){
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            // 等待过渡动画结束后隐藏
            var onEnd = function(){
                try{
                    box.style.display = 'none';
                    box.removeEventListener('transitionend', onEnd);
                }catch(e){}
            };
            box.addEventListener('transitionend', onEnd);
            restoreButton();
        }

        function showBox(){
            if(!box) return;
            if(btn) btn.style.display = 'none';
            box.style.display = 'inline-flex';
            box.style.alignItems = 'center';
            // 确保浏览器注册 display 变化后再改变 opacity
            requestAnimationFrame(function(){
                box.style.opacity = '1';
            });
            if(hideTimer) clearTimeout(hideTimer);
            // 6 秒后自动隐藏
            hideTimer = setTimeout(hideBox, 6000);
        }

        // 清空按钮点击
        btn.addEventListener('click', function(e){
            e.stopPropagation();
            if(box.style.display === 'inline-flex'){
                hideBox();
            }else{
                showBox();
            }
        });

        // 取消按钮
        no.addEventListener('click', function(e){
            e.stopPropagation();
            hideBox();
        });

        // 确认按钮
        yes.addEventListener('click', function(e){
            e.stopPropagation();
            hideBox();

            try{
                var id = detectEditorId();
                var inst = getEditorInstanceById(id) || getEditorInstanceById('myEditor');
                if(!inst || !inst.ed){
                    return alert('找不到可访问的编辑器实例（可能在跨域 iframe 中）');
                }

                var ed = inst.ed;
                if(typeof ed.setContent === 'function'){
                    ed.setContent('');
                }else if(typeof ed.execCommand === 'function'){
                    ed.execCommand('inserthtml', '');
                }else{
                    return alert('编辑器不支持清空操作');
                }
            }catch(err){
                console.error('clear editor failed', err);
                alert('清空失败: ' + (err && err.message ? err.message : err));
            }
        });

        // 点击页面其它区域时隐藏确认框
        document.addEventListener('click', function(ev){
            if(box && box.style.display === 'inline-flex'){
                hideBox();
            }
        });
    }

    /**
     * 增强按钮交互效果（hover 和 focus 样式）
     */
    function enhanceButtonInteractions(){
        var ids = ['um-inject-close', 'um-clear-editor', 'um-clear-confirm-yes', 'um-clear-confirm-no', 'um-insert-mixed'];
        ids.forEach(function(id){
            var el = document.getElementById(id);
            if(!el) return;

            el.style.transition = 'all 120ms ease';
            el.addEventListener('mouseenter', function(){
                el.style.transform = 'translateY(-1px)';
                el.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)';
            });
            el.addEventListener('mouseleave', function(){
                el.style.transform = '';
                el.style.boxShadow = '';
            });
            el.addEventListener('focus', function(){
                el.style.outline = '2px solid ' + THEME.focus;
            });
            el.addEventListener('blur', function(){
                el.style.outline = '';
            });
        });
    }

    /**
     * 重新计算面板位置（确保在悬浮标上方）
     */
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
        }catch(e){
            // 忽略
        }
    }

    /**
     * 创建页面右下角的悬浮标（点击展开/收起面板）
     */
    function createHandle(){
        if(document.getElementById('um-inject-handle')) return;

        var h = document.createElement('div');
        h.id = 'um-inject-handle';
        h.style.position = 'fixed';
        h.style.right = '20px';
        h.style.bottom = '20px';
        h.style.width = '44px';
        h.style.height = '44px';
        h.style.borderRadius = '8px';
        h.style.background = 'linear-gradient(135deg,' + THEME.primaryLight + ',' + THEME.primary + ')';
        h.style.color = '#fff';
        h.style.display = 'flex';
        h.style.alignItems = 'center';
        h.style.justifyContent = 'center';
        h.style.boxShadow = '0 6px 20px ' + THEME.shadow;
        h.style.cursor = 'pointer';
        h.style.zIndex = 1000000;
        h.style.fontWeight = '700';
        h.style.fontSize = '13px';
        h.style.transition = 'width 180ms ease, padding 180ms ease, border-radius 180ms ease';
        h.title = '橙果错题助手 - 点击展开/收起面板';
        h.textContent = '🍊';

        var fullHost = window.location.hostname || 'site';

        // 点击切换面板
        h.addEventListener('click', function(){
            if(!document.getElementById('um-inject-panel')) createPanel();
            var p = document.getElementById('um-inject-panel');
            if(!p) return;
            p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
        });

        // 按下时视觉反馈
        h.addEventListener('mousedown', function(){
            h.style.transform = 'scale(0.96)';
            h.style.boxShadow = '0 4px 14px ' + THEME.shadow;
        });
        document.addEventListener('mouseup', function(){
            h.style.transform = '';
            h.style.boxShadow = '0 6px 20px ' + THEME.shadow;
        });

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

    // ========================================
    // 核心处理模块
    // ========================================

    /**
     * 对 LaTeX 代码进行归一化处理（适配 MathQuill 渲染）
     *
     * 处理项：
     * - 单字母 \mathbb{X} -> \X
     * - 竖线 | -> \mid
     * - 压缩多余空白
     * - 处理 mhchem 的 \ce{...}
     * - \xlongequal{...} -> =
     *
     * @param {string} latex 原始 LaTeX 代码
     * @returns {string} 归一化后的 LaTeX
     */
    function normalizeLatexForMathQuill(latex){
        if(!latex) return latex;
        var s = String(latex);

        // 花括号处理（将自适应定界符还原为普通花括号）
        s = s.replace(/\\left\\\{/g, '\\{').replace(/\\right\\\}/g, '\\}');
        // 花括号处理（避免在某些环境下使用 \left/\right 导致空白渲染）
        s = s.replace(/\\\{/g, '\\left\\{').replace(/\\\}/g, '\\right\\}');

        // 单字母 \mathbb{X} -> \X（兼容 AI 输出）
        s = s.replace(/\\mathbb\{\s*([A-Za-z])\s*\}/g, function(_, ch){
            return '\\' + ch;
        });

    // \complement 映射（补集符号）
    s = s.replace(/\\complement(?=[_\s{]|$)/g, '{∁}');

    // 将常见的 \not\... / 标准 LaTeX 名称直接替换为单个 Unicode 符号，
    // 以避免在后续 MathQuill 解析中被拆分为 "\\not" + "其他符号"
    // 顺序从长到短匹配以防止部分匹配（例如先匹配 subsetneqq 再匹配 subseteq/subset）
    // 对应关系：仅使用标准 LaTeX 名称替换为 Unicode（不保留 \not\... 形式）
    // 按表格整理的 LaTeX -> Unicode 替换（从长到短顺序，以避免部分匹配）
    // 1) 真子集 / 真超集（严格，不等于）
    // \varsubsetneqq, \varsubsetneq, \subsetneqq, \subsetneq -> ⊊ (U+228A)
    s = s.replace(/\\varsubsetneqq(?=[_\s{]|$)/g, '\u228A');
    s = s.replace(/\\varsubsetneq(?=[_\s{]|$)/g, '\u228A');
    s = s.replace(/\\subsetneqq(?=[_\s{]|$)/g, '⫋');
    s = s.replace(/\\subsetneq(?=[_\s{]|$)/g, '⊊');
    // \varsupsetneqq, \varsupsetneq, \supsetneqq, \supsetneq -> ⊋ (U+228B)
    s = s.replace(/\\varsupsetneqq(?=[_\s{]|$)/g, '\u228B');
    s = s.replace(/\\varsupsetneq(?=[_\s{]|$)/g, '\u228B');
    s = s.replace(/\\supsetneqq(?=[_\s{]|$)/g, '⫌');
    s = s.replace(/\\supsetneq(?=[_\s{]|$)/g, '⊋');

    // 2) 普通子集 / 超集
    // \sqsubseteq -> ⊑ (U+2291)
    s = s.replace(/\\sqsubseteq(?=[_\s{]|$)/g, '\u2291');
    // \sqsupseteq -> ⊒ (U+2292)
    s = s.replace(/\\sqsupseteq(?=[_\s{]|$)/g, '\u2292');
    // \subseteq -> ⊆ (U+2286)
    s = s.replace(/\\subseteq(?=[_\s{]|$)/g, '\u2286');
    // \supseteq -> ⊇ (U+2287)
    s = s.replace(/\\supseteq(?=[_\s{]|$)/g, '\u2287');
    // \subset -> ⊂ (U+2282)
    s = s.replace(/\\subset(?=[_\s{]|$)/g, '\u2282');
    // \supset -> ⊃ (U+2283)
    s = s.replace(/\\supset(?=[_\s{]|$)/g, '\u2283');

    // 3) 非关系 / 否定（标准命令）
    // \nsubseteq -> ⊈ (U+2288)
    s = s.replace(/\\nsubseteq(?=[_\s{]|$)/g, '\u2288');
    // \nsupseteq -> ⊉ (U+2289)
    s = s.replace(/\\nsupseteq(?=[_\s{]|$)/g, '\u2289');
    // \nsubset -> ⊄ (U+2284)
    s = s.replace(/\\nsubset(?=[_\s{]|$)/g, '\u2284');
    // \nsupset -> ⊅ (U+2285)
    s = s.replace(/\\nsupset(?=[_\s{]|$)/g, '\u2285');
    // \notin -> ∉ (U+2209)
    s = s.replace(/\\notin(?=[_\s{]|$)/g, '\u2209');
    // \not\ni (用户可能输入) -> ∌ (U+220C) 但按你要求不保留 \not\... 形式；这里保留 \nni 形式映射
    s = s.replace(/\\nni(?=[_\s{]|$)/g, '\u220C');

    // 其他日常使用中错误渲染替换
        
    // 将 \sup 转为 \text{sup } 以便 MathQuill 正确显示
    s = s.replace(/\\sup/g, '\\text{sup }');
    // 将 \triangle 转为 \bigtriangleup 以便 MathQuill 正确显示三角形符号
    s = s.replace(/\\triangle(?=[_\s{]|$)/g, '\\bigtriangleup');
    // 竖线替换
    //s = s.replace(/\|/g, '\\mid');
    // 压缩连续空白
    s = s.replace(/\s{2,}/g, ' ');



        return s;
    }

    /**
     * 注入混合内容到 UMEditor
     *
     * 流程：
     * 1. 单公式快速路径：若整个输入是单个公式，根据复杂度决定渲染方式
     * 2. 混合内容路径：
     *    a. 用占位符保护 LaTeX 片段
     *    b. 根据 Markdown 开关决定是否用 marked 解析
     *    c. 将占位符替换为公式 HTML（复杂→图片，简单→MathQuill）
     *    d. 插入到编辑器
     *
     * @param {Object} editor UMEditor 实例
     * @param {string} mixedText 混合内容（文本 + LaTeX）
     */
    async function injectMixedContentToUM(editor, mixedText){
        if(!editor || !editor.execCommand){
            console.error('editor not found or invalid');
            return;
        }

        // 初始化进度条
        updateProgress(0, '开始处理内容...');

        // ========== 步骤 1：单公式快速路径 ==========
        try{
            var whole = String(mixedText || '').trim();
            var fullRe = /^(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\$]+\$)$/;
            var mFull = whole.match(fullRe);

            if(mFull){
                updateProgress(10, '检测到单公式，正在分析复杂度...');
                var token = mFull[1];
                var stripped = stripLatexDelimiters(token);
                var normalizedWhole = normalizeLatexForMathQuill(stripped.latex);

                // 判断公式复杂度
                var isSimple = isSimpleFormula(stripped.latex);

                if (!isSimple) {
                    // 复杂公式：直接渲染为图片
                    console.log('🔍 单公式（复杂）→ 渲染为图片');
                    updateProgress(20, '复杂公式，准备渲染为图片...');
                    // 不使用 MathQuill，跳到混合内容路径处理
                } else {
                    // 简单公式：尝试 MathQuill 渲染
                    console.log('🔍 单公式（简单）→ 尝试 MathQuill');
                    updateProgress(20, '简单公式，尝试 MathQuill 渲染...');
                    try{
                        var inst = getEditorInstanceById(detectEditorId()) || getEditorInstanceById('myEditor');
                        if(inst && inst.win){
                            try{
                                var cw = inst.win;
                                // UMEditor 使用 jQuery 插件版本的 MathQuill
                                var $ = cw.jQuery || cw.$;

                                if($ && typeof $.fn.mathquill === 'function'){
                                    var temp = cw.document.createElement('span');
                                    temp.className = 'mq-temp-for-insert';
                                    temp.style.position = 'absolute';
                                    temp.style.left = '-9999px';
                                    temp.style.visibility = 'hidden';
                                    cw.document.body.appendChild(temp);

                                    // 使用 jQuery 插件接口渲染
                                    var $temp = $(temp);
                                    $temp.mathquill();
                                    $temp.mathquill('latex', normalizedWhole);

                                    var outer = temp.outerHTML;
                                    temp.parentNode && temp.parentNode.removeChild(temp);

                                    var targetInst = getEditorInstanceById(detectEditorId()) || getEditorInstanceById('myEditor');
                                    if(targetInst && targetInst.ed && typeof targetInst.ed.execCommand === 'function'){
                                        updateProgress(100, '单公式插入完成');
                                        targetInst.ed.execCommand('inserthtml', outer);
                                        return;
                                    }
                                }
                            }catch(innerErr){
                                console.warn('MathQuill jQuery plugin render failed or unavailable in target window', innerErr);
                            }
                        }

                        // 回退到 execCommand('formula')
                        if(typeof editor.execCommand === 'function'){
                            updateProgress(100, '单公式插入完成');
                            editor.execCommand('formula', normalizedWhole);
                            return;
                        }
                    }catch(err){
                        console.warn('execCommand formula failed, falling back to HTML insert', err);
                    }
                }
            }
        }catch(e){
            // 忽略并继续到混合内容路径
        }

        // ========== 步骤 2：混合内容路径 ==========

        updateProgress(15, '分析混合内容...');

        // 2a. 用占位符保护 LaTeX 片段
        var latexRe = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\$]+\$)/g;
        var tokens = [];
        var counter = 0;
        var withPlaceholders = String(mixedText || '').replace(latexRe, function(m){
            var id = counter++;
            tokens.push({raw: m, id: id});
            return '@@UM_LATEX_' + id + '@@';
        });

        // 2a-2. 判断公式复杂度（简单→MathQuill，复杂→图片）
        var complexTokens = [];  // 需要渲染为图片的复杂公式
        if (tokens.length > 0) {
            console.log('🔍 开始判断', tokens.length, '个公式的复杂度...');
            updateProgress(20, '分析 ' + tokens.length + ' 个公式的复杂度...');

            for (var i = 0; i < tokens.length; i++) {
                var tkn = tokens[i].raw;
                var stripped = stripLatexDelimiters(tkn);
                var isSimple = isSimpleFormula(stripped.latex);

                if (!isSimple) {
                    // 复杂公式：标记为需要渲染为图片
                    complexTokens.push({
                        index: i + 1,
                        id: tokens[i].id,
                        raw: tkn,
                        latex: stripped.latex,
                        isDisplay: stripped.isDisplay
                    });
                }
            }

            console.log('🔍 复杂度判断完成，复杂公式数量:', complexTokens.length);
        }

        // 2a-3. 输出判断结果
        if (complexTokens.length > 0) {
            console.info('�', complexTokens.length, '个复杂公式将渲染为图片（快速、稳定）');
        }
        if (tokens.length - complexTokens.length > 0) {
            console.info('�', (tokens.length - complexTokens.length), '个简单公式将使用 MathQuill（可编辑）');
        }

        // 2b. 根据复选框决定是否启用 Markdown
        var enableMd = true;
        try{
            var cb = document.getElementById('um-enable-markdown');
            enableMd = !!(cb && cb.checked);
        }catch(e){
            enableMd = true;
        }

        var html = '';
        if(enableMd){
            // 使用 marked 解析 Markdown
            var mdParser = window.marked || null;
            if(!mdParser){
                mdParser = await loadMarked();
            }

            try{
                // Ensure single newlines are treated as <br> (GitHub-style line breaks)
                try{
                    if(mdParser && typeof mdParser.setOptions === 'function'){
                        mdParser.setOptions({ gfm: true, breaks: true });
                    } else if(mdParser && mdParser.defaults){
                        mdParser.defaults = mdParser.defaults || {};
                        mdParser.defaults.gfm = true;
                        mdParser.defaults.breaks = true;
                    }
                }catch(e){
                    // ignore options set failure
                }

                if(mdParser && typeof mdParser === 'function'){
                    // marked v4+ exports a function; prefer explicit parse when available
                    if(typeof mdParser.parse === 'function') html = mdParser.parse(withPlaceholders);
                    else html = mdParser(withPlaceholders);
                }else if(mdParser && mdParser.parse){
                    html = mdParser.parse(withPlaceholders);
                }else{
                    html = textToHtmlFallback(withPlaceholders);
                }
            }catch(e){
                console.warn('marked parse failed, falling back', e);
                html = textToHtmlFallback(withPlaceholders);
            }
        }else{
            // 不启用 Markdown：转义并保留占位符
            var PLACE_IN = '\uFFF0';
            var PLACE_OUT = '\uFFF1';
            var tmp = withPlaceholders.replace(/@@UM_LATEX_(\d+)@@/g, function(_, n){
                return PLACE_IN + 'UM_LATEX_' + n + PLACE_OUT;
            });
            tmp = escapeHtml(tmp);
            tmp = tmp.replace(new RegExp(PLACE_IN + 'UM_LATEX_(\\d+)' + PLACE_OUT, 'g'), function(_, n){
                return '@@UM_LATEX_' + n + '@@';
            });
            tmp = tmp.replace(/\n/g, '<br>');
            html = tmp;
        }

        // 2c. HTML 后处理：h1-h6 -> p + strong
        try{
            html = html.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, function(_, inner){
                return '<p><strong>' + inner + '</strong></p>';
            });
        }catch(e){
            // 忽略
        }

        // 2d. 将占位符替换为公式 HTML（复杂公式渲染为图片，简单公式使用 MathQuill）
        // 使用 for 循环 + await 确保顺序处理（避免并发导致的问题）
        if (tokens.length > 0) {
            updateProgress(30, '开始渲染 ' + tokens.length + ' 个公式...');
        }
        
        for(var i=0; i<tokens.length; i++){
            // 使用 IIFE 创建独立作用域，避免闭包捕获问题
            await (async function(index){
                var tkn = tokens[index].raw;
                var tokenId = tokens[index].id;

                // 更新进度
                var progress = 30 + Math.floor((index / tokens.length) * 60);
                updateProgress(progress, '渲染公式 ' + (index+1) + '/' + tokens.length + '...');

                // 检查该公式是否为复杂公式
                var isComplex = false;
                for(var j=0; j<complexTokens.length; j++){
                    if(complexTokens[j].id === tokenId){
                        isComplex = true;
                        break;
                    }
                }

                var repl;
                if(isComplex){
                    // 复杂公式：用 KaTeX 渲染为图片并上传
                    var stripped = stripLatexDelimiters(tkn);
                    var imgResult = await renderFormulaToImage(stripped.latex, stripped.isDisplay);

                    if(imgResult && imgResult.url){
                        // 成功获取图片 URL（可能是公网链接或 base64）
                        // ✨ 使用橙果官方格式：<img class="cg-math-formula" width="XXXpx" src="...">
                        // 不设置 height，让浏览器和后端自动按比例显示
                        var imgTag = '<img class="cg-math-formula" width="' + imgResult.width + 'px" src="' + imgResult.url + '" />';
                        repl = stripped.isDisplay ? '<div style="text-align:center;margin:10px 0;">' + imgTag + '</div>' : imgTag;
                        console.log('✅ 公式', index+1, '已渲染为图片（橙果格式，宽度 ' + imgResult.width + 'px）');
                    }else{
                        // 图片渲染失败：回退到纯文本（带定界符）
                        repl = escapeHtml(tkn);
                        console.warn('⚠️ 公式', index+1, '渲染为图片失败，输出纯文本');
                    }
                }else{
                    // 简单公式：正常输出 MathQuill HTML（可编辑）
                    var stripped = stripLatexDelimiters(tkn);
                    var normalized = normalizeLatexForMathQuill(stripped.latex);
                    var span = '<span class="mathquill-embedded-latex">' + escapeHtml(normalized) + '</span>';
                    repl = stripped.isDisplay ? '<div class="math-display">' + span + '</div>' : span;
                }

                // 立即替换当前占位符（避免延迟替换导致的变量污染）
                html = html.split('@@UM_LATEX_' + index + '@@').join(repl);
            })(i); // 传递当前索引，创建独立作用域
        }

        // 2e. 插入到编辑器
        try{
            updateProgress(95, '准备插入到编辑器...');
            
            var id = detectEditorId();
            var inst = getEditorInstanceById(id) || getEditorInstanceById('myEditor');
            if(!inst || !inst.ed){
                updateProgress(0, '');
                return alert('找不到可访问的编辑器实例（可能在跨域 iframe 中）');
            }

            console.log('injectMixedContentToUM -> target id=', id, 'found at', inst.where, 'src=', inst.src || '');
            inst.ed.execCommand('inserthtml', html);
            
            updateProgress(100, '内容插入完成！');

        }catch(e){
            console.error('inserthtml failed', e);
            updateProgress(0, '');
            alert('插入失败: ' + (e && e.message ? e.message : e));
        }
    }

    // ========================================
    // 初始化模块
    // ========================================

    /**
     * 监听热键 Ctrl+Alt+I 打开/切换面板
     */
    document.addEventListener('keydown', function(e){
        if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'i'){
            e.preventDefault();
            if(!document.getElementById('um-inject-panel')){
                createPanel();
            }
            var panel = document.getElementById('um-inject-panel');
            panel.style.display = 'block';

            var mixedEl = document.getElementById('um-inject-mixed');
            if(mixedEl) mixedEl.focus();
        }
    }, false);

    /**
     * 监听窗口大小变化，重新定位面板
     */
    window.addEventListener('resize', function(){
        repositionPanelAboveHandle();
    });

    /**
     * 等待 UM 加载完成后初始化
     */
    waitForUM(function(){
        console.log('UM detected - UM Injector available (Ctrl+Alt+I)');
        try{
            createHandle();
        }catch(e){
            console.error('createHandle failed', e);
        }
    });

})();
