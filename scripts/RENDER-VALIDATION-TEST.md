# MathQuill 渲染验证功能测试指南

## 更新内容

在 `um-inject.user.js` 中添加了 **MathQuill 渲染验证功能**，用于检测和提示无法正确渲染的 LaTeX 公式。

### 主要改进

1. **新增 `validateMathQuillRender()` 函数**
   - 检查 MathQuill DOM 结构（`.mq-root-block`、数学节点）
   - 验证渲染尺寸
   - 返回详细的验证结果

2. **单公式路径增强**（行 ~770-850）
   - 在 `MQ.StaticMath(temp).latex()` 后立即验证
   - 失败时显示详细错误信息
   - 提供回退到 UMEditor 原生公式插件的选项

3. **混合内容路径增强**（行 ~900-1000）
   - 预先批量验证所有公式 tokens
   - 收集所有失败的公式及其错误信息
   - 显示失败报告，列出前 5 个失败公式
   - 用户可选择继续插入或取消

## 测试用例

### 测试 1：单个支持的公式（应该成功）

```latex
$$E = mc^2$$
```

**预期结果**：
- ✅ 正常渲染，无警告
- 显示为漂亮的数学公式

---

### 测试 2：单个不支持的公式（应该失败）

```latex
$$\mathbb{ABC}$$
```

**预期结果**：
- ❌ 弹出警告框：
  ```
  公式渲染失败
  
  LaTeX: \mathbb{ABC}
  错误: 渲染结果为空（LaTeX 可能不被支持）
  
  这可能是因为：
  1. LaTeX 命令不被 MathQuill 支持
  2. 语法错误
  3. 使用了高级功能（如 \mathbb 的部分参数）
  
  是否尝试用 UMEditor 原生公式插件插入？
  ```
- 用户可选择：
  - **确定**：回退到 `execCommand('formula')`
  - **取消**：放弃插入

---

### 测试 3：支持的单字母 mathbb（应该成功）

```latex
$$\mathbb{N}$$
```

**预期结果**：
- ✅ 正常渲染（归一化为 `\N`）
- 显示为黑板粗体 N: ℕ

---

### 测试 4：混合内容 - 部分失败

```markdown
这是一个测试文本。

支持的公式：$x^2 + y^2 = r^2$

不支持的公式：$\mathbb{ABC}$

另一个支持的：$$\frac{a}{b} + \sqrt{c}$$

还有一个不支持的：$\xlongequal{very long text here}$
```

**预期结果**：
- ❌ 弹出警告框：
  ```
  检测到 2 个公式无法正确渲染：
  
  【公式 2】
  LaTeX: \mathbb{ABC}
  错误: 渲染结果为空（LaTeX 可能不被支持）
  
  【公式 4】
  LaTeX: \xlongequal{very long text here}
  错误: 渲染结果为空（LaTeX 可能不被支持）
  
  可能原因：
  • LaTeX 命令不被 MathQuill 支持
  • 语法错误或缺少必要的定界符
  • 使用了高级功能（如部分 \mathbb 参数、复杂矩阵等）
  
  是否继续插入（失败的公式将显示为空白）？
  点击"确定"继续，"取消"放弃插入。
  ```
- 用户选择：
  - **确定**：插入所有内容（失败的公式显示为空白或占位符）
  - **取消**：放弃整个插入操作

---

### 测试 5：全部公式都失败

```markdown
不支持 1：$\mathbb{ABCD}$

不支持 2：$\some{unknown}{command}$

不支持 3：$\another\unsupported\latex$
```

**预期结果**：
- ❌ 弹出警告框：
  ```
  检测到 3 个公式无法正确渲染：
  
  [列出所有 3 个失败公式]
  
  所有公式都无法渲染，是否仍要继续插入？
  ```
- 特别提示全部失败的情况

---

### 测试 6：复杂混合内容（5+ 个失败公式）

插入包含 10 个公式的文本，其中 7 个失败。

**预期结果**：
- ❌ 显示前 5 个失败公式
- 底部注明："...以及其他 2 个公式"

---

## 技术细节

### 验证逻辑

