# Phase 1: 基础架构 - 详细技术方案

## 1.1 环境搭建

### Zotero 版本选择

- **推荐**: Zotero 7 (最新稳定版)
- Zotero 7 使用 Firefox 128 ESR 内核
- 支持 WebExtension 插件

### 开发环境要求

```bash
# 1. Node.js 18+
node --version  # >= 18

# 2. npm 或 pnpm
npm --version

# 3. Git
git --version

# 4. Zotero 7 安装
# 下载: https://www.zotero.org/download/
```

### 初始化项目

```bash
# 克隆官方模板
git clone https://github.com/zotero/zotero-plugin-template.git zotero-moonlight
cd zotero-moonlight

# 安装依赖
npm install

# 构建
npm run build

# 安装插件到 Zotero
# 复制 build/zotero-plugin.xpi 到 Zotero 插件目录
```

---

## 1.2 Zotero 插件架构

### 两种架构对比

| 架构                    | 优点                 | 缺点               |
| ----------------------- | -------------------- | ------------------ |
| **WebExtension** (推荐) | 现代、跨平台、易开发 | 功能受限           |
| XUL/XPD                 | 功能强大             | 仅桌面端、维护困难 |

### WebExtension 架构组件

```
zotero-moonlight/
├── src/
│   ├── manifest.json          # 插件配置
│   ├── background.js         # 后台脚本 (可选)
│   ├── content.js           # 注入到 Zotero 页面
│   ├── styles/              # 样式文件
│   │   └── sidebar.css
│   └── components/          # Vue 组件
│       ├── Sidebar.vue
│       └── ChatPanel.vue
├── build/                    # 构建输出
├── package.json
└── webpack.config.js
```

### manifest.json 核心配置

```json
{
  "manifest_version": 3,
  "name": "Zotero Moonlight",
  "version": "0.1.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.zotero.org/*",
    "*://*/*"  # 用于 LLM API 请求
  ],
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["content.js"]
  }]
}
```

---

## 1.3 PDF.js 集成

### Zotero 7 内置 PDF.js

Zotero 7 已经集成 PDF.js，位于：

```
zotero-install/resource/pdfjs/
```

### 在阅读窗口获取 PDF

```javascript
// content.js
async function getPDFViewer() {
  // 方法 1: 通过 Zotero API
  const pane = Zotero.getActiveZoteroPane();
  const item = pane.getSelectedItems()[0];
  const pdfWindow = Zotero.Standalone.maybeOpenPDFWindow(item);

  // 方法 2: 直接访问 PDF.js
  const pdfViewer = document.querySelector("pdf-viewer");
  return pdfViewer;
}
```

### 选中文本获取

```javascript
// 监听文本选择
document.addEventListener("mouseup", async (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    // 发送到侧边栏
    browser.runtime.sendMessage({
      type: "TEXT_SELECTED",
      text: selectedText,
      itemId: getCurrentItemId(),
    });
  }
});
```

---

## 1.4 侧边栏 UI 框架 (Vue 3)

### 安装 Vue

```bash
npm install vue @vitejs/plugin-vue
npm install -D vite
```

### 侧边栏创建

```javascript
// content.js
function createSidebar() {
  const sidebar = document.createElement("div");
  sidebar.id = "moonlight-sidebar";
  sidebar.innerHTML = '<div id="moonlight-app"></div>';
  document.body.appendChild(sidebar);

  // 挂载 Vue
  import("./components/App.vue").then(({ default: App }) => {
    const app = createApp(App);
    app.mount("#moonlight-app");
  });
}
```

### Vue 组件结构

```
components/
├── App.vue              # 主组件
├── ChatPanel.vue        # AI 对话面板
├── SummaryPanel.vue    # 摘要面板
├── TranslatePanel.vue  # 翻译面板
└── KnowledgePanel.vue  # 知识库面板
```

---

## 1.5 LLM API 对接设计

### API 抽象层

```javascript
// services/llm.js
class LLMService {
  constructor(provider = "openai") {
    this.provider = provider;
    this.apiKey = null;
  }

  async chat(messages, options = {}) {
    // 流式响应
    const response = await fetch(this.getEndpoint(), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model || "gpt-4",
        messages,
        stream: true,
      }),
    });

    return this.parseStreamResponse(response);
  }

  // 支持的 provider
  // - OpenAI (GPT-4, GPT-4o)
  // - Anthropic (Claude)
  // - Google (Gemini)
}
```

### 提示词设计

```javascript
// prompts.js
export const SYSTEM_PROMPTS = {
  paper_qa: `你是一位专业的学术论文助手。
当前论文信息：
- 标题: {title}
- 作者: {authors}
- 期刊: {journal}
- 年份: {year}

请基于以上信息回答用户问题。`,

  paper_summary: `请生成这篇论文的摘要，包括：
1. 研究问题
2. 方法
3. 主要发现
4. 结论

请用中文输出。`,

  translate: `请翻译以下文本，保留专业术语的英文原文：`,
};
```

---

## 1.6 任务分解 (Phase 1)

| 任务              | 预估时间     | 依赖     |
| ----------------- | ------------ | -------- |
| 环境搭建          | 1天          | -        |
| 运行官方模板      | 1天          | 环境搭建 |
| 实现侧边栏基础 UI | 2天          | 模板运行 |
| PDF 文本选择监听  | 2天          | 侧边栏   |
| LLM API 对接      | 3天          | 侧边栏   |
| AI 对话功能       | 3天          | API 对接 |
| **小计**          | **约 12 天** |          |

---

## 参考资源

- [Zotero 官方插件开发文档](https://www.zotero.org/support/dev/plugins)
- [Zotero WebExtension 示例](https://github.com/zotero/webextension-examples)
- [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Vue 3 文档](https://vuejs.org/)
