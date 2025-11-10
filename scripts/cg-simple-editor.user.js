// ==UserScript==
// @name         橙果错题本简单编辑器
// @namespace    http://tampermonkey.net/
// @version      1.0.8
// @description  橙果错题本简单编辑工具，支持读取、编辑和保存错题，支持LaTeX公式预览
// @author       You
// @match        https://ctb.91chengguo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      www.91chengguo.com
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js
// @resource     katexCSS https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css
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

    // 使用KaTeX渲染内容
    function renderWithKaTeX(element, content) {
        if (!element || !content) return;

        // 保持原内容的换行和排版
        let formattedContent = content;

        // 1. 处理换行：\n → <br>
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        // 2. 处理空格：空格 → &nbsp;
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
                // 如果KaTeX渲染失败，回退到普通文本显示
                element.innerHTML = formattedContent;
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


    // 基础请求函数
    function callPCApi(service, params, callback) {
        const pcSendUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
        const loginToken = getLoginToken();
        
        if (!loginToken) {
            callback({ success: false, error: '未找到登录token' });
            return;
        }
        
        const requestParams = {
            service: service,
            param: JSON.stringify({
                loginToken: loginToken,
                ...params
            })
        };
        
        const formData = new URLSearchParams();
        for (const key in requestParams) {
            formData.append(key, requestParams[key]);
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

    // 获取题目详情
    function getProblemDetail(problemId, callback) {
        callPCApi('com.orange.note.query.problem.detail', { problemId }, callback);
    }

    // 保存编辑内容
    function saveEditedText(problemId, questionText, answerText, callback) {
        callPCApi('com.orange.note.problem.save.editedtext', {
            problemId,
            newText: questionText,
            newAnswerText: answerText,
            noCache: true
        }, callback);
    }

    // 显示消息
    function showMessage(message, isSuccess = true) {
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${isSuccess ? '#f6ffed' : '#fff2f0'};
                border: 1px solid ${isSuccess ? '#b7eb8f' : '#ffccc7'};
                border-radius: 6px;
                padding: 15px;
                z-index: 10001;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 400px;
                color: ${isSuccess ? '#52c41a' : '#ff4d4f'};
            ">
                <strong>${isSuccess ? '✅' : '❌'} ${message}</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-left: 10px;
                    padding: 2px 6px;
                    background: transparent;
                    color: #666;
                    border: 1px solid #d9d9d9;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                ">关闭</button>
            </div>
        `;
        document.body.appendChild(messageDiv);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 3000);
    }

    // 创建编辑器界面
    function createEditor() {
        const problemId = getProblemIdFromUrl();
        
        if (!problemId) {
            showMessage('未找到题目ID，请确保在编辑页面使用', false);
            return;
        }

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
        `;

        // 创建编辑器容器
        const editorContainer = document.createElement('div');
        editorContainer.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                height: 80%;
                background: white;
                border: 2px solid #1890ff;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                padding: 20px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #e8e8e8; padding-bottom: 10px;">
                    <h3 style="margin: 0; color: #1890ff;">橙果错题本编辑器</h3>
                    <button id="close-editor" style="
                        background: #ff4d4f;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 6px 12px;
                        cursor: pointer;
                        font-size: 12px;
                    ">关闭</button>
                </div>
                
                <div style="display: flex; gap: 20px; flex: 1; overflow: hidden;">
                    <!-- 题目编辑区域 -->
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label style="font-weight: 600; color: #262626;">题目内容:</label>
                            <button id="load-question" style="
                                padding: 4px 8px;
                                background: #52c41a;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 11px;
                            ">📥 加载题目</button>
                        </div>
                        <textarea id="question-editor" style="
                            flex: 1;
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #d9d9d9;
                            border-radius: 6px;
                            resize: none;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 13px;
                            line-height: 1.5;
                            overflow-y: auto;
                        " placeholder="输入题目内容，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                        
                        <!-- 题目预览 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">
                            <label style="font-weight: 600; color: #262626; font-size: 14px; margin-bottom: 8px; display: block;">
                                题目预览:
                            </label>
                            <div id="question-preview" style="
                                border: 1px solid #e8e8e8;
                                border-radius: 6px;
                                padding: 12px;
                                background: #fafafa;
                                height: 200px;
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
                    
                    <!-- 答案编辑区域 -->
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label style="font-weight: 600; color: #262626;">答案内容:</label>
                            <button id="load-answer" style="
                                padding: 4px 8px;
                                background: #52c41a;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 11px;
                            ">📥 加载答案</button>
                        </div>
                        <textarea id="answer-editor" style="
                            flex: 1;
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #d9d9d9;
                            border-radius: 6px;
                            resize: none;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                            font-size: 13px;
                            line-height: 1.5;
                            overflow-y: auto;
                        " placeholder="输入答案内容，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                        
                        <!-- 答案预览 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">
                            <label style="font-weight: 600; color: #262626; font-size: 14px; margin-bottom: 8px; display: block;">
                                答案预览:
                            </label>
                            <div id="answer-preview" style="
                                border: 1px solid #e8e8e8;
                                border-radius: 6px;
                                padding: 12px;
                                background: #fafafa;
                                height: 200px;
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
                </div>
                
                <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12px; color: #666;">
                        题目ID: <strong>${problemId}</strong>
                    </div>
                    <div>
                        <button id="save-all" style="
                            padding: 8px 16px;
                            background: #1890ff;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-right: 10px;
                        ">💾 保存全部</button>
                        <button id="load-all" style="
                            padding: 8px 16px;
                            background: #52c41a;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">📥 加载全部</button>
                    </div>
                </div>
            </div>
        `;

        // 添加遮罩层和编辑器到页面
        document.body.appendChild(overlay);
        document.body.appendChild(editorContainer);

        // 关闭编辑器的函数
        function closeEditor() {
            if (editorContainer.parentElement) {
                editorContainer.remove();
            }
            if (overlay.parentElement) {
                overlay.remove();
            }
        }

        // 绑定事件
        document.getElementById('close-editor').addEventListener('click', closeEditor);
        
        // 点击遮罩层关闭编辑器
        overlay.addEventListener('click', closeEditor);

        // 添加预览更新事件
        const questionEditor = document.getElementById('question-editor');
        const answerEditor = document.getElementById('answer-editor');
        
        let previewTimeout;
        function setupPreviewUpdates() {
            [questionEditor, answerEditor].forEach(editor => {
                editor.addEventListener('input', function() {
                    clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(updatePreviews, 300);
                });
                
                editor.addEventListener('focus', function() {
                    this.style.borderColor = '#1890ff';
                    this.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
                });
                
                editor.addEventListener('blur', function() {
                    this.style.borderColor = '#d9d9d9';
                    this.style.boxShadow = 'none';
                });
            });
        }
        
        setupPreviewUpdates();

        document.getElementById('load-all').addEventListener('click', function() {
            loadAllContent(problemId);
        });

        document.getElementById('load-question').addEventListener('click', function() {
            loadQuestionContent(problemId);
        });

        document.getElementById('load-answer').addEventListener('click', function() {
            loadAnswerContent(problemId);
        });

        document.getElementById('save-all').addEventListener('click', function() {
            saveAllContent(problemId);
        });
    }

    // 加载全部内容
    function loadAllContent(problemId) {
        const loadBtn = document.getElementById('load-all');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '⏳ 加载中...';
        loadBtn.disabled = true;

        getProblemDetail(problemId, function(result) {
            if (result.success && result.content) {
                let questionContent = result.content.question || '';
                let answerContent = result.content.answer || '';

                console.log('原始题目内容:', questionContent);
                console.log('原始答案内容:', answerContent);

                // 调试：检查是否包含换行符
                console.log('题目内容包含换行符:', questionContent.includes('\n'));
                console.log('答案内容包含换行符:', answerContent.includes('\n'));

                // 替换实际的换行符及其周围的空格
                const beforeQuestion = questionContent;
                const beforeAnswer = answerContent;
                
                questionContent = questionContent.replace(/\s*\n\s*/g, ' ');
                answerContent = answerContent.replace(/\s*\n\s*/g, ' ');

                console.log('过滤后题目内容:', questionContent);
                console.log('过滤后答案内容:', answerContent);
                console.log('题目内容变化:', beforeQuestion !== questionContent);
                console.log('答案内容变化:', beforeAnswer !== answerContent);

                document.getElementById('question-editor').value = questionContent;
                document.getElementById('answer-editor').value = answerContent;
                
                // 更新预览
                updatePreviews();

                showMessage('✅ 已成功加载题目和答案内容');
            } else {
                showMessage('❌ 加载题目内容失败: ' + (result.errMsg || '未知错误'), false);
            }

            // 恢复按钮状态
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        });
    }

    // 仅加载题目内容
    function loadQuestionContent(problemId) {
        const loadBtn = document.getElementById('load-question');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '⏳ 加载中...';
        loadBtn.disabled = true;

        getProblemDetail(problemId, function(result) {
            if (result.success && result.content) {
                let questionContent = result.content.question || '';

                console.log('加载题目 - 原始内容:', questionContent);
                console.log('加载题目 - 包含换行符:', questionContent.includes('\n'));

                // 替换实际的换行符及其周围的空格
                const beforeReplace = questionContent;
                questionContent = questionContent.replace(/\s*\n\s*/g, ' ');
                console.log('加载题目 - 替换后:', questionContent);
                console.log('加载题目 - 替换是否生效:', beforeReplace !== questionContent);

                document.getElementById('question-editor').value = questionContent;
                
                // 更新预览
                updatePreviews();

                showMessage('✅ 已成功加载题目内容');
            } else {
                showMessage('❌ 加载题目内容失败: ' + (result.errMsg || '未知错误'), false);
            }

            // 恢复按钮状态
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        });
    }

    // 仅加载答案内容
    function loadAnswerContent(problemId) {
        const loadBtn = document.getElementById('load-answer');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '⏳ 加载中...';
        loadBtn.disabled = true;

        getProblemDetail(problemId, function(result) {
            if (result.success && result.content) {
                let answerContent = result.content.answer || '';

                console.log('加载答案 - 原始内容:', answerContent);
                console.log('加载答案 - 包含换行符:', answerContent.includes('\n'));

                // 替换实际的换行符及其周围的空格
                const beforeReplace = answerContent;
                answerContent = answerContent.replace(/\s*\n\s*/g, ' ');
                console.log('加载答案 - 替换后:', answerContent);
                console.log('加载答案 - 替换是否生效:', beforeReplace !== answerContent);

                document.getElementById('answer-editor').value = answerContent;
                
                // 更新预览
                updatePreviews();

                showMessage('✅ 已成功加载答案内容');
            } else {
                showMessage('❌ 加载答案内容失败: ' + (result.errMsg || '未知错误'), false);
            }

            // 恢复按钮状态
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        });
    }

    // 更新预览
    function updatePreviews() {
        const questionText = document.getElementById('question-editor').value;
        const answerText = document.getElementById('answer-editor').value;

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

    // 保存全部内容
    function saveAllContent(problemId) {
        const questionText = document.getElementById('question-editor').value;
        const answerText = document.getElementById('answer-editor').value;

        if (!questionText && !answerText) {
            showMessage('❌ 请输入要保存的题目内容或答案', false);
            return;
        }

        const saveBtn = document.getElementById('save-all');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '⏳ 保存中...';
        saveBtn.disabled = true;

        saveEditedText(problemId, questionText, answerText, function(result) {
            if (result.success) {
                showMessage('✅ 内容保存成功！页面即将刷新...');
                
                // 2秒后自动刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showMessage('❌ 保存失败: ' + (result.errMsg || result.error || '未知错误'), false);
            }

            // 恢复按钮状态
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        });
    }

    // 添加打开编辑器的按钮到页面
    function addEditorButton() {
        // 检查是否已经在编辑页面
        const problemId = getProblemIdFromUrl();
        if (!problemId) {
            console.log('不在编辑页面，不添加编辑器按钮');
            return;
        }

        // 创建悬浮按钮
        const floatButton = document.createElement('button');
        floatButton.innerHTML = '✏️ 编辑器';
        floatButton.style.cssText = `
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            z-index: 9999;
            background: #1890ff;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 10px 16px;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(24, 144, 255, 0.4);
            transition: all 0.3s;
        `;

        floatButton.addEventListener('mouseover', function() {
            this.style.background = '#40a9ff';
            this.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.6)';
        });

        floatButton.addEventListener('mouseout', function() {
            this.style.background = '#1890ff';
            this.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.4)';
        });

        floatButton.addEventListener('click', createEditor);

        document.body.appendChild(floatButton);
    }

    // 初始化
    function init() {
        // 加载KaTeX CSS
        loadKatexCSS();
        
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addEditorButton);
        } else {
            addEditorButton();
        }
    }

    // 启动脚本
    init();
})();