# 橙果错题本PC接口技术文档

## 概述

本文档详细说明橙果错题本PC端接口的使用方法，包括接口地址、参数格式、认证方式、功能分类等。

## 基础信息

### 接口基础URL
```
https://www.91chengguo.com/api/pc/getJsonResult.do
```

### 请求方式
- **方法**: POST
- **Content-Type**: `application/x-www-form-urlencoded`
- **认证**: 使用loginToken进行身份验证

### 通用参数格式
所有接口使用统一的参数结构：
```javascript
{
    service: '接口服务名称',
    param: JSON.stringify({
        loginToken: '用户登录token',
        // 其他接口特定参数
    })
}
```

## 核心接口详解

### 1. 获取题目详情接口

**服务名称**: `com.orange.note.query.problem.detail`

**用途**: 获取指定题目的详细信息

**请求参数**:
```javascript
{
    service: 'com.orange.note.query.problem.detail',
    param: JSON.stringify({
        loginToken: '用户登录token',
        problemId: '题目ID'
    })
}
```

**响应结构**:
```javascript
{
    "success": true,
    "content": {
        "problemId": "题目ID",
        "userProblemId": "用户题目ID",
        "question": "题目内容HTML",
        "answer": "答案内容HTML",
        "imgUrl": "题目图片URL",
        // 其他字段...
    }
}
```

### 2. 保存编辑内容接口

**服务名称**: `com.orange.note.problem.save.editedtext`

**用途**: 保存题目的编辑内容（题目和答案）

**请求参数**:
```javascript
{
    service: 'com.orange.note.problem.save.editedtext',
    param: JSON.stringify({
        loginToken: '用户登录token',
        problemId: '题目ID',
        newText: '新的题目内容HTML',
        newAnswerText: '新的答案内容HTML',
        noCache: true
    })
}
```

**响应结构**:
```javascript
{
    "success": true,
    "errMsg": null
    // 或失败时
    // "success": false,
    // "errMsg": "错误信息"
}
```

### 3. 刷新题目详情接口

**服务名称**: `com.orange.note.problem.rematch.text`

**用途**: 刷新题目详情，通常在保存后调用以确保数据同步

**请求参数**:
```javascript
{
    service: 'com.orange.note.problem.rematch.text',
    param: JSON.stringify({
        loginToken: '用户登录token',
        problemId: '题目ID'
    })
}
```

## 认证机制

### LoginToken获取方式

1. **Cookie方式**:
```javascript
function getLoginToken() {
    const cookieToken = document.cookie.match(/loginToken=([^;]+)/)?.[1];
    return cookieToken;
}
```

2. **本地存储方式**:
```javascript
// 从localStorage或GM_getValue获取
const loginToken = localStorage.getItem('loginToken') || GM_getValue('loginToken');
```

### 请求头设置
```javascript
headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://ctb.91chengguo.com",
    "Referer": "https://ctb.91chengguo.com/",
}
```

## 数据格式处理

### HTML到LaTeX转换

**场景**: 从橙果HTML格式转换为LaTeX格式

```javascript
function convertOrangeHtmlToLatex(html) {
    let result = html;
    
    // 处理行内公式
    result = result.replace(/<span class="CgTex">\$(.*?)\$<\/span>/g, '$1$');
    result = result.replace(/<span class="CgTex">(.*?)<\/span>/g, '$1$');
    
    // 处理行间公式
    result = result.replace(/<div><span class="CgTex">(.*?)<\/span><\/div>/g, '$$1$$');
    
    // 处理HTML标签
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<[^>]+>/g, '');
    
    // 处理HTML实体
    result = result.replace(/&nbsp;/g, ' ');
    result = result.replace(/&/g, '&');
    
    return result;
}
```

### LaTeX到HTML转换

**场景**: 从LaTeX格式转换为橙果HTML格式

