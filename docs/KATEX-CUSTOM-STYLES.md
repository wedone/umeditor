# KaTeX 自定义样式指南

## 概述

从 v9.0.6 开始，脚本支持自定义 KaTeX 渲染的公式样式，可以修改分数、根号、上下标等元素的外观。

## 快速开始

### 1. 启用自定义样式

在 `scripts/um-inject.user.js` 中找到 `KATEX_CUSTOM_STYLES` 配置：

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: false,  // ✨ 改为 true 启用
    css: `...`
};
```

### 2. 修改样式

编辑 `css` 字符串中的样式规则。

## 常见样式修改

### 1. 分数样式

#### 分数线粗细
```css
.katex .mfrac .frac-line {
    border-bottom-width: 0.05em !important;  /* 默认 0.04em */
}
```

**效果对比**：
- `0.03em` - 更细的分数线
- `0.04em` - KaTeX 默认
- `0.05em` - 更粗的分数线（推荐，更清晰）
- `0.06em` - 很粗的分数线

#### 分子分母字体大小
```css
.katex .mfrac > .vlist-t .sizing {
    font-size: 0.9em !important;  /* 默认 0.7em */
}
```

**效果对比**：
- `0.6em` - 更小（公式更紧凑）
- `0.7em` - KaTeX 默认
- `0.8em` - 稍大（推荐，更易读）
- `0.9em` - 更大
- `1.0em` - 与主字体一样大（不推荐，分数会很大）

**示例**：
```latex
$\frac{a+b}{c+d}$
```
- 默认（0.7em）：a+b 和 c+d 较小
- 0.9em：a+b 和 c+d 更大更清晰

### 2. 根号样式

#### 根号线粗细
```css
.katex .sqrt .sqrt-line {
    border-top-width: 0.06em !important;  /* 默认 0.04em */
}
```

#### 根号次数大小（如 ³√）
```css
.katex .sqrt > .root {
    font-size: 0.8em !important;  /* 默认 0.6em */
}
```

**示例**：
```latex
$\sqrt{x}$           # 平方根
$\sqrt[3]{x}$        # 立方根（3 的大小由此控制）
```

### 3. 上下标样式

#### 上下标字体大小
```css
.katex .msupsub {
    font-size: 0.75em !important;  /* 默认 0.7em */
}
```

**示例**：
```latex
$x^2$         # 上标
$a_1$         # 下标
$x_1^2$       # 同时有上下标
```

### 4. 大型运算符（积分、求和等）

```css
.katex .mop.op-symbol.large-op {
    font-size: 1.1em !important;  /* 默认 1em */
}
```

**影响的符号**：
- `∫` (积分)
- `Σ` (求和)
- `Π` (连乘)
- `∐` (余积)

**示例**：
```latex
$$\int_0^1 x dx$$
$$\sum_{i=1}^n a_i$$
```

### 5. 括号样式

#### 大括号粗细
```css
.katex .delimsizing {
    font-weight: bold !important;  /* 默认 normal */
}
```

#### 括号大小调整
```css
.katex .sizing.reset-size1.size1 {
    font-size: 1.05em !important;
}
```

### 6. 矩阵/数组样式

#### 单元格间距
```css
.katex .arraycolsep {
    width: 0.6em !important;  /* 默认 0.5em，列间距 */
}

.katex .mtr {
    margin: 0.15em 0 !important;  /* 行间距 */
}
```

**示例**：
```latex
$$\begin{pmatrix}
1 & 2 \\
3 & 4
\end{pmatrix}$$
```

## 完整配置示例

### 示例 1: 清晰易读配置（推荐）

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: `
        /* 分数：更粗的线、更大的字 */
        .katex .mfrac .frac-line {
            border-bottom-width: 0.05em !important;
        }
        .katex .mfrac > .vlist-t .sizing {
            font-size: 0.85em !important;
        }
        
        /* 根号：更粗的线 */
        .katex .sqrt .sqrt-line {
            border-top-width: 0.05em !important;
        }
        
        /* 上下标：稍大一点 */
        .katex .msupsub {
            font-size: 0.75em !important;
        }
    `
};
```

