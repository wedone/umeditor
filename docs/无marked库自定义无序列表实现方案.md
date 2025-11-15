# 无marked库自定义无序列表实现方案

## 概述

本文档详细说明了在不依赖marked库的情况下，实现自定义无序列表功能的多种技术方案。这些方案可以直接处理Markdown格式或HTML格式的输入，转换为橙果错题编辑器所需的自定义格式。

## 方案一：纯JavaScript正则表达式解析

### 1.1 直接Markdown到自定义格式转换

```javascript
function convertMarkdownToCustomList(markdown) {
    if (!markdown) return markdown;
    
    const lines = markdown.split('\n');
    let result = [];
    let currentIndent = 0;
    
    for (let line of lines) {
        // 匹配Markdown无序列表项（-、*、+开头）
        const listMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
        
        if (listMatch) {
            const indent = listMatch[1];
            const marker = listMatch[2];
            const content = listMatch[3];
            
            // 计算缩进级别（每2个空格为一级）
            const indentLevel = Math.floor(indent.length / 2);
            
            // 生成自定义格式
            const customIndent = '  '.repeat(indentLevel);
            result.push(`${customIndent}<strong>・</strong> ${content}`);
        } else {
            // 非列表项，保持原样
            result.push(line);
        }
    }
    
    return result.join('\n');
}
```

### 1.2 增强版Markdown解析器

```javascript
function advancedMarkdownParser(markdown) {
    const lines = markdown.split('\n');
    const result = [];
    let inList = false;
    let currentIndent = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测列表项
        const listItemMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
        
        if (listItemMatch) {
            const indent = listItemMatch[1];
            const content = listItemMatch[3];
            const indentLevel = Math.floor(indent.length / 2);
            
            // 处理列表开始和结束
            if (!inList) {
                inList = true;
                currentIndent = indentLevel;
            }
            
            // 生成自定义格式
            const customIndent = '  '.repeat(indentLevel);
            result.push(`${customIndent}<strong>・</strong> ${content}`);
        } else {
            // 非列表项
            if (inList && line.trim() === '') {
                // 空行结束列表
                inList = false;
            }
            result.push(line);
        }
    }
    
    return result.join('\n');
}
```

## 方案二：DOM操作替代方案

### 2.1 轻量级HTML解析器

```javascript
function lightweightHtmlParser(html) {
    if (!html) return html;
    
    // 创建临时容器
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 处理无序列表
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
        
        // 转换列表项
        const lis = ul.querySelectorAll('li');
        let newContent = '';
        
        lis.forEach(li => {
            const indent = '  '.repeat(indentLevel);
            const content = li.innerHTML.trim();
            newContent += `${indent}<strong>・</strong> ${content}\n`;
        });
        
        // 替换ul元素
        const textNode = document.createTextNode(newContent);
        ul.parentNode.replaceChild(textNode, ul);
    });
    
    return tempDiv.innerHTML;
}
```

### 2.2 混合解析方案

```javascript
function hybridParser(input) {
    // 检测输入类型（HTML或Markdown）
    const isHtml = /<[a-z][\s\S]*>/i.test(input);
    
    if (isHtml) {
        return lightweightHtmlParser(input);
    } else {
        return advancedMarkdownParser(input);
    }
}
```

## 方案三：基于状态机的解析器

### 3.1 状态机实现

```javascript
function stateMachineParser(input) {
    const lines = input.split('\n');
    const result = [];
    
    let state = 'text'; // text, list, sublist
    let currentIndent = 0;
    let stack = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const originalLine = lines[i];
        
        // 检测缩进
        const leadingSpaces = originalLine.match(/^(\s*)/)[1].length;
        const indentLevel = Math.floor(leadingSpaces / 2);
        
        // 状态转换逻辑
        if (line.match(/^[-*+]\s+/)) {
            // 列表项
            const content = line.replace(/^[-*+]\s+/, '');
            
            if (state === 'text') {
                state = 'list';
                currentIndent = indentLevel;
            }
            
            // 处理缩进级别变化
            if (indentLevel > currentIndent) {
                stack.push(currentIndent);
                currentIndent = indentLevel;
            } else if (indentLevel < currentIndent) {
                while (stack.length > 0 && stack[stack.length - 1] >= indentLevel) {
                    stack.pop();
                }
                currentIndent = stack.length > 0 ? stack[stack.length - 1] : 0;
            }
            
            // 生成输出
            const customIndent = '  '.repeat(currentIndent);
            result.push(`${customIndent}<strong>・</strong> ${content}`);
        } else {
            // 非列表项
            if (state === 'list' && line === '') {
                state = 'text';
                stack = [];
                currentIndent = 0;
            }
            result.push(originalLine);
        }
    }
    
    return result.join('\n');
}
```

## 方案四：完整的功能模块

### 4.1 完整的转换函数