```javascript
function convertLatexToOrangeHtml(text) {
    let result = text;
    
    // 处理行内公式：$...$ → <span class="CgTex">$...$</span>
    result = result.replace(/\$([^$]+)\$/g, '<span class="CgTex">$$1$</span>');
    
    // 处理行内公式：\(...\) → <span class="CgTex">$...$</span>
    result = result.replace(/\\\(([^]+?)\\\)/g, '<span class="CgTex">$$1$</span>');
    
    // 处理行间公式：$$...$$
    result = result.replace(/\$\$([^$]+)\$\$/g, '<div><span class="CgTex">$1</span></div>');
    
    // 处理行间公式：\[...\]
    result = result.replace(/\\\[([^]+?)\\\]/g, '<div><span class="CgTex">$1</span></div>');
    
    // 处理换行
    result = result.replace(/\n/g, '<br>');
    
    return result;
}
```

## 完整使用示例

### JavaScript实现

```javascript
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
    const convertedQuestion = convertLatexToOrangeHtml(questionText);
    const convertedAnswer = convertLatexToOrangeHtml(answerText);
    
    callPCApi('com.orange.note.problem.save.editedtext', {
        problemId,
        newText: convertedQuestion,
        newAnswerText: convertedAnswer,
        noCache: true
    }, callback);
}

// 刷新题目详情
function refreshProblemDetail(problemId, callback) {
    callPCApi('com.orange.note.problem.rematch.text', { problemId }, callback);
}
```

### 完整编辑流程

```javascript
function editProblemComplete(problemId, questionText, answerText) {
    // 1. 保存编辑内容
    saveEditedText(problemId, questionText, answerText, function(saveResult) {
        if (!saveResult.success) {
            console.error('保存失败:', saveResult.errMsg);
            return;
        }
        
        // 2. 刷新题目详情
        refreshProblemDetail(problemId, function(refreshResult) {
            if (!refreshResult.success) {
                console.warn('刷新失败，但内容已保存');
            } else {
                console.log('编辑流程完成');
            }
        });
    });
}
```

## 错误处理

### 常见错误类型

1. **认证失败**: loginToken无效或过期
2. **参数错误**: 缺少必要参数或参数格式错误
3. **权限不足**: 用户无权操作该题目
4. **网络错误**: 请求超时或连接失败

### 错误处理策略

```javascript
function handleApiError(result) {
    if (!result.success) {
        const errorMsg = result.errMsg || result.error || '未知错误';
        
        // 根据错误类型采取不同策略
        if (errorMsg.includes('loginToken')) {
            // 重新登录
            window.location.reload();
        } else if (errorMsg.includes('权限')) {
            alert('无权限执行此操作');
        } else {
            console.error('接口错误:', errorMsg);
            alert('操作失败: ' + errorMsg);
        }
        
        return true; // 表示已处理错误
    }
    
    return false; // 无错误
}
```

## 最佳实践

### 1. 请求优化
- 使用防抖处理频繁的保存操作
- 实现请求重试机制
- 添加请求超时处理

### 2. 数据安全
- 验证所有输入参数
- 处理HTML转义防止XSS攻击
- 备份重要数据

### 3. 用户体验
- 提供加载状态提示
- 实现撤销/重做功能
- 自动保存草稿

### 4. 调试技巧
```javascript
// 启用详细日志
const DEBUG = true;

function logApiCall(service, params, response) {
    if (DEBUG) {
        console.log(`API调用: ${service}`, {
            请求参数: params,
            响应结果: response
        });
    }
}
```

## 注意事项

1. **接口稳定性**: PC接口相对稳定，但仍需处理异常情况
2. **数据格式**: 确保LaTeX和HTML转换的正确性
3. **性能考虑**: 避免频繁调用刷新接口
4. **兼容性**: 考虑不同浏览器和环境的兼容性

## 扩展接口

除了上述核心接口，橙果PC端还提供了其他相关接口：

- 题目搜索接口
- 标签管理接口
- 图片上传接口
- 用户信息接口

这些接口的使用方式类似，主要通过不同的service名称来区分功能。

---

*最后更新: 2025-01-09*
*文档版本: v1.0*