# Zotero Paper Copilot - UI 框架技术选型报告

## 1. 背景

在开发 Zotero 插件时，需要为 AI 论文阅读功能选择合适的 UI 框架。最初考虑使用 Vue 3，但在实际开发中发现 Vue 并不适合 Zotero 插件开发环境。

---

## 2. Zotero 插件 UI 开发选项

### 2.1 原生 XUL/HTML (推荐)

**描述**：使用 Zotero 内置的 XUL (XML User Interface Language) 和 HTML/CSS 进行 UI 开发。

**优点**：

- ✅ 完全兼容 Zotero 内置浏览器引擎
- ✅ 无需额外依赖，构建产物小
- ✅ 可使用 Zotero Plugin Toolkit 的 UI 工具
- ✅ 社区主流方案（如 zotero-gpt、zotero-pdf-translate 都使用此方案）
- ✅ 调试方便，直接在 Zotero 环境中运行

**缺点**：

- ❌ 开发体验不如现代前端框架
- ❌ 需要学习 XUL 语法
- ❌ 状态管理需要手动处理

**代表插件**：

- `zotero-gpt` - AI 问答插件
- `zotero-pdf-translate` - PDF 翻译插件
- `zotero-better-notes` - 笔记增强插件

---

### 2.2 React

**描述**：使用 React 构建 UI，通过打包后嵌入 Zotero。

**优点**：

- ✅ 现代前端开发体验
- ✅ 丰富的组件生态
- ✅ 状态管理方便 (Redux/Context)

**缺点**：

- ❌ 打包体积大
- ❌ 需要处理与 Zotero 环境的兼容
- ❌ 需要处理 CSS 隔离问题
- ❌ 社区使用案例较少

**适用场景**：

- 复杂的企业级插件
- 需要大量交互的界面

---

### 2.3 Vue 3

**描述**：使用 Vue 3 构建 UI。

**优点**：

- ✅ 开发体验好
- ✅ 模板语法直观

**缺点**：

- ❌ **与 Zotero 内置浏览器不完全兼容**
- ❌ 需要额外配置打包工具
- ❌ 社区几乎没有成功案例
- ❌ CSS 样式容易与 Zotero 冲突

**结论**：**不推荐**用于 Zotero 插件开发

---

### 2.4 Svelte

**描述**：使用 Svelte 框架。

**优点**：

- ✅ 编译时框架，打包体积小
- ✅ 响应式简单

**缺点**：

- ❌ 社区使用案例极少
- ❌ 需要自行处理 Zotero 兼容性

---

## 3. 推荐方案

### 方案：原生 HTML + Zotero Plugin Toolkit

**技术栈**：

- **UI**: 原生 HTML/CSS/JavaScript
- **工具库**: zotero-plugin-toolkit
- **打包**: zotero-plugin-scaffold (已有)

---

## 4. 实现建议

### 4.1 侧边栏实现

使用原生 HTML + JavaScript：

```typescript
// 使用 ztoolkit.UI 创建元素
const sidebar = ztoolkit.UI.createElement(doc, "div", {
  id: "paper-copilot-sidebar",
  styles: {
    position: "fixed",
    right: "0",
    top: "0",
    width: "400px",
    height: "100%",
    background: "#fff",
    // ...
  },
});
```

### 4.2 事件处理

```typescript
// 使用 ztoolkit 注册事件
ztoolkit.UI.register(sidebar, {
  // 事件处理
});
```

### 4.3 样式隔离

```css
/* 使用唯一前缀避免冲突 */
#paper-copilot-sidebar {
  font-family: system-ui, sans-serif;
}

#paper-copilot-sidebar * {
  box-sizing: border-box;
}
```

---

## 5. 结论

| 方案                | 推荐度     | 备注               |
| ------------------- | ---------- | ------------------ |
| 原生 HTML + Toolkit | ⭐⭐⭐⭐⭐ | 社区主流，兼容性好 |
| React               | ⭐⭐⭐     | 复杂项目可选       |
| Vue 3               | ⭐         | 不推荐             |
| Svelte              | ⭐⭐       | 可尝试，社区案例少 |

**最终建议**：使用 **原生 HTML + Zotero Plugin Toolkit** 进行 UI 开发，这是社区验证过的最佳方案。

---

## 6. 参考资源

- [zotero-plugin-toolkit 文档](https://windingwind.github.io/zotero-plugin-toolkit/)
- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- [zotero-gpt 源码](https://github.com/MuiseDestiny/zotero-gpt)
- [zotero-pdf-translate 源码](https://github.com/windingwind/zotero-pdf-translate)
