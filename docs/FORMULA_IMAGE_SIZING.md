# 公式图片尺寸控制技术方案

## 📋 目录

- [问题背景](#问题背景)
- [技术方案对比](#技术方案对比)
- [最佳实践](#最佳实践)
- [配置说明](#配置说明)
- [实现细节](#实现细节)
- [常见问题](#常见问题)

---

## 问题背景

### 需求

在橙果错题助手脚本中，需要将 MathQuill 不支持的 LaTeX 公式渲染为图片并插入到编辑器中。这些图片需要：

1. **尺寸匹配官方**：与橙果官方 PC 端公式编辑器生成的图片尺寸一致
2. **导出 Word 正常**：在导出 Word 文档时显示清晰，大小合理
3. **图片保持清晰**：避免模糊、失真等质量问题

### 核心矛盾

**图片质量 vs 显示尺寸**：

- 如果渲染大图后缩小显示 → 图片模糊
- 如果直接渲染小图 → 清晰但尺寸难以控制

---

## 技术方案对比

### 方案 A：事后缩放（❌ 不推荐）

**原理**：渲染大图，通过 `widthScale` 缩小 `<img>` 标签的 `width` 属性

```javascript
// 1. 渲染大图（默认字体大小 16px）
container.style.fontSize = '1em';
var canvas = await html2canvas(container);

// 2. 事后缩放
var width = Math.round(container.offsetWidth * 0.8); // ❌ 缩小到 80%

// 结果示例
<img width="80px" src="data:image/png;base64,... (100×50px 的图片)" />
```

**问题**：

| 渲染尺寸 | 显示尺寸 | 质量 | 原因 |
|---------|---------|------|------|
| 100×50px | 80×40px | ⚠️ 模糊 | 浏览器缩小图片，丢失像素信息 |

**结论**：图片显示尺寸对了，但**清晰度差**。

---

### 方案 B：基础字体大小控制（✅ 推荐）

**原理**：在 KaTeX 渲染时就控制字体大小，生成正确尺寸的图片

```javascript
// 1. 设置小字体
container.style.fontSize = '0.8em'; // ✅ 80% 字体大小

// 2. 渲染小图
var canvas = await html2canvas(container);

// 3. 使用原始尺寸
var width = container.offsetWidth; // ✅ 不缩放

// 结果示例
<img width="80px" src="data:image/png;base64,... (80×40px 的图片)" />
```

**优势**：

| 渲染尺寸 | 显示尺寸 | 质量 | 原因 |
|---------|---------|------|------|
| 80×40px | 80×40px | ✅ 清晰 | 图片本身就是正确尺寸，无需缩放 |

**结论**：图片尺寸和清晰度**都符合要求**。

---

## 最佳实践

### 核心代码

```javascript
// ========================================
// 配置项（脚本顶部）
// ========================================
var IMAGE_SIZE_CONFIG = {
    baseFontSize: '0.8em',  // ✨ 关键：控制渲染时的字体大小
    widthScale: 1.0,        // 保持 1.0（不事后缩放）
    heightScale: 1.0,
    debugSize: false
};

// ========================================
// 渲染函数（核心实现）
// ========================================
async function renderFormulaToImage(latex, isDisplay){
    // 1. 创建临时容器
    var container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    
    // ✨ 关键：设置字体大小（使用配置项）
    container.style.fontSize = IMAGE_SIZE_CONFIG.baseFontSize || '0.8em';
    
    // 增加 padding 防止大型公式被裁剪
    container.style.paddingTop = '8px';
    container.style.paddingBottom = '8px';
    container.style.paddingLeft = '2px';
    container.style.paddingRight = '2px';
    
    document.body.appendChild(container);

    // 2. 使用 KaTeX 渲染
    katex.render(latex, container, {
        displayMode: isDisplay,
        throwOnError: false
    });

    // 3. 转换为图片（使用橙果官方配置）
    var canvas = await html2canvas(container, {
        fontSize: 8,            // html2canvas 的字体渲染参数
        fontWeight: 100,
        backgroundColor: 'transparent',
        allowTaint: true,
        taintTest: false
    });

    // 4. 获取尺寸（直接使用 offsetWidth，不缩放）
    var width = container.offsetWidth;   // ✅ 已经是正确尺寸
    var height = container.offsetHeight;

    // 5. 清理容器
    document.body.removeChild(container);

    // 6. 返回图片和尺寸
    return {
        url: canvas.toDataURL('image/png'),
        width: width,
        height: height
    };
}
```

---

## 配置说明

### `IMAGE_SIZE_CONFIG.baseFontSize`

**作用**：控制 KaTeX 渲染时的基础字体大小

**取值范围**：CSS 字体大小值（推荐使用 `em` 单位）

**常用值参考**：

| baseFontSize | 预估效果 | 适用场景 |
|--------------|---------|---------|
| `'1em'` | 100%（默认） | 图片偏大时使用 |
| `'0.9em'` | 90% | 稍微偏大 |
| `'0.8em'` | 80%（推荐） | 接近橙果官方尺寸 |
| `'0.75em'` | 75% | 需要更小的图片 |
| `'0.7em'` | 70% | 最小建议值 |

**调整方法**：

1. 用相同公式（如 `$\frac{a}{b}$`）分别在官方编辑器和脚本中插入
2. 在浏览器开发者工具中对比生成的 `<img>` 标签的 `width` 值
3. 如果脚本生成的图片**偏大** → 减小 `baseFontSize`（如 `'0.75em'`）
4. 如果脚本生成的图片**偏小** → 增大 `baseFontSize`（如 `'0.85em'`）

### `IMAGE_SIZE_CONFIG.widthScale`（不推荐使用）

**说明**：事后缩放宽度，会导致图片模糊，建议保持 `1.0`

**原因**：
- 渲染大图后缩小 = 丢失像素 = 模糊
- 应该使用 `baseFontSize` 在渲染时就控制尺寸

---

## 实现细节

### 1. 为什么 `fontSize: 0.8em` 有效？

**CSS 字体大小继承链**：

```
body (默认 16px)
  ↓
container (fontSize: 0.8em = 12.8px)
  ↓
KaTeX 渲染的元素（继承 12.8px）
  ↓
所有公式元素（数字、符号、分数、括号等）都按 12.8px 基准渲染
```

**结果**：整个公式按 80% 的比例缩小，但保持内部元素比例一致。

---

### 2. `html2canvas` 的 `fontSize: 8` 是什么？

**两个不同的 `fontSize`**：

| 参数 | 作用对象 | 作用 |
|------|---------|------|
| `container.style.fontSize` | KaTeX 渲染 | 控制公式元素的实际大小 |
| `html2canvas({fontSize: 8})` | Canvas 渲染 | 控制字体渲染比例（橙果官方配置） |

**关系**：
- `container.style.fontSize` 决定**公式整体大小**
- `html2canvas({fontSize: 8})` 决定**字体渲染质量**（影响内部元素比例）

---

### 3. 为什么增加 `padding`？

**问题**：大型公式（如 `\begin{cases}` 环境）的花括号会超出容器边界

**解决**：增加 `padding` 确保所有元素都在容器内

```javascript
container.style.paddingTop = '8px';     // 防止顶部被裁剪
container.style.paddingBottom = '8px';  // 防止底部被裁剪（关键：大花括号）
container.style.paddingLeft = '2px';    // 防止左侧符号被裁剪
container.style.paddingRight = '2px';   // 防止右侧符号被裁剪
```

**效果对比**：

| padding | 效果 |
|---------|------|
| `2px/3px`（旧） | ❌ 大花括号下半部分被裁剪 |
| `8px/8px`（新） | ✅ 完整显示 |

---

## 常见问题

### Q1: 为什么不能只用 `widthScale`？

**A**: `widthScale` 是事后缩放，会导致图片模糊。

**原理**：
```
渲染：100×50px 的图片（清晰）
  ↓
缩放：<img width="80px"> 显示
  ↓
浏览器缩小图片 → 丢失 20% 像素信息 → 模糊
```

**正确做法**：使用 `baseFontSize` 直接渲染 80×40px 的图片。

---

### Q2: `baseFontSize` 和 `widthScale` 可以同时使用吗？

**A**: 可以，但**不推荐**。

**原因**：
- `baseFontSize` 已经控制了渲染尺寸
- 再用 `widthScale` 缩放会导致模糊
- 建议：`baseFontSize` 调整到位，`widthScale` 保持 `1.0`

---

### Q3: 如何找到最佳的 `baseFontSize` 值？

**A**: 对比官方和脚本生成的图片尺寸，计算比例。

**步骤**：

1. **测试公式**：`$\frac{a}{b}$`

2. **官方尺寸**：假设官方生成的图片宽度是 `20px`

3. **脚本尺寸**（当前 `baseFontSize: '0.8em'`）：假设生成的图片宽度是 `25px`

4. **计算比例**：
   ```
   目标比例 = 官方宽度 / 脚本宽度 = 20 / 25 = 0.8
   新 baseFontSize = 当前 baseFontSize × 目标比例
                   = 0.8em × 0.8
                   = 0.64em
   ```

5. **调整配置**：
   ```javascript
   baseFontSize: '0.64em'  // 或 '0.65em'（微调）
   ```

---

### Q4: 导出 Word 后图片模糊怎么办？

**A**: 这通常不是 `baseFontSize` 的问题，而是后端处理的问题。

**检查项**：

1. **前端发送的数据**：
   - 查看 Network 面板中发送到后端的 HTML
   - 确认 `<img>` 标签的 `width` 属性正确

2. **后端处理**：
   - 橙果后端会重新渲染 `<span class="mathquill-embedded-latex">` 中的公式
   - 前端生成的图片（`<img class="cg-math-formula">`）应该直接使用

3. **Word 中的尺寸**：
   - 右键点击 Word 中的图片 → 查看属性
   - 对比宽度是否与前端 `width` 属性一致

---

### Q5: 为什么花括号还是显示不全？

**A**: 可能需要增加 `padding`。

**检查**：

```javascript
container.style.paddingBottom = '8px';  // 是否足够？
```

**调整建议**：

| 公式类型 | 推荐 paddingBottom |
|---------|-------------------|
| 普通分数 | `3px` |
| 中等括号 | `5px` |
| 大括号（cases） | `8px`+ |
| 超大括号 | `10px`+ |

---

## 总结

### ✅ 推荐方案

**使用 `baseFontSize` 控制渲染尺寸**：

```javascript
var IMAGE_SIZE_CONFIG = {
    baseFontSize: '0.8em',  // ✨ 核心配置
    widthScale: 1.0,        // 保持 1.0
    heightScale: 1.0,
    debugSize: false
};
```

### ❌ 避免的做法

**用 `widthScale` 事后缩放**：

```javascript
var IMAGE_SIZE_CONFIG = {
    baseFontSize: '1em',     // ❌ 渲染大图
    widthScale: 0.8,         // ❌ 缩小显示 → 模糊
};
```

### 📊 效果对比

| 方案 | 图片清晰度 | 尺寸精确度 | 推荐指数 |
|-----|-----------|-----------|---------|
| baseFontSize | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 强烈推荐 |
| widthScale | ⭐⭐ | ⭐⭐⭐⭐ | ❌ 不推荐 |

---

## 相关文件

- 脚本源码：`umeditor/scripts/um-inject.user.js`
- 配置位置：脚本第 36-64 行（`IMAGE_SIZE_CONFIG`）
- 渲染函数：脚本第 287-423 行（`renderFormulaToImage`）

## 版本历史

- **v9.0.8**（2025-10-27）：引入 `baseFontSize` 配置
- **v9.0.7**（2025-10-27）：增加 padding 防止公式被裁剪
- **v9.0.2**（2025-10-26）：引入 `widthScale`（已废弃）

---

**最后更新**：2025年10月27日  
**作者**：GitHub Copilot  
**版本**：1.0
