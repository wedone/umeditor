// ==UserScript==
// @name         橙果错题编辑器
// @namespace    http://tampermonkey.net/
// @version      1.5.36
// @description  橙果错题编辑工具，支持读取、编辑和保存错题，支持LaTeX公式预览，切换显示题干和答案，支持双栏编辑（增强版Markdown解析）
// @author       WeDone
// @match        https://ctb.91chengguo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @connect      www.91chengguo.com
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/mhchem.min.js
// @require      https://unpkg.com/lucide@latest/dist/umd/lucide.js
// @resource     katexCSS https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css
// ==/UserScript==

(function() {
    'use strict';

    // 使用脚本头加载方式加载CSS
    function loadStyles() {
        // 加载KaTeX CSS
        const katexCSS = GM_getResourceText('katexCSS');
        GM_addStyle(katexCSS);
        
        // 添加旋转动画样式
        GM_addStyle(`
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `);
    }

    // 创建共享的右侧源码编辑器组件
    function createSourceEditor(type, placeholder = "输入源码") {
        return `
            <div id="${type}-right" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label style="font-weight: 500; color: #595959; font-size: 12px;">
                        <i data-lucide="wrench" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> 源码编辑
                    </label>
                    <div style="display: flex; gap: 4px;">
                        <button class="edit-btn" data-type="${type}" id="${type}-paste-btn" style="display: flex; align-items: center; justify-content: center;
                            padding: 2px 4px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="粘贴"><i data-lucide="clipboard-paste" style="width: 12px; height: 12px;"></i></button>
                        <button class="edit-btn" data-type="${type}" id="${type}-copy-btn" style="display: flex; align-items: center; justify-content: center;
                            padding: 2px 4px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="复制"><i data-lucide="copy" style="width: 12px; height: 12px;"></i></button>
                        <button class="edit-btn" data-type="${type}" id="${type}-undo-btn" style="display: flex; align-items: center; justify-content: center;
                            padding: 2px 4px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="撤销"><i data-lucide="undo" style="width: 12px; height: 12px;"></i></button>
                        <button class="edit-btn" data-type="${type}" id="${type}-redo-btn" style="display: flex; align-items: center; justify-content: center;
                            padding: 2px 4px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="重做"><i data-lucide="redo" style="width: 12px; height: 12px;"></i></button>
                        <button class="convert-btn" data-type="${type}" data-target="orange" style="
                            padding: 2px 6px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="转橙果码">转橙果码</button>
                        <button class="convert-btn" data-type="${type}" data-target="markdown" style="
                            padding: 2px 6px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="转MarkDown">转MarkDown</button>
                        <button class="convert-btn" data-type="${type}" data-target="html" style="
                            padding: 2px 6px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 2px;
                            cursor: pointer;
                            font-size: 10px;
                            line-height: 1;
                            height: 18px;
                        " title="转HTML">转HTML</button>
                    </div>
                </div>
                <textarea id="${type}-supplement" style="
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
                " placeholder="${placeholder}"></textarea>
            </div>
        `;
    }

    // 创建共享的右侧源码预览组件
    function createSourcePreview(type, label = "源码预览") {
        return `
            <div id="${type}-preview-right" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: block;">
                    <i data-lucide="eye" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> ${label}
                </label>
                <div id="${type}-supplement-preview" style="
                    border: 1px solid #e8e8e8;
                    border-radius: 6px;
                    padding: 12px;
                    background: #fafafa;
                    height: 250px;
                    overflow-y: auto;
                    transition: all 0.3s ease;
                ">
                    <div style="color: #999; font-style: italic; text-align: center; padding: 20px;">
                        <i data-lucide="wrench" style="width: 24px; height: 24px; display: block; margin-bottom: 8px; margin: 0 auto;"></i>
                        ${label}将在这里显示...
                    </div>
                </div>
            </div>
        `;
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

    // 显示消息 - 统一在面板正中显示
    function showMessage(message, isSuccess = true) {
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${isSuccess ? '#f6ffed' : '#fff2f0'};
                border: 1px solid ${isSuccess ? '#b7eb8f' : '#ffccc7'};
                border-radius: 8px;
                padding: 16px 24px;
                z-index: 10001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 500px;
                color: ${isSuccess ? '#52c41a' : '#ff4d4f'};
                font-size: 14px;
                font-weight: 500;
                text-align: center;
                white-space: nowrap;
            ">
                <i data-lucide="${isSuccess ? 'check' : 'x'}" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i>
                ${message}
            </div>
        `;
        document.body.appendChild(messageDiv);

        // 2秒后自动消失
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 2000);
    }

    // 创建编辑器界面
    function createEditor() {
        const problemId = getProblemIdFromUrl();

        if (!problemId) {
            showMessage('未找到错题ID', false);
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
                        <h3 style="margin: 0; color: #1890ff; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="file-pen-line" style="width: 20px; height: 20px;"></i>
                            橙果错题编辑器
                        </h3>
                        <span style="margin-left: 8px; font-size: 12px; color: #999;">v1.5.36</span>
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
                        "><i data-lucide="file-text" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> 题干</button>
                        <button id="tab-answer" style="
                            padding: 6px 12px;
                            background: #f0f0f0;
                            color: #666;
                            border: none;
                            border-radius: 4px 4px 0 0;
                            cursor: pointer;
                            font-size: 13px;
                            margin-right: 15px;
                        "><i data-lucide="edit-3" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> 答案</button>
                        <div style="display: flex; gap: 8px;">
                            <button id="load-current" style="display: flex; align-items: center; gap: 4px;
                                padding: 6px 12px;
                                background: #52c41a;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 13px;
                            "><i data-lucide="download" style="width: 14px; height: 14px;"></i> 加载</button>
                            <button id="save-all" style="display: flex; align-items: center; gap: 4px;
                                padding: 6px 12px;
                                background: #1890ff;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                                font-size: 13px;
                            "><i data-lucide="save" style="width: 14px; height: 14px;"></i> 保存</button>
                        </div>
                    </div>


                    <!-- 复制按钮组 - 放在保存和错题ID之间 -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: 15px;">
                        <button class="copy-btn" id="copy-to-orange" style="display: flex; align-items: center; justify-content: center;
                            padding: 3px 8px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 15px;
                        " title="源码 → 橙果码"><i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i></button>
                        <button class="copy-btn" id="copy-to-source" style="display: flex; align-items: center; justify-content: center;
                            padding: 3px 8px;
                            background: #f0f0f0;
                            color: #666;
                            border: 1px solid #d9d9d9;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 15px;
                        " title="橙果码 → 源码"><i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i></button>
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
                            <!-- 左侧题干橙果码输入框 -->
                            <div id="question-left" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                                    <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                                    题干橙果码
                                </label>
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
                                " placeholder="输入题干橙果码，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                            </div>

                            <!-- 右侧源码编辑器 -->
                            ${createSourceEditor('question', '输入源码')}
                        </div>

                        <!-- 题干预览双栏 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">

                            <div id="question-preview-columns" style="display: flex; gap: 15px;">
                                <!-- 左侧题干预览 -->
                                <div id="question-preview-left" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                                        题干预览
                                    </label>
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
                                            <i data-lucide="file-text" style="width: 24px; height: 24px; display: block; margin-bottom: 8px; margin: 0 auto;"></i>
                                            题干预览将在这里显示...
                                        </div>
                                    </div>
                                </div>

                                <!-- 右侧源码预览 -->
                                ${createSourcePreview('question', '源码预览')}
                            </div>
                        </div>
                    </div>

                    <!-- 答案编辑区域 -->
                    <div id="answer-area" style="display: none; flex-direction: column; height: 100%; overflow: hidden;">

                        <!-- 答案编辑双栏 -->
                        <div id="answer-columns" style="display: flex; gap: 15px; flex: 1; overflow: hidden;">
                            <!-- 左侧答案橙果码输入框 -->
                            <div id="answer-left" class="editor-column" style="flex: 1; display: flex; flex-direction: column; transition: flex 0.3s ease;">
                                <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                                    <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                                    答案橙果码
                                </label>
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
                                " placeholder="输入答案橙果码，支持LaTeX公式：$...$ 或 $$...$$"></textarea>
                            </div>

                            <!-- 右侧源码编辑器 -->
                            ${createSourceEditor('answer', '输入源码')}
                        </div>

                        <!-- 答案预览双栏 -->
                        <div style="margin-top: 10px; flex-shrink: 0;">

                            <div id="answer-preview-columns" style="display: flex; gap: 15px;">
                                <!-- 左侧答案橙果码预览 -->
                                <div id="answer-preview-left" class="preview-column" style="flex: 1; transition: flex 0.3s ease;">
                                    <label style="font-weight: 500; color: #595959; font-size: 12px; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                                        答案预览
                                    </label>
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
                                            <i data-lucide="edit-3" style="width: 24px; height: 24px; display: block; margin-bottom: 8px; margin: 0 auto;"></i>
                                            答案预览将在这里显示...
                                        </div>
                                    </div>
                                </div>

                                <!-- 右侧源码预览 -->
                                ${createSourcePreview('answer', '源码预览')}
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
            // 为所有编辑器添加输入事件监听（用于预览更新）
            [questionEditor, questionSupplement, answerEditor, answerSupplement].forEach(editor => {
                editor.addEventListener('input', function() {
                    clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(updatePreviews, 300);
                });
            });

            // 为所有编辑器添加焦点事件监听
            [questionEditor, questionSupplement, answerEditor, answerSupplement].forEach(editor => {
                editor.addEventListener('focus', function() {
                    this.style.borderColor = '#1890ff';
                    this.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';

                    // 动态调整宽度 - 只有当焦点在另一侧时才调整比例
                    adjustColumnWidths(this.id);
                });

                editor.addEventListener('blur', function() {
                    this.style.borderColor = '#d9d9d9';
                    this.style.boxShadow = 'none';
                    // 失去焦点时不调整宽度，保持当前比例
                });
            });
        }

        setupPreviewUpdates();

        // 初始化宽度比例为60:40
        adjustColumnWidths('question-editor');

        // 动态调整列宽度的函数 - 修复逻辑：焦点在A侧时保持A6:B4，只有当焦点在B侧时才调整为A4:B6
        function adjustColumnWidths(editorId) {
            const questionLeft = document.getElementById('question-left');
            const questionRight = document.getElementById('question-right');
            const questionPreviewLeft = document.getElementById('question-preview-left');
            const questionPreviewRight = document.getElementById('question-preview-right');
            const answerLeft = document.getElementById('answer-left');
            const answerRight = document.getElementById('answer-right');
            const answerPreviewLeft = document.getElementById('answer-preview-left');
            const answerPreviewRight = document.getElementById('answer-preview-right');

            // 判断焦点在哪一侧
            const isLeftEditor = editorId === 'question-editor' || editorId === 'answer-editor';
            const isRightEditor = editorId === 'question-supplement' || editorId === 'answer-supplement';

            // 设置宽度比例：默认左侧60%右侧40%，只有当焦点在右侧时才调整为左侧40%右侧60%
            const leftWidth = isRightEditor ? 1 : 1.5;    // 左侧：焦点在右侧时为40%，否则60%
            const rightWidth = isRightEditor ? 1.5 : 1;   // 右侧：焦点在右侧时为60%，否则40%

            if (editorId === 'question-editor' || editorId === 'question-supplement') {
                // 题干编辑器
                questionLeft.style.flex = leftWidth;
                questionRight.style.flex = rightWidth;
                questionPreviewLeft.style.flex = leftWidth;
                questionPreviewRight.style.flex = rightWidth;
            } else if (editorId === 'answer-editor' || editorId === 'answer-supplement') {
                // 答案编辑器
                answerLeft.style.flex = leftWidth;
                answerRight.style.flex = rightWidth;
                answerPreviewLeft.style.flex = leftWidth;
                answerPreviewRight.style.flex = rightWidth;
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

        // 添加复制按钮事件监听
        function setupCopyButtons() {
            // 为所有复制按钮添加事件监听
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    // 根据当前激活的标签确定类型
                    const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                    const type = isQuestionTabActive ? 'question' : 'answer';

                    if (this.id === 'copy-to-source') {
                        // 橙果码 → 源码
                        const orangeContent = document.getElementById(`${type}-editor`).value;
                        document.getElementById(`${type}-supplement`).value = orangeContent;
                        updatePreviews();
                        showMessage(`${type === 'question' ? '题干' : '答案'}橙果码已复制到源码`);
                    } else if (this.id === 'copy-to-orange') {
                        // 源码 → 橙果码
                        const sourceContent = document.getElementById(`${type}-supplement`).value;
                        document.getElementById(`${type}-editor`).value = sourceContent;
                        updatePreviews();
                        showMessage(`${type === 'question' ? '题干' : '答案'}源码已复制到橙果码`);
                    }
                });
            });
        }

        setupCopyButtons();

        // 添加编辑按钮事件监听
        function setupEditButtons() {
            // 撤销按钮
            document.getElementById('undo-btn').addEventListener('click', function() {
                const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                const type = isQuestionTabActive ? 'question' : 'answer';
                const activeEditor = document.activeElement;
                
                if (activeEditor && (activeEditor.id === `${type}-editor` || activeEditor.id === `${type}-supplement`)) {
                    document.execCommand('undo');
                } else {
                    showMessage('请先点击要撤销的编辑器', false);
                }
            });

            // 重做按钮
            document.getElementById('redo-btn').addEventListener('click', function() {
                const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                const type = isQuestionTabActive ? 'question' : 'answer';
                const activeEditor = document.activeElement;
                
                if (activeEditor && (activeEditor.id === `${type}-editor` || activeEditor.id === `${type}-supplement`)) {
                    document.execCommand('redo');
                } else {
                    showMessage('请先点击要重做的编辑器', false);
                }
            });

            // 粘贴按钮
            document.getElementById('paste-btn').addEventListener('click', function() {
                const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                const type = isQuestionTabActive ? 'question' : 'answer';
                const activeEditor = document.activeElement;
                
                if (activeEditor && (activeEditor.id === `${type}-editor` || activeEditor.id === `${type}-supplement`)) {
                    // 先聚焦确保粘贴操作正确
                    activeEditor.focus();
                    document.execCommand('paste');
                    // 延迟更新预览，确保粘贴内容已插入
                    setTimeout(updatePreviews, 100);
                } else {
                    showMessage('请先点击要粘贴的编辑器', false);
                }
            });

            // 复制按钮
            document.getElementById('copy-btn').addEventListener('click', function() {
                const isQuestionTabActive = document.getElementById('question-area').style.display !== 'none';
                const type = isQuestionTabActive ? 'question' : 'answer';
                const activeEditor = document.activeElement;
                
                if (activeEditor && (activeEditor.id === `${type}-editor` || activeEditor.id === `${type}-supplement`)) {
                    // 先聚焦确保复制操作正确
                    activeEditor.focus();
                    document.execCommand('copy');
                    showMessage('内容已复制到剪贴板');
                } else {
                    showMessage('请先点击要复制的编辑器', false);
                }
            });
        }

        // 添加转换按钮事件监听
        function setupConvertButtons() {
            // 为所有转换按钮添加事件监听
            document.querySelectorAll('.convert-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    const target = this.getAttribute('data-target');
                    const sourceContent = document.getElementById(`${type}-supplement`).value;
                    
                    if (!sourceContent) {
                        showMessage('请先在源码编辑器中输入内容', false);
                        return;
                    }

                    let convertedContent = '';
                    let message = '';

                    switch (target) {
                        case 'orange':
                            // 转橙果码 - 添加具体的转换逻辑
                            convertedContent = convertToOrangeCode(sourceContent);
                            message = '已转换为橙果码格式';
                            break;
                        case 'markdown':
                            // 转MarkDown - 这里可以添加具体的转换逻辑
                            convertedContent = sourceContent;
                            message = '已转换为MarkDown格式';
                            break;
                        case 'html':
                            // 转HTML - 使用自定义解析器替代marked库
                            try {
                                // 使用增强版DOM解析器直接处理Markdown和HTML
                                convertedContent = enhancedHtmlParser(sourceContent);
                                message = '已转换为自定义HTML格式（无marked依赖）';
                            } catch (err) {
                                console.error('HTML转换失败:', err);
                                convertedContent = sourceContent;
                                message = '转换失败，保持原内容';
                            }
                            break;
                        default:
                            showMessage('未知的转换类型', false);
                            return;
                    }

                    // 将转换后的内容设置到源码编辑器
                    document.getElementById(`${type}-supplement`).value = convertedContent;
                    updatePreviews();
                    showMessage(message);
                });
            });
        }

        // 增强版HTML解析器 - 替代marked库功能
        function enhancedHtmlParser(input) {
            if (!input) return input;
            
            // 检测输入类型（HTML或Markdown）
            const isHtml = /<[a-z][\s\S]*>/i.test(input);
            
            if (isHtml) {
                // HTML输入：直接处理无序列表
                return processHtmlLists(input);
            } else {
                // Markdown输入：先解析Markdown再处理
                return processMarkdownLists(input);
            }
        }

        // 处理HTML中的无序列表
        function processHtmlLists(html) {
            if (!html) return html;
            
            // 创建一个临时容器来解析HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // 处理所有无序列表
            const uls = tempDiv.querySelectorAll('ul');
            uls.forEach(ul => {
                // 计算缩进级别
                let parent = ul.parentElement;
                let indentLevel = 0;
                while (parent && parent !== tempDiv) {
                    if (parent.tagName === 'UL' || parent.tagName === 'OL') {
                        indentLevel++;
                    }
                    parent = parent.parentElement;
                }
                
                // 处理每个列表项
                const lis = ul.querySelectorAll('li');
                let newContent = '';
                
                lis.forEach(li => {
                    const indent = '  '.repeat(indentLevel);
                    const content = li.innerHTML.trim();
                    newContent += `${indent}<strong>・</strong> ${content}\n`;
                });
                
                // 用处理后的内容替换ul
                const tempSpan = document.createElement('span');
                tempSpan.innerHTML = newContent;
                
                // 将span内的所有子节点移动到ul的位置
                while (tempSpan.firstChild) {
                    ul.parentNode.insertBefore(tempSpan.firstChild, ul);
                }
                
                // 移除原来的ul元素
                ul.parentNode.removeChild(ul);
            });
            
            return tempDiv.innerHTML;
        }

        // 处理Markdown中的无序列表
        function processMarkdownLists(markdown) {
            if (!markdown) return markdown;
            
            const lines = markdown.split('\n');
            const result = [];
            let inList = false;
            let currentIndent = 0;
            let listStack = [];
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                
                // 先处理内联元素（粗体、斜体等）
                line = processInlineElements(line);
                
                // 检测Markdown无序列表项（-、*、+开头）
                const listItemMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
                
                if (listItemMatch) {
                    const indent = listItemMatch[1];
                    const content = listItemMatch[3];
                    const indentLevel = Math.floor(indent.length / 2);
                    
                    // 处理列表开始和状态管理
                    if (!inList) {
                        inList = true;
                        currentIndent = indentLevel;
                    }
                    
                    // 更新堆栈状态
                    updateListStack(listStack, indentLevel);
                    
                    // 生成自定义格式
                    const customIndent = '  '.repeat(indentLevel);
                    result.push(`${customIndent}<strong>・</strong> ${content}`);
                } else {
                    // 非列表项
                    if (inList && line.trim() === '') {
                        // 空行结束列表
                        inList = false;
                        listStack = [];
                        currentIndent = 0;
                    }
                    result.push(line);
                }
            }
            
            return result.join('\n');
        }

        // 处理Markdown内联元素
        function processInlineElements(line) {
            if (!line) return line;
            
            let result = line;
            
            // 处理粗体：**粗体** 或 __粗体__
            result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            result = result.replace(/__(.*?)__/g, '<strong>$1</strong>');
            
            // 处理斜体：*斜体* 或 _斜体_
            result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
            result = result.replace(/_(.*?)_/g, '<em>$1</em>');
            
            // 处理删除线：~~删除线~~
            result = result.replace(/~~(.*?)~~/g, '<del>$1</del>');
            
            // 处理行内代码：`代码`
            result = result.replace(/`(.*?)`/g, '<code>$1</code>');
            
            // 处理链接：[文本](URL)
            result = result.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
            
            // 处理图片：![alt](URL)
            result = result.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
            
            // 处理换行：两个空格或反斜杠结尾
            result = result.replace(/  \n/g, '<br>\n');
            result = result.replace(/\\\n/g, '<br>\n');
            
            return result;
        }

        // 更新列表堆栈状态
        function updateListStack(stack, currentLevel) {
            // 移除比当前级别高的堆栈项
            while (stack.length > 0 && stack[stack.length - 1] >= currentLevel) {
                stack.pop();
            }
            
            // 添加当前级别
            if (stack.length === 0 || stack[stack.length - 1] < currentLevel) {
                stack.push(currentLevel);
            }
        }

        // 保留原convertUnorderedLists函数作为兼容性别名
        const convertUnorderedLists = processHtmlLists;

        // 转换为橙果码格式的函数
        function convertToOrangeCode(content) {
            if (!content) return '';
            
            let result = content;
            
            // 1. 处理LaTeX公式：将 $...$ 和 \(...\) 包装在 <span class="CgTex">$...$</span> 中
            // 使用函数替换确保捕获组内容正确插入
            result = result.replace(/\$([^$]+?)\$/g, function(match, formulaContent) {
                return '<span class="CgTex">$' + formulaContent + '$</span>';
            });
            
            result = result.replace(/\\\(([\s\S]+?)\\\)/g, function(match, formulaContent) {
                return '<span class="CgTex">$' + formulaContent + '$</span>';
            });
            
            // 2. 转义普通文本中的 < 为 <（但不转义公式内的）
            // 使用一个临时标记来保护已经处理过的公式部分
            const formulaRegex = /<span class="CgTex">[^<]*<\/span>/g;
            const formulas = [];
            let index = 0;
            
            // 提取所有公式并替换为临时标记
            result = result.replace(formulaRegex, (match) => {
                formulas.push(match);
                return `__FORMULA_${index++}__`;
            });
            
            // 转义剩余文本中的 <
            result = result.replace(/</g, '<');
            
            // 恢复公式部分
            formulas.forEach((formula, i) => {
                result = result.replace(`__FORMULA_${i}__`, formula);
            });
            
            // 3. 将所有换行符转换为 <br> 标签
            result = result.replace(/\n/g, '<br>');
            
            return result;
        }

        setupConvertButtons();
        
        // 添加源码编辑器编辑按钮事件监听
        function setupSourceEditButtons() {
            // 为所有源码编辑器的编辑按钮添加事件监听
            document.querySelectorAll('.edit-btn[data-type]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    const action = this.id.replace(`${type}-`, '').replace('-btn', '');
                    const sourceEditor = document.getElementById(`${type}-supplement`);
                    
                    if (!sourceEditor) {
                        showMessage('未找到对应的源码编辑器', false);
                        return;
                    }

                    // 聚焦到源码编辑器
                    sourceEditor.focus();

                    switch (action) {
                        case 'undo':
                            document.execCommand('undo');
                            break;
                        case 'redo':
                            document.execCommand('redo');
                            break;
                        case 'paste':
                            console.log('粘贴按钮被点击，类型:', type, '编辑器ID:', sourceEditor.id);
                            
                            // 尝试使用现代Clipboard API
                            if (navigator.clipboard && navigator.clipboard.readText) {
                                console.log('使用Clipboard API读取剪贴板');
                                navigator.clipboard.readText().then(text => {
                                    console.log('剪贴板内容读取成功，长度:', text.length, '内容前50字符:', text.substring(0, 50));
                                    
                                    // 先清空编辑器内容
                                    sourceEditor.value = '';
                                    
                                    // 插入剪贴板内容
                                    sourceEditor.value = text;
                                    
                                    // 将光标移到末尾
                                    sourceEditor.selectionStart = sourceEditor.selectionEnd = text.length;
                                    
                                    // 触发input事件以更新预览
                                    const inputEvent = new Event('input', { bubbles: true });
                                    sourceEditor.dispatchEvent(inputEvent);
                                    
                                    // 立即更新预览
                                    updatePreviews();
                                    
                                    showMessage('内容已从剪贴板粘贴');
                                    console.log('粘贴完成，编辑器新内容长度:', sourceEditor.value.length);
                                }).catch(err => {
                                    console.error('Clipboard API读取失败:', err);
                                    showMessage('无法读取剪贴板内容，请确保已授予权限', false);
                                    
                                    // 回退到execCommand
                                    console.log('尝试回退到execCommand');
                                    try {
                                        // 先清空编辑器内容
                                        sourceEditor.value = '';
                                        sourceEditor.focus();
                                        document.execCommand('paste');
                                        setTimeout(updatePreviews, 100);
                                        showMessage('内容已粘贴（已清空原有内容）');
                                    } catch (execErr) {
                                        console.error('execCommand也失败:', execErr);
                                        showMessage('粘贴失败，请使用Ctrl+V手动粘贴', false);
                                    }
                                });
                            } else {
                                console.log('Clipboard API不可用，使用execCommand');
                                // 回退到execCommand
                                try {
                                    // 先清空编辑器内容
                                    sourceEditor.value = '';
                                    sourceEditor.focus();
                                    document.execCommand('paste');
                                    setTimeout(updatePreviews, 100);
                                    showMessage('内容已粘贴（已清空原有内容）');
                                } catch (err) {
                                    console.error('execCommand失败:', err);
                                    showMessage('粘贴失败，请使用Ctrl+V手动粘贴', false);
                                }
                            }
                            break;
                        case 'copy':
                            document.execCommand('copy');
                            showMessage('源码内容已复制到剪贴板');
                            break;
                        default:
                            showMessage('未知的编辑操作', false);
                    }
                });
            });
        }
        
        setupSourceEditButtons();
        
        // 初始化编辑器内的Lucide图标
        setTimeout(initLucideIcons, 100);

        // 标签切换函数
        function switchToQuestion() {
            document.getElementById('question-area').style.display = 'flex';
            document.getElementById('answer-area').style.display = 'none';
            document.getElementById('tab-question').style.background = '#1890ff';
            document.getElementById('tab-question').style.color = 'white';
            document.getElementById('tab-answer').style.background = '#f0f0f0';
            document.getElementById('tab-answer').style.color = '#666';

            // 确保题干版面使用默认的60:40宽度比例（焦点在左侧）
            adjustColumnWidths('question-editor');
        }

        function switchToAnswer() {
            document.getElementById('question-area').style.display = 'none';
            document.getElementById('answer-area').style.display = 'flex';
            document.getElementById('tab-question').style.background = '#f0f0f0';
            document.getElementById('tab-question').style.color = '#666';
            document.getElementById('tab-answer').style.background = '#1890ff';
            document.getElementById('tab-answer').style.color = 'white';

            // 确保答案版面使用默认的60:40宽度比例（焦点在左侧）
            adjustColumnWidths('answer-editor');
        }
    }

    // 加载全部内容
    function loadCurrentContent(problemId) {
        const loadBtn = document.getElementById('load-current');
        const originalText = loadBtn.innerHTML;
        loadBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; animation: spin 1s linear infinite;"></i> 加载中...';
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

                // 直接加载全部内容
                document.getElementById('question-editor').value = questionContent;
                document.getElementById('answer-editor').value = answerContent;
                showMessage('内容加载成功');

                // 更新预览
                updatePreviews();
            } else {
                showMessage('加载失败: ' + (result.errMsg || '未知错误'), false);
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
            showMessage('请输入要保存的内容', false);
            return;
        }

        const saveBtn = document.getElementById('save-all');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; animation: spin 1s linear infinite;"></i> 保存中...';
        saveBtn.disabled = true;

        saveEditedText(problemId, questionText, answerText, function(result) {
            if (result.success) {
                showMessage('保存成功');

                // 2秒后自动刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showMessage('保存失败: ' + (result.errMsg || result.error || '未知错误'), false);
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
        floatButton.innerHTML = '<i data-lucide="notebook-pen" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> 编辑器';
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

    // 初始化Lucide图标
    function initLucideIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // 初始化
    function init() {
        // 加载所有CSS样式
        loadStyles();

        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                addEditorButton();
                // 延迟初始化图标，确保DOM完全加载
                setTimeout(initLucideIcons, 100);
            });
        } else {
            addEditorButton();
            // 延迟初始化图标，确保DOM完全加载
            setTimeout(initLucideIcons, 100);
        }
    }

    // 启动脚本
    init();
})();