```javascript
function validateMathQuillRender(container, originalLatex) {
    // 1. 检查 .mq-root-block 或 .mq-math-mode
    var rootBlock = container.querySelector('.mq-root-block, .mq-math-mode');
    if (!rootBlock) return {success: false, error: '未找到渲染结构'};
    
    // 2. 检查数学内容节点
    var mathNodes = rootBlock.querySelectorAll('var, .mq-non-leaf, .mq-scaled, ...');
    if (mathNodes.length === 0) return {success: false, error: '渲染结果为空'};
    
    // 3. 检查渲染尺寸
    var rect = container.getBoundingClientRect();
    if (rect.width < 3 && rect.height < 3) return {success: false, error: '尺寸异常'};
    
    return {success: true};
}
```

### 批量验证流程

1. 提取所有 LaTeX tokens（用占位符保护）
2. 在隐藏的临时容器中逐个预渲染
3. 调用 `validateMathQuillRender()` 检查每个渲染结果
4. 收集失败项（index、latex、error）
5. 如果有失败：显示报告，询问用户
6. 根据用户选择：继续 / 取消

### 性能优化

- 使用单个隐藏容器 (`position: absolute; left: -9999px; visibility: hidden`)
- 批量验证完成后立即清理
- 只在用户实际插入前验证，不影响正常使用

---

## 调试技巧

### 1. 查看验证日志

打开浏览器控制台（F12），查看：
- `console.warn()` 输出的渲染失败信息
- MathQuill API 调用错误

### 2. 手动测试验证函数

在控制台运行：

```javascript
// 假设已经有 MathQuill 实例
var temp = document.createElement('span');
temp.style.position = 'absolute';
temp.style.left = '-9999px';
document.body.appendChild(temp);

var MQ = window.MathQuill.getInterface(2);
var staticMath = MQ.StaticMath(temp);
staticMath.latex('\\mathbb{ABC}'); // 测试不支持的命令

// 检查 DOM
console.log(temp.innerHTML);
console.log(temp.querySelector('.mq-root-block'));

// 清理
document.body.removeChild(temp);
```

### 3. 测试不同 LaTeX 命令

| LaTeX | MathQuill 支持 | 归一化后 | 预期结果 |
|-------|---------------|---------|---------|
| `\mathbb{N}` | ✅ | `\N` | 成功 ℕ |
| `\mathbb{ABC}` | ❌ | `\mathbb{ABC}` | 失败（空白） |
| `\frac{a}{b}` | ✅ | `\frac{a}{b}` | 成功 |
| `\xlongequal{...}` | ❌ | `=` | 成功（归一化） |
| `\subset` | ✅ | `⊂` | 成功（Unicode） |
| `\ce{H2O}` | ❌ | `{H2O}` | 可能失败 |

---

## 已知限制

1. **跨域 iframe**：如果 UMEditor 在跨域 iframe 中，可能无法访问 `MathQuill` 对象
2. **性能**：大量公式（100+）的批量验证可能需要 1-2 秒
3. **假阳性**：极少数情况下，某些特殊 LaTeX 可能被误判为失败
4. **归一化影响**：某些 LaTeX 在归一化后可能改变语义（如 `\xlongequal` → `=`）

---

## 回归测试

确保以下功能仍正常工作：

- ✅ 单个公式插入（支持的命令）
- ✅ 混合内容插入（Markdown 解析）
- ✅ Markdown 开关切换
- ✅ 热键 `Ctrl+Alt+I` 打开面板
- ✅ 粘贴按钮功能
- ✅ 清空按钮功能
- ✅ UMEditor 原生公式对话框

---

## 反馈与改进

如果发现问题或有改进建议，请检查：

1. **浏览器控制台**：是否有 JavaScript 错误
2. **MathQuill 版本**：确认 `third-party/mathquill/mathquill.js` 版本
3. **测试环境**：本地文件 vs. Web 服务器（CORS 限制）

---

## 下一步优化（可选）

1. **添加"仅检测"按钮**：在 UI 面板中添加按钮，让用户先检测再决定是否插入
2. **失败公式高亮**：在预览中用红色边框标记失败的公式
3. **自动修复建议**：对常见错误提供自动修复建议（如 `\mathbb{ABC}` → `\mathbb{A}\mathbb{B}\mathbb{C}`）
4. **导出检测报告**：将失败的公式导出为 JSON 或文本文件

---

生成时间：2025-10-19
脚本版本：um-inject.user.js (带渲染验证)
