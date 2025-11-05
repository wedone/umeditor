// ==UserScript==
// @name         橙果错题本编辑助手（PC接口版）
// @namespace    http://tampermonkey.net/
// @version      5.2.3
// @description  橙果错题本编辑工具，使用官方PC接口，精准替换原编辑器iframe，支持LaTeX预览
// @author       You
// @match        https://ctb.91chengguo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      www.91chengguo.com
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 动态加载KaTeX CSS
    function loadKatexCSS() {
        if (document.querySelector('link[href*="katex"]')) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        document.head.appendChild(link);
    }

    // LaTeX到橙果HTML转换函数
    function convertLatexToOrangeHtml(text) {
        if (!text) return text;

        let result = text;

        // 处理行内公式：$...$
        result = result.replace(/\$([^$]+)\$/g, function(match, formula) {
            return '<span class="CgTex">$' + formula + '$</span>';
        });

        // 处理行内公式：\(...\)
        result = result.replace(/\\\(([^]+?)\\\)/g, function(match, formula) {
            return '<span class="CgTex">$' + formula + '$</span>';
        });

        // 处理行间公式：$$...$$
        result = result.replace(/\$\$([^$]+)\$\$/g, function(match, formula) {
            return '<div><span class="CgTex">' + formula + '</span></div>';
        });

        // 处理行间公式：\[...\]
        result = result.replace(/\\\[([^]+?)\\\]/g, function(match, formula) {
            return '<div><span class="CgTex">' + formula + '</span></div>';
        });

        // 处理图片：将[图片:base64编码的完整HTML]还原为原始img标签
        result = result.replace(/\[图片:(.+?)\]/g, function(match, base64) {
            try {
                // 解码base64，还原完整的img标签
                const originalImg = decodeURIComponent(escape(atob(base64)));
                return originalImg;
            } catch (e) {
                console.error('图片解码失败:', e);
                // 如果解码失败，尝试回退到简单的URL处理
                return `<img src="${base64}" style="max-width: 100%; height: auto;">`;
            }
        });

        // 处理换行符：将\n转换为<br>（用于橙果HTML显示）
        result = result.replace(/\n/g, '<br>');

        return result;
    }

    // 橙果HTML到LaTeX转换函数
    function convertOrangeHtmlToLatex(html) {
        if (!html) return html;

        let result = html;

        // 首先过滤掉所有的\n（橙果中\n被忽略）
        result = result.replace(/\n/g, '');

        // 处理图片：将完整的img标签转换为[图片:完整HTML]格式
        result = result.replace(/<img[^>]+>/gi, function(match) {
            // 使用base64编码保存完整的img标签，避免与文本内容冲突
            const base64 = btoa(unescape(encodeURIComponent(match)));
            return `[图片:${base64}]`;
        });

        // 处理橙果的行内公式
        result = result.replace(/<span class="CgTex">\$(.*?)\$<\/span>/g, function(match, formula) {
            return '$' + formula + '$';
        });

        // 处理没有美元符号的CgTex元素
        result = result.replace(/<span class="CgTex">(.*?)<\/span>/g, function(match, formula) {
            return '$' + formula + '$';
        });

        // 处理橙果的行间公式
        result = result.replace(/<div><span class="CgTex">(.*?)<\/span><\/div>/g, function(match, formula) {
            return '$$' + formula + '$$';
        });

        // 处理换行符：将<br>转换为\n（用于脚本界面显示）
        result = result.replace(/<br\s*\/?>/gi, '\n');
        result = result.replace(/<br>/gi, '\n');

        // 清理其他HTML标签但保留内容（注意：图片已经转换为标记，不会被清理）
        result = result.replace(/<[^>]+>/g, '');

        // 解码HTML实体
        const textarea = document.createElement('textarea');
        textarea.innerHTML = result;
        result = textarea.value;

        return result;
    }

    // 使用KaTeX渲染内容，保持原排版
    function renderWithKaTeX(element, content) {
        if (!element || !content) return;

        // 保持原内容的换行和排版
        let formattedContent = content;

        // 处理图片：将[图片:base64编码的完整HTML]转换为img标签用于预览
        formattedContent = formattedContent.replace(/\[图片:(.+?)\]/g, function(match, base64) {
            try {
                // 解码base64，还原完整的img标签
                const originalImg = decodeURIComponent(escape(atob(base64)));
                return originalImg;
            } catch (e) {
                console.error('预览图片解码失败:', e);
                // 如果解码失败，尝试回退到简单的URL处理
                return `<img src="${base64}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;">`;
            }
        });

        // 处理换行符：将\n转换为<br>（用于HTML预览显示）
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        // 保留空格
        formattedContent = formattedContent.replace(/ /g, '&nbsp;');

        element.innerHTML = formattedContent;

        if (window.renderMathInElement) {
            try {
                renderMathInElement(element, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false,
                    output: 'html'
                });
            } catch (e) {
                console.warn('KaTeX渲染失败:', e);
            }
        }
    }

    // 获取登录token
    function getLoginToken() {
        const cookieToken = document.cookie.match(/loginToken=([^;]+)/)?.[1];
        if (cookieToken) return cookieToken;
        return null;
    }

    // 从当前URL获取题目ID
    function getProblemIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/edit\/(\d+)/);
        return match ? match[1] : null;
    }

    // 使用橙果官方的PC接口保存编辑内容
    function saveEditedTextUsingPCApi(problemId, newText, newAnswerText, callback) {
        const loginToken = getLoginToken();
        if (!loginToken) {
            callback({ success: false, error: '未找到登录token' });
            return;
        }

        // 转换LaTeX格式为HTML
        const convertedNewText = convertLatexToOrangeHtml(newText);
        const convertedNewAnswerText = convertLatexToOrangeHtml(newAnswerText);

        console.log('原始题目内容:', newText);
        console.log('转换后题目内容:', convertedNewText);
        console.log('原始答案内容:', newAnswerText);
        console.log('转换后答案内容:', convertedNewAnswerText);

        // 构建PC接口参数 - 使用service和param格式
        const pcSendUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
        
        const params = {
            service: 'com.orange.note.problem.save.editedtext',
            param: JSON.stringify({
                loginToken: loginToken,
                problemId: problemId,
                newText: convertedNewText,
                newAnswerText: convertedNewAnswerText,
                noCache: true
            })
        };

        console.log('PC接口保存请求参数:', params);

        // 构建表单数据
        const formData = new URLSearchParams();
        for (const key in params) {
            formData.append(key, params[key]);
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: pcSendUrl,
            data: formData.toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://ctb.91chengguo.com",
                "Referer": "https://ctb.91chengguo.com/",
            },
            onload: function(response) {
                console.log('PC接口保存响应:', response.responseText);

                try {
                    const result = JSON.parse(response.responseText);
                    if (callback) callback(result);
                } catch (e) {
                    console.error('JSON解析错误:', e);
                    console.error('响应内容:', response.responseText);
                    if (callback) callback({ success: false, error: 'JSON解析失败' });
                }
            },
            onerror: function(error) {
                console.error('请求失败:', error);
                if (callback) callback({ success: false, error: '网络请求失败' });
            }
        });
    }

    // 刷新题目详情（使用PC接口）
    function refreshProblemDetailUsingPCApi(problemId, callback) {
        const loginToken = getLoginToken();
        if (!loginToken) {
            callback({ success: false, error: '未找到登录token' });
            return;
        }

        // 构建PC接口参数
        const pcSendUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
        
        const params = {
            service: 'com.orange.note.problem.rematch.text',
            param: JSON.stringify({
                loginToken: loginToken,
                problemId: problemId
            })
        };

        console.log('PC接口刷新请求参数:', params);

        // 构建表单数据
        const formData = new URLSearchParams();
        for (const key in params) {
            formData.append(key, params[key]);
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: pcSendUrl,
            data: formData.toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://ctb.91chengguo.com",
                "Referer": "https://ctb.91chengguo.com/",
            },
            onload: function(response) {
                console.log('PC接口刷新响应:', response.responseText);
                try {
                    const result = JSON.parse(response.responseText);
                    if (callback) callback(result);
                } catch (e) {
                    console.error('JSON解析错误:', e);
                    if (callback) callback({ success: false, error: 'JSON解析失败' });
                }
            },
            onerror: function(error) {
                console.error('请求失败:', error);
                if (callback) callback({ success: false, error: '网络请求失败' });
            }
        });
    }

    // 完整的编辑流程 - 使用PC接口
    function editProblem(problemId, newText, newAnswerText) {
        // 步骤1：使用PC接口保存编辑内容
        saveEditedTextUsingPCApi(problemId, newText, newAnswerText, function(saveResult) {
            if (!saveResult.success) {
                const errorMsg = saveResult.errMsg || saveResult.error || '保存失败';
                alert('保存编辑内容失败: ' + errorMsg);
                return;
            }

            // 步骤2：使用PC接口刷新题目详情
            refreshProblemDetailUsingPCApi(problemId, function(detailResult) {
                if (!detailResult.success) {
                    console.warn('刷新题目详情失败，但编辑内容已保存');
                    showSuccessMessage('编辑内容已保存，但刷新详情失败');
                } else {
                    showSuccessMessage('内容保存成功！');
                }
            });
        });
    }

    // 显示成功消息
    function showSuccessMessage(customMessage) {
        const message = document.createElement('div');
        const messageText = customMessage || '✅ 内容保存成功！使用PC接口保存，组卷公式应该能正常渲染。';
        
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f6ffed;
                border: 1px solid #b7eb8f;
                border-radius: 6px;
                padding: 15px;
                z-index: 10001;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 400px;
            ">
                <h4 style="margin: 0 0 10px 0; color: #52c41a;">${messageText}</h4>
                <div style="font-size: 13px; line-height: 1.5;">
                    <p><strong>使用PC接口的优势：</strong></p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>与橙果官方PC端使用相同接口</li>
                        <li>彻底解决组卷公式渲染问题</li>
                        <li>无需额外手动保存步骤</li>
                    </ul>
                </div>
                <button onclick="this.parentElement.remove()" style="
                    margin-top: 10px;
                    padding: 4px 8px;
                    background: transparent;
                    color: #666;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">知道了</button>
            </div>
        `;
        document.body.appendChild(message);
    }


    // 精准隐藏原编辑器iframe
    function hideOriginalEditor() {
        // 隐藏题干编辑器iframe
        const questionEditor = document.getElementById('need-editor-cont0');
        if (questionEditor) {
            questionEditor.style.display = 'none';
            console.log('✅ 隐藏题干编辑器iframe');
        } else {
            console.log('❌ 未找到题干编辑器iframe');
        }

        // 隐藏答案编辑器iframe
        const answerEditor = document.getElementById('need-editor-cont1');
        if (answerEditor) {
            answerEditor.style.display = 'none';
            console.log('✅ 隐藏答案编辑器iframe');
        } else {
            console.log('❌ 未找到答案编辑器iframe');
        }
    }

    // 获取当前题目内容（使用PC接口）
    function fetchProblemContent(problemId) {
        return new Promise((resolve, reject) => {
            const loginToken = getLoginToken();
            if (!loginToken) {
                reject(new Error('未找到登录token'));
                return;
            }

            // 直接使用PC接口
            fetchProblemContentUsingPC(problemId, loginToken)
                .then(resolve)
                .catch(reject);
        });
    }

    // 使用PC接口获取题目内容（备选方案）
    function fetchProblemContentUsingPC(problemId, loginToken) {
        return new Promise((resolve, reject) => {
            // 根据action.js的分析，使用更简单的参数格式
            const pcSendUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
            
            // 构建参数 - 参考action.js中的格式
            const params = {
                service: 'com.orange.note.query.problem.detail',
                param: JSON.stringify({
                    problemId: problemId,
                    loginToken: loginToken
                })
            };

            console.log('PC接口请求参数:', params);

            // 使用URLSearchParams格式，参考action.js中的ajax函数
            const formData = new URLSearchParams();
            for (const key in params) {
                formData.append(key, params[key]);
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: pcSendUrl,
                data: formData.toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": "https://ctb.91chengguo.com",
                    "Referer": "https://ctb.91chengguo.com/",
                },
                onload: function(response) {
                    console.log('PC接口获取题目内容响应状态:', response.status);
                    console.log('PC接口获取题目内容响应:', response.responseText);
                    const responseText = response.responseText;
                    
                    // 检查响应是否为JSON格式
                    if (responseText.trim().startsWith('{')) {
                        try {
                            const result = JSON.parse(responseText);
                            console.log('PC接口解析成功，success:', result.success);
                            
                            if (result.success) {
                                // 直接返回content，因为这是单个题目详情
                                if (result.content) {
                                    console.log('PC接口成功获取题目详情:', result.content);
                                    const problemDetail = {
                                        question: result.content.question,
                                        answer: result.content.answer,
                                        imgUrl: result.content.imgUrl,
                                        problemId: result.content.problemId,
                                        userProblemId: result.content.userProblemId
                                    };
                                    resolve(problemDetail);
                                } else {
                                    console.log('PC接口返回的题目详情为空');
                                    reject(new Error('PC接口返回的题目详情为空'));
                                }
                            } else {
                                console.log('PC接口返回success为false，错误信息:', result.errMsg);
                                reject(new Error(result.errMsg || 'PC接口获取题目内容失败'));
                            }
                        } catch (e) {
                            console.error('PC接口解析响应失败:', e);
                            reject(new Error('PC接口解析响应失败: ' + e.message + '，响应内容: ' + responseText));
                        }
                    } else {
                        // 非JSON响应，可能是Java异常等
                        let errorMsg = 'PC接口返回了非JSON格式的响应';
                        if (responseText.includes('java.lang.NullPointerException')) {
                            errorMsg = 'PC接口服务器内部错误（空指针异常）';
                        } else if (responseText.includes('Exception')) {
                            // 可以提取更多异常信息
                            errorMsg = 'PC接口服务器异常: ' + responseText.substring(0, 100); // 截取前100个字符
                        } else {
                            errorMsg = 'PC接口返回了非JSON响应: ' + responseText.substring(0, 100);
                        }
                        console.error('PC接口返回非JSON响应:', errorMsg);
                        reject(new Error(errorMsg));
                    }
                },
                onerror: function(error) {
                    reject(new Error('PC接口网络请求失败: ' + error.statusText));
                }
            });
        });
    }

    // 检查原编辑器是否已加载完成
    function checkOriginalEditorLoaded() {
        return new Promise((resolve) => {
            const questionEditor = document.getElementById('need-editor-cont0');
            const answerEditor = document.getElementById('need-editor-cont1');

            if (!questionEditor || !answerEditor) {
                console.log('❌ 原编辑器iframe尚未加载');
                resolve(false);
                return;
            }

            // 检查iframe是否已加载内容（通过检查高度或内容）
            const isQuestionLoaded = questionEditor.offsetHeight > 100;
            const isAnswerLoaded = answerEditor.offsetHeight > 100;

            // 检查是否还有"正在加载"的提示
            const loadingText = document.body.innerText.includes('正在加载编辑器');

            if (isQuestionLoaded && isAnswerLoaded && !loadingText) {
                console.log('✅ 原编辑器已加载完成');
                resolve(true);
            } else {
                console.log('⏳ 等待原编辑器加载...');
                resolve(false);
            }
        });
    }

    // 集成到页面编辑区域 - 等待原编辑器加载完成后再替换
    function integrateIntoPage() {
        let checkCount = 0;
        const maxChecks = 30; // 最多检查30次（15秒）

        const checkInterval = setInterval(() => {
            checkCount++;

            checkOriginalEditorLoaded().then(isLoaded => {
                if (isLoaded) {
                    clearInterval(checkInterval);
                    hideOriginalEditor();
                    replaceEditors();
                } else if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    console.log('⏰ 超时，强制替换原编辑器');
                    hideOriginalEditor();
                    replaceEditors();
                }
            });
        }, 500); // 每500ms检查一次

        // 显示等待提示
        showLoadingMessage();
    }

    // 显示加载等待提示
    function showLoadingMessage() {
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'latex-editor-loading';
        loadingMsg.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px 30px;
                border-radius: 8px;
                z-index: 10000;
                font-size: 14px;
                text-align: center;
            ">
                <div style="margin-bottom: 10px;">🔄</div>
                <div>正在加载LaTeX编辑器，请稍候...</div>
            </div>
        `;
        document.body.appendChild(loadingMsg);
    }

    // 隐藏加载等待提示
    function hideLoadingMessage() {
        const loadingMsg = document.getElementById('latex-editor-loading');
        if (loadingMsg) {
            loadingMsg.remove();
        }
    }

    // 精准替换原编辑器
    function replaceEditors() {
        const problemId = getProblemIdFromUrl();

        // 获取原编辑器的位置信息
        const questionEditor = document.getElementById('need-editor-cont0');
        const answerEditor = document.getElementById('need-editor-cont1');

        if (!questionEditor || !answerEditor) {
            console.error('未找到原编辑器元素');
            return;
        }

        // 创建题目编辑器容器
        const questionContainer = document.createElement('div');
        questionContainer.innerHTML = `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-weight: 600; color: #262626; font-size: 14px;">
                        题目内容 (支持LaTeX):
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <button id="load-current" style="
                            padding: 4px 8px;
                            background: #52c41a;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">📥 加载错题</button>
                        <button id="insert-example" style="
                            padding: 4px 8px;
                            background: #722ed1;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">✨ 插入示例</button>
                    </div>
                </div>
                <textarea id="latex-question" style="
                    width: 100%;
                    height: 400px;
                    padding: 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 6px;
                    resize: vertical;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.5;
                    transition: border-color 0.3s;
                    white-space: pre;
                    overflow-wrap: normal;
                    overflow-x: auto;
                " placeholder="输入题目内容，支持LaTeX公式："></textarea>

                <div style="margin-top: 10px;">
                    <label style="font-weight: 600; color: #262626; font-size: 14px; margin-bottom: 8px; display: block;">
                        题目预览:
                    </label>
                    <div id="question-preview" style="
                        border: 1px solid #e8e8e8;
                        border-radius: 6px;
                        padding: 16px;
                        background: white;
                        min-height: 150px;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #333;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        overflow-y: auto;
                        font-family: inherit;
                    ">
                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                            题目预览将在这里显示...
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 创建答案编辑器容器
        const answerContainer = document.createElement('div');
        answerContainer.innerHTML = `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-weight: 600; color: #262626; font-size: 14px;">
                        答案内容 (支持LaTeX):
                    </label>
                    <button id="save-content" style="
                        padding: 6px 12px;
                        background: #1890ff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">💾 保存到橙果</button>
                </div>
                <textarea id="latex-answer" style="
                    width: 100%;
                    height: 300px;
                    padding: 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 6px;
                    resize: vertical;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.5;
                    transition: border-color 0.3s;
                    white-space: pre;
                    overflow-wrap: normal;
                    overflow-x: auto;
                " placeholder="输入答案内容，支持LaTeX公式："></textarea>

                <div style="margin-top: 10px;">
                    <label style="font-weight: 600; color: #262626; font-size: 14px; margin-bottom: 8px; display: block;">
                        答案预览:
                    </label>
                    <div id="answer-preview" style="
                        border: 1px solid #e8e8e8;
                        border-radius: 6px;
                        padding: 16px;
                        background: white;
                        min-height: 120px;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #333;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        overflow-y: auto;
                        font-family: inherit;
                    ">
                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                            答案预览将在这里显示...
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 15px; padding: 12px; background: #f6f8fa; border-radius: 4px; font-size: 12px; color: #586069;">
                <strong>📋 使用说明：</strong>
                <ul style="margin: 8px 0; padding-left: 20px;">
                    <li>使用 $...$ 表示行内公式，$$...$$ 表示行间公式</li>
                    <li>支持 \\[ ... \\] 和 \\( ... \\) 格式</li>
                    <li>换行符和空格会自动保留</li>
                    <li>编辑完成后仍需点击橙果的"保存编辑"按钮</li>
                </ul>
            </div>

            <div style="margin-top: 10px; font-size: 11px; color: #666; text-align: center;">
            LaTeX编辑助手 v5.2.0 (PC接口版) | 题目ID: <strong>${problemId || '未找到'}</strong>
            </div>
        `;

        // 替换原编辑器
        questionEditor.parentNode.replaceChild(questionContainer, questionEditor);
        answerEditor.parentNode.replaceChild(answerContainer, answerEditor);

        // 隐藏加载提示
        hideLoadingMessage();

        console.log('✅ 成功替换原编辑器为LaTeX编辑器');

        // 绑定事件
        document.getElementById('save-content').addEventListener('click', saveContent);
        document.getElementById('insert-example').addEventListener('click', insertExample);
        document.getElementById('load-current').addEventListener('click', loadCurrentContent);

        // 实时预览（防抖）
        let previewTimeout;
        ['latex-question', 'latex-answer'].forEach(id => {
            const element = document.getElementById(id);
            element.addEventListener('input', () => {
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(updatePreviews, 500);
            });

            element.addEventListener('focus', function() {
                this.style.borderColor = '#1890ff';
                this.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
            });

            element.addEventListener('blur', function() {
                this.style.borderColor = '#d9d9d9';
                this.style.boxShadow = 'none';
            });
        });

        // 初始预览
        updatePreviews();
    }

    // 更新预览
    function updatePreviews() {
        const questionText = document.getElementById('latex-question').value;
        const answerText = document.getElementById('latex-answer').value;

        // 更新题目预览
        if (questionText) {
            renderWithKaTeX(document.getElementById('question-preview'), questionText);
        } else {
            document.getElementById('question-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">题目预览将在这里显示...</div>';
        }

        // 更新答案预览
        if (answerText) {
            renderWithKaTeX(document.getElementById('answer-preview'), answerText);
        } else {
            document.getElementById('answer-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">答案预览将在这里显示...</div>';
        }
    }

    // 保存内容
    function saveContent() {
        const problemId = getProblemIdFromUrl();
        const questionText = document.getElementById('latex-question').value;
        const answerText = document.getElementById('latex-answer').value;

        if (!problemId) {
            alert('未找到题目ID，请确保在编辑页面使用');
            return;
        }

        if (!questionText && !answerText) {
            alert('请输入要修改的题目内容或答案');
            return;
        }

        // 显示保存中状态
        const saveBtn = document.getElementById('save-content');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '⏳ 保存中...';
        saveBtn.disabled = true;

        editProblem(problemId, questionText, answerText);

        // 3秒后恢复按钮状态
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }, 3000);
    }

    // 插入示例
    function insertExample() {
        const exampleQuestion = `已知函数 $f(x) = x^2 - 4x + 2m$ 在区间 $[0, 6]$ 上的最小值为 $1$，求实数 $m$ 的取值范围。

【分析】
令 $t = \\sqrt{x} \\in [0, \\sqrt{6}]$，则问题转化为 $y = t^2 - 4t + 2m \\geq 1$ 在 $t \\in [0, \\sqrt{6}]$ 上恒成立。

【解答】
由题意可得：
$$ y = t^2 - 4t + 2m \\geq 1 $$
即：
$$ t^2 - 4t + 2m - 1 \\geq 0 $$

考虑函数 $g(t) = t^2 - 4t + 2m - 1$，其对称轴为 $t = 2$。`;

        const exampleAnswer = `当 $t = 2$ 时，函数取得最小值：
$$ g(2) = 4 - 8 + 2m - 1 = 2m - 5 $$

由 $g(2) \\geq 0$ 得：
$$ 2m - 5 \\geq 0 $$
$$ m \\geq \\frac{5}{2} $$

故实数 $m$ 的取值范围为：
$$ \\left[\\frac{5}{2}, +\\infty\\right) $$`;

        document.getElementById('latex-question').value = exampleQuestion;
        document.getElementById('latex-answer').value = exampleAnswer;
        updatePreviews();
    }

    // 加载当前题目内容
    function loadCurrentContent() {
        const problemId = getProblemIdFromUrl();
        if (!problemId) {
            alert('未找到题目ID');
            return;
        }

        // 显示加载中状态
        const loadBtn = document.getElementById('load-current');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '⏳ 加载中...';
        loadBtn.disabled = true;

        fetchProblemContent(problemId)
            .then(content => {
                console.log('获取到的题目内容:', content);

                // 清理题目内容，移除无关文本
                let questionContent = content.question || '';
                let answerContent = content.answer || '';

                // 清理题目内容中的无关文本
                const unwantedTexts = [
                    '···我的错题···',
                    '题目编辑',
                    '标签编辑',
                    '原图题干',
                    '点击内容可编辑',
                    '原图题干文字匹配',
                    '答案点击内容可编辑',
                    '保存编辑'
                ];

                unwantedTexts.forEach(text => {
                    questionContent = questionContent.replace(new RegExp(text, 'g'), '');
                    answerContent = answerContent.replace(new RegExp(text, 'g'), '');
                });

                // 转换HTML到LaTeX
                const questionLatex = convertOrangeHtmlToLatex(questionContent);
                const answerLatex = convertOrangeHtmlToLatex(answerContent);

                document.getElementById('latex-question').value = questionLatex;
                document.getElementById('latex-answer').value = answerLatex;
                updatePreviews();

                showSuccessMessage('✅ 已成功加载当前题目内容');

                // 恢复按钮状态
                loadBtn.innerHTML = originalText;
                loadBtn.disabled = false;
            })
            .catch(error => {
                console.error('加载题目内容失败:', error);
                alert('加载题目内容失败: ' + error.message);

                // 恢复按钮状态
                loadBtn.innerHTML = originalText;
                loadBtn.disabled = false;
            });
    }

    // 初始化
    function init() {
        loadKatexCSS();
        integrateIntoPage();
        console.log('橙果错题本编辑助手 v5.2.0 (PC接口版) 已加载');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();