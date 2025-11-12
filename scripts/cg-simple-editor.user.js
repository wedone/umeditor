// ==UserScript==
// @name         橙果错题编辑器
// @namespace    http://tampermonkey.net/
// @version      1.3.6
// @description  橙果错题编辑工具，支持读取、编辑和保存错题，支持LaTeX公式预览，切换显示题干和答案，支持双栏编辑
// @author       WeDone
// @match        https://ctb.91chengguo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      www.91chengguo.com
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/mhchem.min.js
// @resource     katexCSS https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css
// @require      https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 动态加载KaTeX CSS和Font Awesome
    function loadKatexCSS() {
        if (document.querySelector('link[href*="katex"]')) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        document.head.appendChild(link);
        
        // 加载Font Awesome CSS
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(faLink);
    }

    // 使用KaTeX渲染内容，支持图片预览
    function renderWithKaTeX(element, content) {
        if (!element || !content) return;

        // 检查内容中是否包含图片标签
        const hasImages = /<img[^>]*>/i.test(content);
        
        if (hasImages) {
            // 如果包含图片，直接设置innerHTML（保留HTML标签）
            element.innerHTML = content;
            
            // 仍然尝试渲染LaTeX公式
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
        } else {
            // 如果不包含图片，使用原来的处理方式
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
                    element.innerHTML = formattedContent;
                }
            }
        }
    }

    // 保护HTML标签并过滤换行符
    function protectHtmlTagsAndFilterNewlines(content) {
        if (!content) return content;
        
        // 如果内容不包含HTML标签，直接过滤换行符
        if (!/<[^>]+>/i.test(content)) {
            return content.replace(/\s*\n\s*/g, ' ');
        }
        
        // 如果包含HTML标签，使用更复杂的方法
        // 将内容分割成文本和标签部分
        const parts = [];
        let currentIndex = 0;
        const tagRegex = /<[^>]+>/g;
        let match;
        
        while ((match = tagRegex.exec(content)) !== null) {
            // 添加标签前的文本
            if (match.index > currentIndex) {
                const text = content.slice(currentIndex, match.index);
                parts.push({ type: 'text', content: text });
            }
            // 添加标签
            parts.push({ type: 'tag', content: match[0] });
            currentIndex = match.index + match[0].length;
        }
        
        // 添加剩余文本
        if (currentIndex < content.length) {
            const text = content.slice(currentIndex);
            parts.push({ type: 'text', content: text });
        }
        
        // 处理文本部分，过滤换行符
        const processedParts = parts.map(part => {
            if (part.type === 'text') {
                return part.content.replace(/\s*\n\s*/g, ' ');
            }
            return part.content;
        });
        
        return processedParts.join('');
    }

    // 获取登录token
    function getLoginToken() {
        const cookieToken = document.cookie.match(/loginToken=([^;]+)/)?.[1];
        if (cookieToken) return cookieToken;
        return null;
    }

    // 从当前URL获取错题ID
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

    // 获取错题详情
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
            showMessage('未找到错题ID，请确保在编辑页面使用', false);
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
                height: 95%;
                background: white;
                border: 2px solid #1890ff;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                padding: 15px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #e8e8e8; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center;">
                        <h3 style="margin: 0; color: #1890ff;"><i class="fas fa-edit" style="margin-right: 8px;"></i>橙果错题编辑器</h3>
                        <span style="margin-left: 8px; font-size: 12px; color: #999;">v1.3.6</span>
                    </div>
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
                
                <!-- 切换标签和操作按钮 -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e8e8e8; padding-bottom: 8px;">
                    <div style="display: flex; align-items: center;">
                        <button id="tab-question" style="
                            padding: 6px 12px;
                            background: #1890ff;
                            color: white;
                            border: none;
                            border-radius: 4px 4px 0 0;
                            cursor: pointer;
                            font-size: 13px;
                            margin-right: 5px;
                        "><i class="fas fa-file-alt" style="margin-right: 4px;"></i>题干</button>
                        <button id="tab-answer" style="
                            padding: 6px 12px;
                            background: #f0f0f0;
                            color: #666;
                            border: none;
                            border-radius: 4px 4px 0 0;
                            cursor: pointer;
                            font-size: 13px;
                            margin-right: 15px;
                        "><i class="fas fa-file-text" style="margin-right: 4px;"></i>答案</button>
                        <div style="display: flex; gap: 8px;">
                            <button id="load-current" style="
                                padding: 6px 12px;
                                background: #52c41a;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 13px;
                            "><i class="fas fa-download" style="margin-right: 4px;"></i>加载</button>
                            <button id="save-all" style="
                                padding: 6px 12px;
                                background: #1890ff;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 13px;
                            "><i class="fas fa-save" style="margin-right: 4px;"></i>保存</button>
                        </div>
                    </div>
                    <div style="font-size: 11px; color: #666;">
                        错题ID: <strong>${problemId}</strong>
                    </div>
                </div>
                
                <div style="flex: 1; overflow: hidden;">
                    <!-- 题干编辑区域 -->
                    <div id="question-area" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">

                        <!-- 题干编辑双栏 -->
                        <div id="question-columns" style="display: flex; gap: 15px; flex: 1; overflow: hidden;">
                            <!-- 左侧题干内容输入框 -->
                            <div id="question-left" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px;"><i class="fas fa-pen" style="margin-right: 4px;"></i>题干内容:</label>
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
                                    transition: all 0.3s ease;
                                " placeholder="输入题干内容，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                            </div>
                            
                            <!-- 右侧新增输入框 -->
                            <div id="question-right" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px;"><i class="fas fa-plus-circle" style="margin-right: 4px;"></i>题干补充:</label>
                                <textarea id="question-supplement" style="
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
                                    transition: all 0.3s ease;
                                " placeholder="输入题干补充内容"></textarea>
                            </div>
                        </div>
                        
                        <!-- 题干预览双栏 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">

                            <div id="question-preview-columns" style="display: flex; gap: 15px;">
                                <!-- 左侧题干内容预览 -->
                                <div id="question-preview-left" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: block;"><i class="fas fa-eye" style="margin-right: 4px;"></i>题干预览:</label>
                                    <div id="question-preview" style="
                                        border: 1px solid #e8e8e8;
                                        border-radius: 6px;
                                        padding: 12px;
                                        background: #fafafa;
                                        height: 250px;
                                        overflow-y: auto;
                                        transition: all 0.3s ease;
                                    ">
                                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                                            <i class="fas fa-file-alt" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                                            题干预览将在这里显示...
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 右侧题干补充预览 -->
                                <div id="question-preview-right" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: block;"><i class="fas fa-eye" style="margin-right: 4px;"></i>题干补充预览:</label>
                                    <div id="question-supplement-preview" style="
                                        border: 1px solid #e8e8e8;
                                        border-radius: 6px;
                                        padding: 12px;
                                        background: #fafafa;
                                        height: 250px;
                                        overflow-y: auto;
                                        transition: all 0.3s ease;
                                    ">
                                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                                            <i class="fas fa-plus-circle" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                                            题干补充预览将在这里显示...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 答案编辑区域 -->
                    <div id="answer-area" style="display: none; flex-direction: column; height: 100%; overflow: hidden;">

                        <!-- 答案编辑双栏 -->
                        <div id="answer-columns" style="display: flex; gap: 15px; flex: 1; overflow: hidden;">
                            <!-- 左侧答案内容输入框 -->
                            <div id="answer-left" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px;"><i class="fas fa-pen" style="margin-right: 4px;"></i>答案内容:</label>
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
                                    transition: all 0.3s ease;
                                " placeholder="输入答案内容，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                            </div>
                            
                            <!-- 右侧新增输入框 -->
                            <div id="answer-right" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px;"><i class="fas fa-plus-circle" style="margin-right: 4px;"></i>答案补充:</label>
                                <textarea id="answer-supplement" style="
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
                                    transition: all 0.3s ease;
                                " placeholder="输入答案补充内容"></textarea>
                            </div>
                        </div>
                        
                        <!-- 答案预览双栏 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">

                            <div id="answer-preview-columns" style="display: flex; gap: 15px;">
                                <!-- 左侧答案内容预览 -->
                                <div id="answer-preview-left" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: block;"><i class="fas fa-eye" style="margin-right: 4px;"></i>答案预览:</label>
                                    <div id="answer-preview" style="
                                        border: 1px solid #e8e8e8;
                                        border-radius: 6px;
                                        padding: 12px;
                                        background: #fafafa;
                                        height: 250px;
                                        overflow-y: auto;
                                        transition: all 0.3s ease;
                                    ">
                                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                                            <i class="fas fa-file-text" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                                            答案预览将在这里显示...
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 右侧答案补充预览 -->
                                <div id="answer-preview-right" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: block;"><i class="fas fa-eye" style="margin-right: 4px;"></i>答案补充预览:</label>
                                    <div id="answer-supplement-preview" style="
                                        border: 1px solid #e8e8e8;
                                        border-radius: 6px;
                                        padding: 12px;
                                        background: #fafafa;
                                        height: 250px;
                                        overflow-y: auto;
                                        transition: all 0.3s ease;
                                    ">
                                        <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                                            <i class="fas fa-plus-circle" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                                            答案补充预览将在这里显示...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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

        // 添加预览更新事件和动态宽度调整
        const questionEditor = document.getElementById('question-editor');
        const questionSupplement = document.getElementById('question-supplement');
        const answerEditor = document.getElementById('answer-editor');
        const answerSupplement = document.getElementById('answer-supplement');
        
        let previewTimeout;
        function setupPreviewUpdates() {
            [questionEditor, questionSupplement, answerEditor, answerSupplement].forEach(editor => {
                editor.addEventListener('input', function() {
                    clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(updatePreviews, 300);
                });
                
                editor.addEventListener('focus', function() {
                    this.style.borderColor = '#1890ff';
                    this.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
                    
                    // 动态调整宽度
                    adjustColumnWidths(this.id, true);
                });
                
                editor.addEventListener('blur', function() {
                    this.style.borderColor = '#d9d9d9';
                    this.style.boxShadow = 'none';
                    
                    // 恢复等宽布局
                    adjustColumnWidths(this.id, false);
                });
            });
        }
        
        setupPreviewUpdates();
        
        // 动态调整列宽度的函数
        function adjustColumnWidths(editorId, isFocus) {
            const questionLeft = document.getElementById('question-left');
            const questionRight = document.getElementById('question-right');
            const questionPreviewLeft = document.getElementById('question-preview-left');
            const questionPreviewRight = document.getElementById('question-preview-right');
            const answerLeft = document.getElementById('answer-left');
            const answerRight = document.getElementById('answer-right');
            const answerPreviewLeft = document.getElementById('answer-preview-left');
            const answerPreviewRight = document.getElementById('answer-preview-right');
            
            // 设置宽度比例
            const focusedWidth = isFocus ? 1.5 : 1;  // 60% vs 40% = 1.5:1
            const unfocusedWidth = 1;
            
            if (editorId === 'question-editor') {
                questionLeft.style.flex = focusedWidth;
                questionRight.style.flex = unfocusedWidth;
                questionPreviewLeft.style.flex = focusedWidth;
                questionPreviewRight.style.flex = unfocusedWidth;
            } else if (editorId === 'question-supplement') {
                questionLeft.style.flex = unfocusedWidth;
                questionRight.style.flex = focusedWidth;
                questionPreviewLeft.style.flex = unfocusedWidth;
                questionPreviewRight.style.flex = focusedWidth;
            } else if (editorId === 'answer-editor') {
                answerLeft.style.flex = focusedWidth;
                answerRight.style.flex = unfocusedWidth;
                answerPreviewLeft.style.flex = focusedWidth;
                answerPreviewRight.style.flex = unfocusedWidth;
            } else if (editorId === 'answer-supplement') {
                answerLeft.style.flex = unfocusedWidth;
                answerRight.style.flex = focusedWidth;
                answerPreviewLeft.style.flex = unfocusedWidth;
                answerPreviewRight.style.flex = focusedWidth;
            }
        }

        // 添加标签切换功能
        document.getElementById('tab-question').addEventListener('click', function() {
            switchToQuestion();
        });

        document.getElementById('tab-answer').addEventListener('click', function() {
            switchToAnswer();
        });

        document.getElementById('load-current').addEventListener('click', function() {
            loadCurrentContent(problemId);
        });

        document.getElementById('save-all').addEventListener('click', function() {
            saveAllContent(problemId);
        });

        // 标签切换函数
        function switchToQuestion() {
            document.getElementById('question-area').style.display = 'flex';
            document.getElementById('answer-area').style.display = 'none';
            document.getElementById('tab-question').style.background = '#1890ff';
            document.getElementById('tab-question').style.color = 'white';
            document.getElementById('tab-answer').style.background = '#f0f0f0';
            document.getElementById('tab-answer').style.color = '#666';
        }

        function switchToAnswer() {
            document.getElementById('question-area').style.display = 'none';
            document.getElementById('answer-area').style.display = 'flex';
            document.getElementById('tab-question').style.background = '#f0f0f0';
            document.getElementById('tab-question').style.color = '#666';
            document.getElementById('tab-answer').style.background = '#1890ff';
            document.getElementById('tab-answer').style.color = 'white';
        }
    }

    // 加载当前标签内容
    function loadCurrentContent(problemId) {
        const loadBtn = document.getElementById('load-current');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '⏳ 加载中...';
        loadBtn.disabled = true;

        getProblemDetail(problemId, function(result) {
            if (result.success && result.content) {
                let questionContent = result.content.question || '';
                let answerContent = result.content.answer || '';

                console.log('原始题干内容:', questionContent);
                console.log('原始答案内容:', answerContent);

                // 调试：检查是否包含换行符和图片
                console.log('题干内容包含换行符:', questionContent.includes('\n'));
                console.log('答案内容包含换行符:', answerContent.includes('\n'));
                console.log('题干内容包含图片:', /<img[^>]*>/i.test(questionContent));
                console.log('答案内容包含图片:', /<img[^>]*>/i.test(answerContent));

                // 使用保护HTML标签并过滤换行符的函数
                questionContent = protectHtmlTagsAndFilterNewlines(questionContent);
                answerContent = protectHtmlTagsAndFilterNewlines(answerContent);

                console.log('过滤后题干内容:', questionContent);
                console.log('过滤后答案内容:', answerContent);

                // 根据当前激活的标签决定加载哪个内容
                const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                
                if (isQuestionTabActive) {
                    document.getElementById('question-editor').value = questionContent;
                    showMessage('已成功加载题干内容');
                } else {
                    document.getElementById('answer-editor').value = answerContent;
                    showMessage('已成功加载答案内容');
                }
                
                // 更新预览
                updatePreviews();
            } else {
                showMessage('❌ 加载内容失败: ' + (result.errMsg || '未知错误'), false);
            }

            // 恢复按钮状态
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        });
    }


    // 更新预览
    function updatePreviews() {
        const questionText = document.getElementById('question-editor').value;
        const questionSupplementText = document.getElementById('question-supplement').value;
        const answerText = document.getElementById('answer-editor').value;
        const answerSupplementText = document.getElementById('answer-supplement').value;

        // 更新题干内容预览
        if (questionText) {
            renderWithKaTeX(document.getElementById('question-preview'), questionText);
        } else {
            document.getElementById('question-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">题干内容预览将在这里显示...</div>';
        }

        // 更新题干补充预览
        if (questionSupplementText) {
            renderWithKaTeX(document.getElementById('question-supplement-preview'), questionSupplementText);
        } else {
            document.getElementById('question-supplement-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">题干补充预览将在这里显示...</div>';
        }

        // 更新答案内容预览
        if (answerText) {
            renderWithKaTeX(document.getElementById('answer-preview'), answerText);
        } else {
            document.getElementById('answer-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">答案预览将在这里显示...</div>';
        }

        // 更新答案补充预览
        if (answerSupplementText) {
            renderWithKaTeX(document.getElementById('answer-supplement-preview'), answerSupplementText);
        } else {
            document.getElementById('answer-supplement-preview').innerHTML =
                '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">答案补充预览将在这里显示...</div>';
        }
    }

    // 保存全部内容
    function saveAllContent(problemId) {
        const questionText = document.getElementById('question-editor').value;
        const answerText = document.getElementById('answer-editor').value;

        if (!questionText && !answerText) {
            showMessage('❌ 请输入要保存的题干内容或答案', false);
            return;
        }

        const saveBtn = document.getElementById('save-all');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '⏳ 保存中...';
        saveBtn.disabled = true;

        saveEditedText(problemId, questionText, answerText, function(result) {
            if (result.success) {
                showMessage('保存成功！即将刷新...');
                
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
        floatButton.innerHTML = '<i class="fas fa-edit" style="margin-right: 4px;"></i>编辑器';
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