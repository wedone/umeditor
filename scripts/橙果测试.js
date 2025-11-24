// ==UserScript==
// @name         橙果标签更新测试工具（增强调试版）
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  集成签名算法 + 简化请求格式 + 增强调试信息 + 修复转义问题
// @author       You
// @match        https://ctb.91chengguo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.91chengguo.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ===================== 调试工具函数 =====================
    function logDebug(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;

        switch (type) {
            case 'error': console.error(logMessage); break;
            case 'warn': console.warn(logMessage); break;
            case 'debug': console.debug(logMessage); break;
            default: console.log(logMessage);
        }

        const logElement = document.getElementById('debugLog');
        if (logElement) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-${type}`;
            logEntry.textContent = logMessage;
            logElement.appendChild(logEntry);
            logElement.scrollTop = logElement.scrollHeight;
        }
    }

    // ===================== 集成cg.js的AuthInfo获取方法 =====================
    // 获取认证信息（来自cg.js）
    function getAuthInfo() {
        logDebug('开始从localStorage/sessionStorage/cookie获取loginToken...', 'debug');

        let loginToken = null;

        // 尝试从localStorage获取
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('loginToken')) {
                    loginToken = localStorage.getItem(key);
                    logDebug(`从localStorage找到loginToken (key: ${key}): ***${loginToken.slice(-4)}`, 'debug');
                    break;
                }
            }
        } catch (e) {
            logDebug(`无法访问localStorage: ${e.message}`, 'warn');
        }

        // 尝试从sessionStorage获取
        if (!loginToken) {
            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.includes('loginToken')) {
                        loginToken = sessionStorage.getItem(key);
                        logDebug(`从sessionStorage找到loginToken (key: ${key}): ***${loginToken.slice(-4)}`, 'debug');
                        break;
                    }
                }
            } catch (e) {
                logDebug(`无法访问sessionStorage: ${e.message}`, 'warn');
            }
        }

        // 尝试从cookie获取
        if (!loginToken) {
            try {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name && name.includes('loginToken')) {
                        loginToken = value;
                        logDebug(`从cookie找到loginToken (name: ${name}): ***${loginToken.slice(-4)}`, 'debug');
                        break;
                    }
                }
            } catch (e) {
                logDebug(`无法访问cookie: ${e.message}`, 'warn');
            }
        }

        if (!loginToken) {
            logDebug('未能从任何位置获取到loginToken', 'warn');
        }

        return { loginToken };
    }

    // 自动填充Token到UI
    function autoFillToken() {
        logDebug('执行自动填充Token...', 'debug');
        const authInfo = getAuthInfo();
        const tokenInput = document.getElementById('manual-login-token');

        if (tokenInput && authInfo.loginToken) {
            tokenInput.value = authInfo.loginToken;
            logDebug('已自动填充Token到输入框', 'debug');
        } else if (tokenInput) {
            tokenInput.placeholder = '未能自动获取Token，请手动输入';
            logDebug('自动填充Token失败，需要手动输入', 'warn');
        }

        return authInfo.loginToken;
    }

    // 获取loginToken（优先使用手动输入，否则自动获取）
    function getLoginToken() {
        // 优先使用手动输入的Token
        const manualToken = document.getElementById('manual-login-token')?.value?.trim();
        if (manualToken) {
            logDebug(`使用手动输入的loginToken: ***${manualToken.slice(-4)}`, 'debug');
            return manualToken;
        }

        // 自动获取Token
        const authInfo = getAuthInfo();
        return authInfo.loginToken || null;
    }

    // ===================== 其他工具函数 =====================
    function getProblemIdFromUrl() {
        const match = window.location.href.match(/edit\/(\d+)/) || window.location.href.match(/problem\/(\d+)/);
        const problemId = match ? match[1] : null;
        logDebug(`从URL解析到problemId: ${problemId || '未获取到'}`, 'debug');
        return problemId;
    }

    // 手动序列化参数（避免双重转义）
    function manualSerializeParams(contextStr, paramStr, service, t, sign) {
        const encodeParam = (key, value) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        };

        let result = encodeParam('context', contextStr) + '&' + encodeParam('param', paramStr);
        if (service) result += '&' + encodeParam('service', service);
        if (t) result += '&' + encodeParam('t', t);
        if (sign) result += '&' + encodeParam('sign', sign);

        return result;
    }

    // ===================== 签名算法 =====================
    // 密钥: LifeIsBeautifulWithGoodPeople@ShuCheng
    function MD5(str) {
        return CryptoJS.MD5(str).toString().toUpperCase();
    }

    function generateAppSign(params) {
        // 1. 确保包含时间戳
        if (!params.t) {
            params.t = Math.floor(Date.now() / 1000).toString();
        }

        // 2. 按key排序
        const sortedKeys = Object.keys(params).sort();

        // 3. 拼接字符串
        const parts = [];
        for (const key of sortedKeys) {
            parts.push(`${key}=${params[key]}`);
        }
        const str = parts.join('&');

        // 4. 添加密钥
        const signStr = str + '&secretKey=LifeIsBeautifulWithGoodPeople@ShuCheng';

        // 5. MD5加密（大写）
        const sign = MD5(signStr);

        logDebug('[签名生成] 原始字符串: ' + signStr, 'debug');
        logDebug('[签名生成] 生成Sign: ' + sign, 'debug');

        return sign;
    }

    // ===================== API调用函数 =====================
    function getProblemDetail(callback) {
        logDebug('开始获取错题详情信息...');

        const apiUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
        const loginToken = getLoginToken();
        const problemId = getProblemIdFromUrl();

        if (!loginToken) {
            callback('未获取到loginToken，请先输入或等待自动获取', null);
            return;
        }

        const paramData = JSON.stringify({
            loginToken: loginToken,
            problemId: problemId
        });

        const formData = new FormData();
        formData.append('service', 'com.orange.note.query.problem.detail');
        formData.append('param', paramData);
        formData.append('t', Math.floor(Date.now() / 1000).toString());

        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            data: formData,
            headers: {
                'Origin': 'https://ctb.91chengguo.com',
                'Referer': window.location.href
            },
            onload: function (response) {
                try {
                    const result = JSON.parse(response.responseText);
                    if (result.success && result.content) {
                        logDebug('获取错题详情成功');
                        callback(null, result.content);
                    } else {
                        logDebug(`获取错题详情失败: ${result?.errMsg || '未知错误'}`, 'error');
                        callback('获取详情失败: ' + (result?.errMsg || '未知错误'), null);
                    }
                } catch (e) {
                    logDebug(`解析错题详情失败: ${e.message}`, 'error');
                    callback('解析详情失败: ' + e.message, null);
                }
            },
            onerror: function (error) {
                logDebug(`详情接口请求错误: ${JSON.stringify(error)}`, 'error');
                callback('请求详情失败', null);
            }
        });
    }

    // 调用APP接口（修复转义问题 + 增强调试 + 签名）
    function callAppApi(callback) {
        // 获取配置
        const courseType = document.getElementById('appCourseType').value;

        logDebug(`==================== 开始调用APP接口 ====================`);
        logDebug(`当前时间: ${new Date().toLocaleString()}`);

        // 请求URL
        const apiUrl = 'https://www.91chengguo.com/api/getJsonResult.do';

        const loginToken = getLoginToken();
        const problemId = getProblemIdFromUrl();

        if (!loginToken) {
            const errorMsg = '未获取到loginToken，请先：\n1. 点击"自动获取Token"按钮\n2. 或手动输入Token\n3. 确保已登录网站';
            logDebug(errorMsg, 'error');
            callback(errorMsg, null);
            return;
        }

        if (!problemId) {
            const errorMsg = '未解析到problemId，请确保在错题详情页面';
            logDebug(errorMsg, 'error');
            callback(errorMsg, null);
            return;
        }

        // 构造context参数
        const contextObj = {
            deviceId: "889f1b3b-5000-44a5-acd2-02e1527129a7",
            deviceInfo: "bca8ba49ca144518",
            model: "2106118C",
            brand: "Xiaomi",
            os: "Android/13",
            version: "8.96",
            channelId: "vivo",
            source: "android"
        };

        // 构造param参数
        const paramObj = {
            problemId: problemId,
            courseType: courseType,
            continuous: "false",
            loginToken: loginToken
        };

        // 转换为字符串
        // 注意：APP抓包中os字段为 "Android\/13"，这里尝试模拟
        let contextStr = JSON.stringify(contextObj);
        contextStr = contextStr.replace("Android/13", "Android\\/13");

        const paramStr = JSON.stringify(paramObj);
        const service = 'com.orange.note.query.problem.tag.page';
        const t = Math.floor(Date.now() / 1000).toString();

        // 准备签名参数
        const signParams = {
            context: contextStr,
            param: paramStr,
            service: service,
            t: t
        };

        // 生成签名
        const sign = generateAppSign(signParams);

        // 手动序列化参数
        const postData = manualSerializeParams(contextStr, paramStr, service, t, sign);

        logDebug(`[请求参数] Context: ${contextStr}`, 'debug');
        logDebug(`[请求参数] Param: ${paramStr}`, 'debug');
        logDebug(`[请求参数] Sign: ${sign}`, 'debug');
        logDebug(`[请求Payload] 最终发送数据: ${postData}`, 'debug');

        // 请求头
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Client-API APP/91chengguo-Android APPVersion/8.96',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        };

        logDebug('[请求头] Headers: ' + JSON.stringify(headers, null, 2), 'debug');
        logDebug(`[请求地址] URL: ${apiUrl}`, 'debug');

        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            data: postData,
            headers: headers,
            responseType: 'text',
            timeout: 15000,
            onreadystatechange: function (response) {
                if (response.readyState === 4) {
                    logDebug(`[状态变化] 请求完成 (readyState=4)`, 'debug');
                }
            },
            onload: function (response) {
                logDebug(`==================== 收到响应 ====================`);
                logDebug(`[响应状态] Status: ${response.status} ${response.statusText}`);

                const responseLen = response.responseText ? response.responseText.length : 0;
                logDebug(`[响应内容] 长度: ${responseLen}字符`);

                if (response.responseText) {
                    const preview = response.responseText.substring(0, 1000);
                    logDebug(`[响应内容预览]:\n${preview}${responseLen > 1000 ? '\n... (剩余内容已截断)' : ''}`, 'debug');
                } else {
                    logDebug('[响应内容] 为空!', 'warn');
                }

                if (!response.responseText || response.responseText.trim() === '') {
                    const errorMsg = '接口返回空响应（状态码200但内容为空）';
                    logDebug(errorMsg, 'error');
                    callback(errorMsg, {
                        status: response.status,
                        empty: true
                    });
                    return;
                }

                try {
                    const result = JSON.parse(response.responseText);
                    logDebug('[JSON解析] 成功', 'debug');
                    callback(null, {
                        status: response.status,
                        data: result,
                        raw: response.responseText
                    });
                } catch (e) {
                    logDebug(`[JSON解析] 失败: ${e.message}`, 'error');
                    callback(`解析失败: ${e.message}`, {
                        status: response.status,
                        parseError: e.message,
                        raw: response.responseText
                    });
                }
            },
            onerror: function (error) {
                logDebug(`==================== 请求错误 ====================`, 'error');
                logDebug(`[错误信息] ${JSON.stringify(error)}`, 'error');
                callback(`请求失败: ${error.statusText || '网络错误'}`, {
                    status: error.status,
                    error: error
                });
            },
            ontimeout: function () {
                logDebug(`==================== 请求超时 ====================`, 'error');
                callback('请求超时（15秒）', { timeout: true });
            }
        });
    }

    // 核心更新函数（掌握程度）
    function updateMasteryLevel(params, callback) {
        logDebug('调用掌握程度更新接口，参数:', params);

        const apiUrl = 'https://www.91chengguo.com/api/pc/getJsonResult.do';
        const loginToken = getLoginToken();
        const problemId = getProblemIdFromUrl();
        const timestamp = Math.floor(Date.now() / 1000).toString();

        if (!loginToken) {
            callback({ success: false, error: '未获取到loginToken' });
            return;
        }

        const paramData = {
            problemId: problemId,
            gradeId: "",
            knowledgePoints: "",
            problemErrorCause: "",
            problemQuestionType: "",
            loginToken: loginToken,
            ...params
        };

        const formData = new FormData();
        formData.append('service', 'com.orange.note.student.pc.update.problem.tag');
        formData.append('param', JSON.stringify(paramData));
        formData.append('t', timestamp);

        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            data: formData,
            headers: {
                'Origin': 'https://ctb.91chengguo.com',
                'Referer': window.location.href
            },
            onload: function (response) {
                logDebug('原始响应:', response.responseText);
                try {
                    const result = JSON.parse(response.responseText);
                    callback(result);
                } catch (e) {
                    callback({
                        success: false,
                        error: e.message,
                        raw: response.responseText
                    });
                }
            },
            onerror: function (error) {
                callback({
                    success: false,
                    error: error.statusText
                });
            }
        });
    }

    // ===================== UI界面 =====================
    function createUI() {
        const problemId = getProblemIdFromUrl();
        if (!problemId) return;

        const container = document.createElement('div');
        container.id = 'tagTestPanel';
        container.innerHTML = `
            <h3>橙果标签更新测试工具（增强调试版）</h3>
            
            <!-- Token管理区域 -->
            <div class="token-section">
                <h4>认证信息</h4>
                <div class="form-group">
                    <label>LoginToken:</label>
                    <input type="text" id="manual-login-token" style="width: 400px;" placeholder="将自动从localStorage/sessionStorage/cookie获取...">
                    <button id="auto-get-token" class="small-btn">自动获取Token</button>
                    <button id="clear-token" class="small-btn">清空</button>
                </div>
                <div style="font-size: 12px; color: #666; margin-left: 185px;">
                    <strong>修复转义问题:</strong> os字段使用Android/13<br>
                    <strong>手动序列化:</strong> 避免双重URL编码<br>
                    <strong>增强调试:</strong> 显示完整的请求/响应信息
                </div>
            </div>
            
            <!-- 当前错题信息展示 -->
            <div class="info-section">
                <h4>当前错题信息</h4>
                <table class="info-table">
                    <tr>
                        <td class="label">错题ID:</td>
                        <td id="info-problemId"><strong>${problemId}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">题目名称:</td>
                        <td id="info-title">加载中...</td>
                    </tr>
                    <tr>
                        <td class="label">科目类型:</td>
                        <td id="info-courseType">加载中...</td>
                    </tr>
                    <tr>
                        <td class="label">当前掌握程度:</td>
                        <td id="info-masteryLevel">加载中...</td>
                    </tr>
                    <tr>
                        <td class="label">错题来源:</td>
                        <td id="info-problemSource">加载中...</td>
                    </tr>
                </table>
                <button id="refreshInfoBtn" class="small-btn">刷新信息</button>
            </div>
            
            <!-- APP接口测试区域 -->
            <div class="form-section">
                <h4>APP接口测试配置（修复版）</h4>
                
                <div class="form-group">
                    <label>科目类型:</label>
                    <select id="appCourseType">
                        <option value="chemistry">化学</option>
                        <option value="math">数学</option>
                        <option value="chinese">语文</option>
                        <option value="physics">物理</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>调试选项:</label>
                    <button id="show-request-details" class="small-btn">显示请求详情</button>
                    <button id="copy-request-format" class="small-btn">复制请求格式</button>
                </div>
                
                <div id="request-details" style="display: none; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; max-height: 200px; overflow-y: auto;">
                    <strong>请求详情将在这里显示...</strong>
                </div>
                
                <button id="testAppBtn" class="small-btn" style="background: #dc3545;">调用APP接口（修复版）</button>
                <button id="testRawBtn" class="small-btn">测试原始POST数据</button>
                
                <div class="form-group">
                    <label>接口返回结果:</label>
                    <pre id="apiResult" class="json-result"></pre>
                </div>
                
                <div class="form-group">
                    <label>调试信息:</label>
                    <div id="debugInfo" style="font-size: 12px; color: #666; margin-left: 185px;"></div>
                </div>
            </div>
            
            <!-- 掌握程度更新配置 -->
            <div class="form-section">
                <h4>掌握程度更新配置</h4>
                
                <div class="form-group">
                    <label>科目 (courseType):</label>
                    <select id="courseType">
                        <option value="chemistry">化学 (chemistry)</option>
                        <option value="math">数学 (math)</option>
                        <option value="physics">物理 (physics)</option>
                        <option value="chinese">语文 (chinese)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>错题来源 (problemSource):</label>
                    <input type="text" id="problemSource" value="7623644" placeholder="如:7623644">
                    <small>通信记录值: 7623644</small>
                </div>
                
                <div class="form-group">
                    <label>掌握程度 (masteryLevel):</label>
                    <select id="masteryLevel">
                        <option value="2">不懂 (2)</option>
                        <option value="3" selected>略懂 (3)</option>
                        <option value="4">基本懂 (4)</option>
                        <option value="5">完全懂 (5)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>自定义标签 (customerTagIds):</label>
                    <input type="text" id="customerTagIds" value="7623643" placeholder="如:7623643">
                    <small>通信记录值: 7623643</small>
                </div>
                
                <button id="updateBtn">更新掌握程度标签</button>
                <div id="result" class="result"></div>
            </div>
            
            <!-- 调试日志 -->
            <div class="debug-section">
                <h4>调试日志（详细版）</h4>
                <div id="debugLog" class="debug-log"></div>
                <button id="clearLogBtn" class="small-btn" style="margin-top: 10px;">清空日志</button>
                <button id="exportLogBtn" class="small-btn">导出日志</button>
            </div>
        `;

        GM_addStyle(`
            #tagTestPanel {
                position: fixed; top: 20px; right: 20px; width: 800px;
                background: white; border: 1px solid #ccc; border-radius: 8px;
                padding: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);
                z-index: 9999; font-family: Arial, sans-serif;
                max-height: 85vh;
                overflow-y: auto;
            }
            h3 { margin-top: 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h4 { color: #34495e; margin-bottom: 10px; border-left: 3px solid #3498db; padding-left: 8px; }
            
            .token-section {
                background: #e8f4f8;
                padding: 15px;
                border-radius: 6px;
                margin-bottom: 20px;
                border: 1px solid #bee5eb;
            }
            
            .info-section {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                margin-bottom: 20px;
                border: 1px solid #e9ecef;
            }
            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            .info-table td {
                padding: 6px 8px;
                border-bottom: 1px solid #e9ecef;
            }
            .info-table .label {
                width: 120px;
                font-weight: bold;
                color: #495057;
                background: #e9ecef;
            }
            
            .form-section {
                margin-bottom: 20px;
                padding: 15px;
                border: 1px solid #e9ecef;
                border-radius: 6px;
            }
            .form-group { margin: 12px 0; }
            label { display: inline-block; width: 180px; font-weight: bold; vertical-align: top; }
            select, input { padding: 6px; width: 220px; margin-right: 10px; }
            small { color: #666; font-size: 12px; display: block; margin-left: 185px; margin-top: 3px; }
            
            button {
                background: #28a745; color: white; border: none; padding: 10px 30px;
                border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 10px;
            }
            button:hover { background: #218838; }
            button:disabled { background: #6c757d; }
            .small-btn {
                padding: 4px 12px;
                font-size: 12px;
                background: #007bff;
                margin-right: 10px;
            }
            .small-btn:hover {
                background: #0069d9;
            }
            
            .result { 
                margin-top: 15px; padding: 12px; border-radius: 4px; 
                min-height: 60px;
            }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            
            .json-result {
                margin-top: 10px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 4px;
                border: 1px solid #e9ecef;
                max-height: 300px;
                overflow-y: auto;
                font-size: 12px;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            
            .debug-section {
                background: #f1f3f5;
                padding: 10px;
                border-radius: 6px;
            }
            .debug-log { 
                font-size: 12px; 
                height: 250px; 
                overflow-y: auto; 
                background: white; 
                padding: 8px; 
                border-radius: 4px; 
                margin-top: 5px;
                border: 1px solid #dee2e6;
            }
            .log-error { color: #dc3545; }
            .log-warn { color: #ffc107; }
            .log-debug { color: #6c757d; font-style: italic; }
        `);

        document.body.appendChild(container);
        logDebug('UI加载完成，使用修复版请求格式和增强调试');

        // 显示请求详情
        document.getElementById('show-request-details').addEventListener('click', () => {
            const detailsDiv = document.getElementById('request-details');
            const loginToken = getLoginToken() || 'your_login_token';
            const problemId = getProblemIdFromUrl() || '164405610';

            const contextObj = {
                deviceId: "889f1b3b-5000-44a5-acd2-02e1527129a7",
                deviceInfo: "bca8ba49ca144518",
                model: "2106118C",
                brand: "Xiaomi",
                os: "Android/13",
                version: "8.96",
                channelId: "vivo",
                source: "android"
            };

            const paramObj = {
                problemId: problemId,
                courseType: document.getElementById('appCourseType').value,
                continuous: "false",
                loginToken: loginToken
            };

            const contextStr = JSON.stringify(contextObj);
            const paramStr = JSON.stringify(paramObj);
            const postData = manualSerializeParams(contextStr, paramStr);

            detailsDiv.innerHTML = `
                <strong>Context对象:</strong><br>
                ${JSON.stringify(contextObj, null, 2)}<br><br>
                <strong>Param对象:</strong><br>
                ${JSON.stringify(paramObj, null, 2)}<br><br>
                <strong>最终POST数据:</strong><br>
                ${postData}<br><br>
                <strong>请求URL:</strong><br>
                https://www.91chengguo.com/api/getJsonResult.do
            `;
            detailsDiv.style.display = 'block';
        });

        // 绑定复制请求格式按钮
        document.getElementById('copy-request-format').addEventListener('click', () => {
            const loginToken = getLoginToken() || 'your_login_token';
            const problemId = getProblemIdFromUrl() || '164405610';

            const contextStr = `{"deviceId":"889f1b3b-5000-44a5-acd2-02e1527129a7","deviceInfo":"bca8ba49ca144518","model":"2106118C","brand":"Xiaomi","os":"Android/13","version":"8.96","channelId":"vivo","source":"android"}`;
            const paramStr = `{"problemId":"${problemId}","courseType":"chemistry","continuous":"false","loginToken":"${loginToken}"}`;

            const requestFormat = `context=${encodeURIComponent(contextStr)}&param=${encodeURIComponent(paramStr)}`;

            navigator.clipboard.writeText(requestFormat).then(() => {
                alert('请求格式已复制到剪贴板！');
            });
        });

        // 导出日志按钮
        document.getElementById('exportLogBtn').addEventListener('click', () => {
            const logContent = document.getElementById('debugLog').textContent;
            const blob = new Blob([logContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chengguo_debug_log_${new Date().getTime()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // 测试原始POST数据
        document.getElementById('testRawBtn').addEventListener('click', () => {
            const btn = document.getElementById('testRawBtn');
            const resultPre = document.getElementById('apiResult');

            btn.disabled = true;
            btn.textContent = '测试中...';

            const loginToken = getLoginToken();
            const problemId = getProblemIdFromUrl();

            if (!loginToken || !problemId) {
                resultPre.textContent = '缺少loginToken或problemId！';
                btn.disabled = false;
                btn.textContent = '测试原始POST数据';
                return;
            }

            // 手动构造完全匹配的POST数据
            const rawPostData = `context=%7B%22deviceId%22%3A%22889f1b3b-5000-44a5-acd2-02e1527129a7%22%2C%22deviceInfo%22%3A%22bca8ba49ca144518%22%2C%22model%22%3A%222106118C%22%2C%22brand%22%3A%22Xiaomi%22%2C%22os%22%3A%22Android%2F13%22%2C%22version%22%3A%228.96%22%2C%22channelId%22%3A%22vivo%22%2C%22source%22%3A%22android%22%7D&param=%7B%22problemId%22%3A%22${problemId}%22%2C%22courseType%22%3A%22chemistry%22%2C%22continuous%22%3A%22false%22%2C%22loginToken%22%3A%22${loginToken}%22%7D`;

            logDebug(`使用原始POST数据: ${rawPostData}`, 'debug');

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://www.91chengguo.com/api/getJsonResult.do',
                data: rawPostData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Client-API APP/91chengguo-Android APPVersion/8.96'
                },
                onload: function (response) {
                    btn.disabled = false;
                    btn.textContent = '测试原始POST数据';
                    resultPre.textContent = `原始POST数据测试结果：
状态码: ${response.status}
响应内容: ${response.responseText || '空响应'}
响应头: ${response.responseHeaders}`;
                    logDebug(`原始POST数据测试完成，状态码: ${response.status}`, 'debug');
                },
                onerror: function (error) {
                    btn.disabled = false;
                    btn.textContent = '测试原始POST数据';
                    resultPre.textContent = `原始POST数据测试失败：
错误: ${JSON.stringify(error)}`;
                }
            });
        });

        // 页面加载后自动获取Token
        setTimeout(() => {
            autoFillToken();
            // 自动加载错题信息
            loadProblemInfo();
        }, 1000);

        // 加载错题信息
        function loadProblemInfo() {
            getProblemDetail((err, detail) => {
                if (!err && detail) {
                    document.getElementById('info-title').textContent = detail.title || '未命名题目';
                    document.getElementById('info-courseType').textContent = detail.courseType || '未知';

                    let masteryText = '未知';
                    let masteryValue = '3';
                    let sourceText = '未知';

                    if (detail.tagList && detail.tagList.length > 0) {
                        const masteryTag = detail.tagList.find(tag =>
                            tag.paramName === 'masteryLevel' || tag.name.includes('懂')
                        );
                        if (masteryTag) {
                            masteryText = masteryTag.name;
                            const masteryMap = {
                                '不懂': '2',
                                '略懂': '3',
                                '基本懂': '4',
                                '完全懂': '5'
                            };
                            masteryValue = masteryMap[masteryText] || '3';
                        }

                        const sourceTag = detail.tagList.find(tag => tag.paramName === 'problemSource');
                        if (sourceTag) {
                            sourceText = sourceTag.name + (sourceTag.tagValue ? ` (${sourceTag.tagValue})` : '');
                        }
                    }

                    document.getElementById('info-masteryLevel').textContent = masteryText;
                    document.getElementById('info-problemSource').textContent = sourceText;

                    if (detail.courseType) {
                        document.getElementById('courseType').value = detail.courseType;
                        document.getElementById('appCourseType').value = detail.courseType;
                    }
                    document.getElementById('masteryLevel').value = masteryValue;

                    const sourceTag = detail.tagList?.find(tag => tag.paramName === 'problemSource');
                    if (sourceTag && sourceTag.tagValue) {
                        document.getElementById('problemSource').value = sourceTag.tagValue;
                    }
                } else {
                    document.getElementById('info-title').textContent = err || '加载失败';
                    document.getElementById('info-courseType').textContent = 'N/A';
                    document.getElementById('info-masteryLevel').textContent = 'N/A';
                    document.getElementById('info-problemSource').textContent = 'N/A';
                }
            });
        }

        // 绑定Token相关按钮事件
        document.getElementById('auto-get-token').addEventListener('click', () => {
            logDebug('手动触发自动获取Token...');
            const token = autoFillToken();
            if (token) {
                alert('成功获取Token！');
            } else {
                alert('未能自动获取Token，请手动输入！');
            }
        });

        document.getElementById('clear-token').addEventListener('click', () => {
            document.getElementById('manual-login-token').value = '';
            logDebug('已清空Token输入框');
        });

        // 其他按钮事件
        document.getElementById('refreshInfoBtn').addEventListener('click', loadProblemInfo);
        document.getElementById('clearLogBtn').addEventListener('click', () => {
            document.getElementById('debugLog').innerHTML = '';
            logDebug('日志已清空');
        });

        // 单次调用APP接口
        document.getElementById('testAppBtn').addEventListener('click', () => {
            const btn = document.getElementById('testAppBtn');
            const resultPre = document.getElementById('apiResult');
            const debugInfoDiv = document.getElementById('debugInfo');

            btn.disabled = true;
            btn.textContent = '请求中...';
            resultPre.textContent = '正在调用APP接口（修复转义问题 + 增强调试）...';
            resultPre.style.color = '#6c757d';
            debugInfoDiv.textContent = '';

            callAppApi((err, data) => {
                btn.disabled = false;
                btn.textContent = '调用APP接口（修复版）';

                if (err) {
                    resultPre.textContent = `调用失败: ${err}
                        
                        详细响应信息:
                        ${JSON.stringify(data || {}, null, 2)}
                        
                        可能的原因:
                        1. 响应为空（服务器返回200但无内容）
                        2. 响应不是JSON格式（可能是HTML/文本）
                        3. 请求被服务器拦截或重定向
                        4. Token无效或已过期
                        
                        建议操作:
                        1. 点击"显示请求详情"检查参数格式
                        2. 使用"测试原始POST数据"功能
                        3. 导出日志查看完整调试信息
                        4. 尝试重新登录获取新的Token`;
                    resultPre.style.color = '#dc3545';
                    debugInfoDiv.textContent = `错误: ${err} | 时间: ${new Date().toLocaleTimeString()}`;
                    logDebug(`APP接口调用失败: ${err}`, 'error');
                } else {
                    resultPre.textContent = `调用成功！
状态码: ${data.status}
响应数据:
${JSON.stringify(data.data || data, null, 2)}

原始响应:
${data.raw || '无原始数据'}`;
                    resultPre.style.color = data.data?.success ? '#28a745' : '#ffc107';
                    debugInfoDiv.textContent = `成功 | 状态码: ${data.status} | 响应长度: ${data.raw ? data.raw.length : 0}字符 | 时间: ${new Date().toLocaleTimeString()}`;
                    logDebug('APP接口调用成功（修复版）', 'debug');
                }
            });
        });

        // 掌握程度更新
        document.getElementById('updateBtn').addEventListener('click', () => {
            const btn = document.getElementById('updateBtn');
            const resultDiv = document.getElementById('result');

            btn.disabled = true;
            btn.textContent = '更新中...';
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<div style="text-align:center;">正在更新掌握程度标签...</div>';

            const updateParams = {
                courseType: document.getElementById('courseType').value,
                problemSource: document.getElementById('problemSource').value.trim(),
                masteryLevel: document.getElementById('masteryLevel').value,
                customerTagIds: document.getElementById('customerTagIds').value.trim()
            };

            updateMasteryLevel(updateParams, (result) => {
                btn.disabled = false;
                btn.textContent = '更新掌握程度标签';

                if (result && result.success) {
                    resultDiv.className = 'result success';
                    resultDiv.innerHTML = `✅ <strong>掌握程度更新成功！</strong><br>
                            errCode: <code>${result.errCode || '0'}</code><br>
                            errMsg: ${result.errMsg || '操作成功'}<br>
                            <small>已自动刷新信息...</small>`;
                    logDebug('掌握程度标签更新成功！');

                    setTimeout(loadProblemInfo, 1000);
                } else {
                    resultDiv.className = 'result error';
                    resultDiv.innerHTML = `❌ <strong>掌握程度更新失败！</strong><br>
                            ${result?.errMsg || result?.error || '未知错误'}<br>
                            ${result?.errCode ? `错误码: ${result.errCode}` : ''}<br>
                            ${result?.raw ? `<small>原始响应: ${result.raw.substring(0, 150)}...</small>` : ''}<br>
                            <small>请检查Token是否有效！</small>`;
                    logDebug(`掌握程度更新失败: ${result?.errMsg || result?.error}`, 'error');
                }
            });
        });
    }

    // 初始化
    window.addEventListener('load', () => {
        logDebug('页面加载完成，初始化增强调试版脚本...', 'debug');
        logDebug('检测到的URL: ' + window.location.href, 'debug');

        if (getProblemIdFromUrl()) {
            createUI();
        } else {
            logDebug('未检测到错题ID，不加载UI', 'warn');
        }
    });
})();