### 示例 2: 紧凑配置

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: `
        /* 分数：更小的字 */
        .katex .mfrac > .vlist-t .sizing {
            font-size: 0.6em !important;
        }
        
        /* 上下标：更小 */
        .katex .msupsub {
            font-size: 0.65em !important;
        }
        
        /* 大型运算符：稍小 */
        .katex .mop.op-symbol.large-op {
            font-size: 0.95em !important;
        }
    `
};
```

### 示例 3: 粗体强调配置

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: `
        /* 所有线条加粗 */
        .katex .frac-line,
        .katex .sqrt-line {
            border-width: 0.06em !important;
        }
        
        /* 运算符加粗 */
        .katex .mbin,
        .katex .mrel {
            font-weight: 600 !important;
        }
        
        /* 括号加粗 */
        .katex .delimsizing {
            font-weight: bold !important;
        }
    `
};
```

## KaTeX CSS 类名参考

### 常用类名

| 类名 | 元素 | 说明 |
|------|------|------|
| `.katex` | 根容器 | 所有 KaTeX 渲染内容 |
| `.mfrac` | 分数 | 分数容器 |
| `.frac-line` | 分数线 | 分数的横线 |
| `.sizing` | 尺寸控制 | 分子分母等的大小 |
| `.sqrt` | 根号 | 根号容器 |
| `.sqrt-line` | 根号线 | 根号的顶部横线 |
| `.root` | 根号次数 | 如 ³√ 中的 3 |
| `.msupsub` | 上下标 | 上标和下标容器 |
| `.msup` | 上标 | 仅上标 |
| `.msub` | 下标 | 仅下标 |
| `.mop` | 运算符 | 如 sin, cos, lim |
| `.mbin` | 二元运算符 | +, -, ×, ÷ |
| `.mrel` | 关系符号 | =, <, >, ≤, ≥ |
| `.mord` | 普通字符 | 字母、数字 |
| `.mopen` / `.mclose` | 括号 | 左右括号 |
| `.delimsizing` | 可变括号 | \left, \right 括号 |
| `.arraycolsep` | 数组列间距 | 矩阵、表格 |
| `.mtr` | 数组行 | 矩阵、表格的行 |

### 尺寸类名

| 类名 | 说明 |
|------|------|
| `.sizing` | 通用尺寸控制 |
| `.reset-size1` | 重置到默认大小 |
| `.size1` ~ `.size11` | 不同的预定义大小 |

### 查找类名的方法

1. 在脚本中插入公式
2. 打开浏览器开发者工具（F12）
3. 在控制台运行：
   ```javascript
   document.querySelector('.katex').outerHTML
   ```
4. 查看生成的 HTML 结构和类名
5. 根据类名编写 CSS 规则

## 调试技巧

### 1. 实时预览

启用调试模式查看样式效果：

```javascript
var DEBUG_MODE = true;
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: `
        /* 添加边框查看元素范围 */
        .katex .mfrac {
            border: 1px solid red !important;
        }
        .katex .sizing {
            background: rgba(255,0,0,0.1) !important;
        }
    `
};
```

### 2. 对比测试

创建两个公式，一个用默认样式，一个用自定义样式：

```javascript
// 临时禁用自定义样式
KATEX_CUSTOM_STYLES.enabled = false;
// 插入公式 A

// 启用自定义样式
KATEX_CUSTOM_STYLES.enabled = true;
// 插入公式 B

// 对比两者效果
```

### 3. 浏览器检查元素

在生成的图片插入编辑器后：
1. 右键点击公式图片
2. 选择"在新标签页中打开图片"
3. 查看图片效果
4. 调整 CSS → 重新插入 → 对比

## 注意事项

### 1. 使用 `!important`

KaTeX 的默认样式优先级很高，必须使用 `!important` 覆盖：

```css
/* ❌ 无效 */
.katex .frac-line {
    border-bottom-width: 0.05em;
}

/* ✅ 有效 */
.katex .frac-line {
    border-bottom-width: 0.05em !important;
}
```

