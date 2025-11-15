# 转HTML自定义无序列表功能技术文档

## 概述

本技术文档详细说明了橙果错题编辑器脚本中转HTML功能的自定义无序列表转换机制。该功能将标准的HTML无序列表（`<ul>`/`<li>`）转换为自定义的缩进格式，使用空格缩进和`<strong>・</strong>`符号来表示列表项。

## 功能定位

- **位置**: [`scripts/cg-simple-editor.user.js`](scripts/cg-simple-editor.user.js:911-956)
- **函数名**: `convertUnorderedLists()`
- **调用时机**: 用户点击"转HTML"按钮时自动触发
- **依赖库**: 使用`marked`库进行Markdown到HTML的初步转换

## 核心转换逻辑

### 1. 转换流程

```javascript
输入: 标准HTML无序列表
    ↓
创建临时DOM容器解析HTML
    ↓
选择所有<ul>元素
    ↓
对每个<ul>计算缩进级别
    ↓
将<li>转换为缩进格式
    ↓
替换原始<ul>元素
    ↓
输出: 自定义格式的无序列表
```

### 2. 缩进级别计算

```javascript
function calculateIndentLevel(ul, tempDiv) {
    let parent = ul.parentElement;
    let indentLevel = 0;
    while (parent && parent !== tempDiv) {
        if (parent.tagName === 'UL' || parent.tagName === 'OL') {
            indentLevel++;
        }
        parent = parent.parentElement;
    }
    return indentLevel;
}
```

**缩进规则**:
- 一级列表: 无缩进
- 二级列表: 2个空格缩进  
- 三级列表: 4个空格缩进
- 以此类推...

### 3. 列表项转换

```javascript
lis.forEach(li => {
    const indent = '  '.repeat(indentLevel);  // 每个级别2个空格
    const content = li.innerHTML.trim();
    newContent += `${indent}<strong>・</strong> ${content}\n`;
});
```

## 转换示例

### 输入 (标准HTML)
```html
<ul>
  <li>第一项</li>
  <li>第二项
    <ul>
      <li>子项1</li>
      <li>子项2</li>
    </ul>
  </li>
  <li>第三项</li>
</ul>
```

### 输出 (自定义格式)
```
<strong>・</strong> 第一项
<strong>・</strong> 第二项
  <strong>・</strong> 子项1
  <strong>・</strong> 子项2
<strong>・</strong> 第三项
```

## 技术实现细节

### 1. DOM操作策略

```javascript
// 创建临时容器解析HTML
const tempDiv = document.createElement('div');
tempDiv.innerHTML = html;

// 处理所有无序列表
const uls = tempDiv.querySelectorAll('ul');
uls.forEach(ul => {
    // 计算缩进级别
    // 转换列表项
    // 替换原始元素
});
```

### 2. 元素替换机制

```javascript
// 创建包含新内容的span
const tempSpan = document.createElement('span');
tempSpan.innerHTML = newContent;

// 将span内的所有子节点移动到ul的位置
while (tempSpan.firstChild) {
    ul.parentNode.insertBefore(tempSpan.firstChild, ul);
}

// 移除原来的ul元素
ul.parentNode.removeChild(ul);
```

### 3. 嵌套列表支持

- 支持无限层级的嵌套列表
- 自动计算正确的缩进级别
- 保持列表项的层次结构

## 集成流程

### 1. 在转换按钮事件中调用

```javascript
case 'html':
    if (window.marked) {
        try {
            // 先使用marked默认解析
            convertedContent = marked.parse(sourceContent);
            
            // 对无序列表进行后处理
            convertedContent = convertUnorderedLists(convertedContent);
            
            message = '已使用marked将Markdown转换为HTML（自定义无序列表）';
        } catch (err) {
            // 错误处理
        }
    }
    break;
```

### 2. 错误处理机制

```javascript
try {
    convertedContent = marked.parse(sourceContent);
    convertedContent = convertUnorderedLists(convertedContent);
} catch (err) {
    console.error('Markdown转换HTML失败:', err);
    convertedContent = sourceContent;
    message = 'Markdown转换失败，保持原内容';
}
```

## 设计特点

### 1. 自定义符号
- 使用`<strong>・</strong>`作为列表符号
- 符号加粗显示，增强视觉效果
- 保持与橙果码风格的统一性

### 2. 缩进系统
- 基于CSS空格缩进
- 每个层级2个空格的缩进量
- 清晰的视觉层次结构

### 3. 格式保持
- 保留列表项内的HTML内容
- 支持列表项内的格式和样式
- 保持换行符的完整性

## 使用场景

### 1. 教育内容编辑
- 数学题目的步骤列表
- 知识点的层次结构
- 答案的分解说明

### 2. 错题整理
- 错题原因的层次分析
- 解题步骤的详细说明
- 知识点的分类整理

## 性能考虑

### 1. DOM操作优化
- 使用临时容器减少重绘
- 批量处理所有<ul>元素
- 最小化DOM操作次数

### 2. 内存管理
- 及时清理临时元素
- 避免内存泄漏
- 优化大文档处理

## 扩展性

### 1. 自定义符号
可扩展支持不同的列表符号：
```javascript
// 可配置的符号系统
const symbols = ['・', '●', '○', '■', '□'];
```

### 2. 缩进风格
支持不同的缩进配置：
```javascript
// 可配置的缩进系统
const indentConfig = {
    size: 2,        // 缩进空格数
    character: ' ', // 缩进字符
    unit: 'spaces'  // 缩进单位
};
```

## 总结

转HTML自定义无序列表功能提供了一个独特的列表格式化方案，特别适合教育场景下的内容编辑。通过将标准的HTML列表转换为自定义的缩进格式，既保持了内容的层次结构，又提供了更好的视觉呈现效果。

该功能的实现体现了对用户体验的深度思考，特别是在错题编辑和数学内容展示方面的特殊需求。