```javascript
class CustomListConverter {
    constructor(options = {}) {
        this.options = {
            indentSize: 2,
            listSymbol: '・',
            symbolTag: 'strong',
            ...options
        };
    }
    
    convert(input) {
        // 检测输入类型
        if (this.isHtml(input)) {
            return this.convertHtml(input);
        } else {
            return this.convertMarkdown(input);
        }
    }
    
    isHtml(input) {
        return /<[a-z][\s\S]*>/i.test(input);
    }
    
    convertHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        this.processHtmlLists(tempDiv);
        return tempDiv.innerHTML;
    }
    
    convertMarkdown(markdown) {
        const lines = markdown.split('\n');
        const result = [];
        let listStack = [];
        
        for (let line of lines) {
            const processedLine = this.processMarkdownLine(line, listStack);
            result.push(processedLine);
        }
        
        return result.join('\n');
    }
    
    processHtmlLists(element) {
        const uls = element.querySelectorAll('ul');
        
        uls.forEach(ul => {
            const indentLevel = this.calculateHtmlIndentLevel(ul, element);
            const newContent = this.convertHtmlListItems(ul, indentLevel);
            
            // 替换ul元素
            const tempSpan = document.createElement('span');
            tempSpan.innerHTML = newContent;
            
            while (tempSpan.firstChild) {
                ul.parentNode.insertBefore(tempSpan.firstChild, ul);
            }
            
            ul.parentNode.removeChild(ul);
        });
    }
    
    calculateHtmlIndentLevel(element, root) {
        let level = 0;
        let parent = element.parentElement;
        
        while (parent && parent !== root) {
            if (parent.tagName === 'UL' || parent.tagName === 'OL') {
                level++;
            }
            parent = parent.parentElement;
        }
        
        return level;
    }
    
    convertHtmlListItems(ul, indentLevel) {
        const lis = ul.querySelectorAll('li');
        let result = '';
        
        lis.forEach(li => {
            const indent = ' '.repeat(indentLevel * this.options.indentSize);
            const content = li.innerHTML.trim();
            const symbol = `<${this.options.symbolTag}>${this.options.listSymbol}</${this.options.symbolTag}>`;
            
            result += `${indent}${symbol} ${content}\n`;
        });
        
        return result;
    }
    
    processMarkdownLine(line, listStack) {
        const listMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
        
        if (listMatch) {
            const indent = listMatch[1];
            const content = listMatch[3];
            const indentLevel = Math.floor(indent.length / this.options.indentSize);
            
            // 更新堆栈状态
            this.updateListStack(listStack, indentLevel);
            
            // 生成输出
            const customIndent = ' '.repeat(indentLevel * this.options.indentSize);
            const symbol = `<${this.options.symbolTag}>${this.options.listSymbol}</${this.options.symbolTag}>`;
            
            return `${customIndent}${symbol} ${content}`;
        } else {
            // 非列表项，重置堆栈
            if (line.trim() !== '') {
                listStack.length = 0;
            }
            return line;
        }
    }
    
    updateListStack(stack, currentLevel) {
        // 移除比当前级别高的堆栈项
        while (stack.length > 0 && stack[stack.length - 1] >= currentLevel) {
            stack.pop();
        }
        
        // 添加当前级别
        if (stack.length === 0 || stack[stack.length - 1] < currentLevel) {
            stack.push(currentLevel);
        }
    }
}

// 使用示例
const converter = new CustomListConverter();
const result = converter.convert(inputText);
```

## 性能对比

### 5.1 各方案性能特点

| 方案 | 解析速度 | 内存占用 | 功能完整性 | 维护难度 |
|------|----------|----------|------------|----------|
| 正则表达式 | 快 | 低 | 中等 | 中等 |
| DOM操作 | 中等 | 中等 | 高 | 低 |
| 状态机 | 快 | 低 | 高 | 高 |
| 完整模块 | 中等 | 中等 | 最高 | 中等 |

### 5.2 推荐使用场景

1. **简单需求**：方案一（正则表达式）
   - 输入格式固定
   - 性能要求高
   - 功能需求简单

2. **中等需求**：方案二（DOM操作）
   - 需要处理HTML输入
   - 对性能有一定要求
   - 需要较好的兼容性

3. **复杂需求**：方案四（完整模块）
   - 需要处理多种输入格式
   - 需要高度可配置
   - 长期维护需求

## 集成到现有代码

### 6.1 替换marked的方案

```javascript
case 'html':
    // 使用自定义解析器替代marked
    const converter = new CustomListConverter();
    convertedContent = converter.convert(sourceContent);
    message = '已转换为自定义列表格式';
    break;
```

### 6.2 渐进式替换策略

1. **第一阶段**：实现基本功能，使用方案一
2. **第二阶段**：增强功能，使用方案二或方案三
3. **第三阶段**：完整替换，使用方案四

## 测试用例

### 7.1 基本测试

```javascript
const testCases = [
    {
        input: "- 项目1\n- 项目2\n  - 子项目1",
        expected: "<strong>・</strong> 项目1\n<strong>・</strong> 项目2\n  <strong>・</strong> 子项目1"
    },
    {
        input: "<ul><li>项目1</li><li>项目2</li></ul>",
        expected: "<strong>・</strong> 项目1\n<strong>・</strong> 项目2"
    }
];
```

## 总结

不使用marked库实现自定义无序列表功能是完全可行的，提供了多种技术方案选择。根据具体需求可以选择：

- **简单快速**：正则表达式方案
- **功能完整**：DOM操作方案  
- **高性能**：状态机方案
- **可扩展**：完整模块方案

这些方案都能够在保持原有功能的基础上，减少外部依赖，提高代码的自主控制能力。