### 2. 样式作用域

自定义样式**仅影响脚本生成的图片**，不影响：
- 编辑器中的 MathQuill 公式（简单公式）
- 官方已有的公式图片
- 其他编辑器功能

### 3. 性能影响

- 自定义样式会增加约 10-20ms 的渲染时间（注入/移除样式）
- 对整体性能影响微乎其微
- 可以放心使用

### 4. 兼容性

- 支持所有现代浏览器
- CSS 规则在 html2canvas 截图时生效
- 不依赖浏览器特定特性

## 常见问题

### Q1: 修改后没有效果？

**可能原因**：
1. `enabled` 未设为 `true`
2. 没有使用 `!important`
3. CSS 选择器不正确

**解决方法**：
1. 检查 `KATEX_CUSTOM_STYLES.enabled = true`
2. 所有规则加上 `!important`
3. 使用浏览器检查元素找到正确的类名

### Q2: 只想修改某些公式？

**方法 1**: 动态切换
```javascript
// 插入普通公式前
KATEX_CUSTOM_STYLES.enabled = false;

// 插入需要自定义样式的公式前
KATEX_CUSTOM_STYLES.enabled = true;
```

**方法 2**: 使用条件 CSS
```javascript
css: `
    /* 只在显示模式（$$...$$）应用 */
    .katex-display .mfrac .frac-line {
        border-bottom-width: 0.05em !important;
    }
`
```

### Q3: 如何恢复默认样式？

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: false,  // 禁用即可
    css: ``
};
```

或者删除所有 CSS 规则：

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: ``  // 空字符串
};
```

## 高级技巧

### 1. 条件样式（根据公式内容）

虽然 CSS 无法直接根据内容判断，但可以通过多次渲染实现：

```javascript
// 修改 renderFormulaToImage 函数
if(latex.includes('\\frac')){
    // 启用分数专用样式
    KATEX_CUSTOM_STYLES.css = `...`;
}
```

### 2. 主题切换

```javascript
var THEMES = {
    default: `/* KaTeX 默认 */`,
    
    clear: `
        /* 清晰主题 */
        .katex .mfrac .frac-line {
            border-bottom-width: 0.05em !important;
        }
        .katex .mfrac > .vlist-t .sizing {
            font-size: 0.85em !important;
        }
    `,
    
    compact: `
        /* 紧凑主题 */
        .katex .mfrac > .vlist-t .sizing {
            font-size: 0.6em !important;
        }
    `
};

// 切换主题
KATEX_CUSTOM_STYLES.css = THEMES.clear;
```

### 3. 响应式样式（根据 displayScale）

```javascript
var scale = IMAGE_SIZE_CONFIG.displayScale || 0.72;

KATEX_CUSTOM_STYLES.css = `
    .katex .mfrac > .vlist-t .sizing {
        font-size: ${0.7 / scale}em !important;
    }
`;
```

## 推荐配置

### 适合高中数学

```javascript
var KATEX_CUSTOM_STYLES = {
    enabled: true,
    css: `
        /* 分数清晰可读 */
        .katex .mfrac .frac-line {
            border-bottom-width: 0.05em !important;
        }
        .katex .mfrac > .vlist-t .sizing {
            font-size: 0.8em !important;
        }
        
        /* 根号清晰 */
        .katex .sqrt .sqrt-line {
            border-top-width: 0.05em !important;
        }
        
        /* 上下标适中 */
        .katex .msupsub {
            font-size: 0.75em !important;
        }
        
        /* 运算符稍大 */
        .katex .mop.op-symbol.large-op {
            font-size: 1.05em !important;
        }
    `
};
```

## 总结

通过 `KATEX_CUSTOM_STYLES` 配置，你可以：
- ✅ 自定义分数、根号、上下标等样式
- ✅ 调整线条粗细、字体大小
- ✅ 提高公式清晰度和可读性
- ✅ 保持与橙果官方尺寸一致

**建议**：
1. 从推荐配置开始
2. 根据实际效果微调
3. 保存常用配置作为模板
