# Zotero WebExtension 插件架构研究

## 概述

Zotero 7 使用 Firefox 128 ESR 内核，支持 **WebExtension** 架构（与 Chrome 扩展类似）。

---

## 两种插件架构对比

| 特性 | WebExtension (推荐) | XUL/XPD (传统) |
|---|---|---|
| 跨平台 | ✅ Windows/Mac/Linux | ❌ 仅桌面 |
| 开发难度 | ⭐ 简单 | ⭐⭐ 复杂 |
| 维护活跃度 | 高 | 低 |
| 功能限制 | 较多 | 几乎无限制 |
| 适用场景 | UI 扩展、API 调用 | 深度集成 |

**结论**: 使用 WebExtension 架构

---

## WebExtension 核心组件

```
src/
├── manifest.json          # 插件配置清单
├── background.js         # 后台脚本 (Service Worker)
├── content.js           # 注入到页面的脚本
├── popup.html/js        # 弹出窗口
├── sidebar.html/js      # 侧边栏
├── styles/
│   └── main.css
├── images/
│   └── icon.png
└── _locales/
    └── en/
        └── messages.json
```

---

## manifest.json 核心配置

```json
{
  "manifest_version": 3,
  "name": "Zotero Moonlight",
  "version": "0.1.0",
  "description": "AI Assistant for Research Papers",
  
  "permissions": [
    "storage",           // 本地存储
    "activeTab",        // 当前标签页
    "scripting",        // 脚本注入
    "tabs"              // 标签页管理
  ],
  
  "host_permissions": [
    "*://*.zotero.org/*",  // Zotero 域名
    "*://*/*"              // API 请求
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [{
    "matches": ["*://*/*"],
    "js": ["content.js"],
    "css": ["styles/main.css"]
  }],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": "images/icon.png"
  },
  
  "icons": {
    "48": "images/icon.png"
  }
}
```

---

## 与 Zotero 页面交互

### 方法 1: content_script 注入

```javascript
// content.js
// 注入到 Zotero 所有页面

// 监听选中文本
document.addEventListener('mouseup', async (event) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    // 发送到后台或侧边栏
    browser.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText,
      url: window.location.href
    });
  }
});

// 检测当前是否是 PDF 阅读器
function isPDFReader() {
  return window.location.href.includes('/item/') && 
         document.querySelector('pdf-viewer');
}
```

### 方法 2: Zotero JavaScript API

```javascript
// 在 Zotero 插件中可直接调用
const Zotero = window.Zotero;

// 获取当前选中的文献
const pane = Zotero.getActiveZoteroPane();
const items = pane.getSelectedItems();

// 获取文献元数据
const item = items[0];
const title = item.getField('title');
const authors = item.getCreators();

// 获取 PDF 文件
const pdfFile = await item.getPDFAttachment();
```

---

## 侧边栏实现

### 创建侧边栏

```javascript
// content.js
function createMoonlightSidebar() {
  // 检查是否已存在
  if (document.getElementById('moonlight-sidebar')) {
    return;
  }
  
  // 创建侧边栏容器
  const sidebar = document.createElement('div');
  sidebar.id = 'moonlight-sidebar';
  sidebar.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
    z-index: 9999;
  `;
  
  // 加载 Vue 应用
  sidebar.innerHTML = '<div id="moonlight-app"></div>';
  document.body.appendChild(sidebar);
  
  // 挂载 Vue
  loadVueApp();
}

// 监听消息切换侧边栏
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle-sidebar') {
    const sidebar = document.getElementById('moonlight-sidebar');
    if (sidebar) {
      sidebar.remove();
    } else {
      createMoonlightSidebar();
    }
  }
});
```

---

## 消息传递机制

### 内容脚本 ↔ 后台脚本

```javascript
// content.js -> background.js
browser.runtime.sendMessage({
  type: 'LLM_REQUEST',
  text: selectedText,
  context: { title, authors }
}).then(response => {
  console.log(response.result);
});

// background.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LLM_REQUEST') {
    // 调用 LLM API
    callLLM(message.text, message.context)
      .then(result => sendResponse({ result }));
    return true; // 异步响应
  }
});
```

---

## 存储 API

```javascript
// 保存设置
browser.storage.local.set({
  apiKey: 'sk-xxx',
  provider: 'openai',
  theme: 'dark'
}).then(() => {
  console.log('设置已保存');
});

// 读取设置
browser.storage.local.get(['apiKey', 'provider']).then(result => {
  console.log(result.apiKey);
});
```

---

## 参考资源

### 官方文档
- [Zotero Plugin Guide](https://www.zotero.org/support/dev/plugins)
- [Zotero WebExtension 示例](https://github.com/zotero/webextension-examples)
- [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

### 现有插件参考
- [Zotero PDF Preview](https://github.com/retorquere/zotero-pdf-preview)
- [Zotero Tag](https://github.com/willsALMANJ/zotero-tag)
- [Zotero Scite](https://github.com/scitedotai/zotero-scite-widget)

---

## 总结

### 适合我们的功能
- ✅ 侧边栏 UI (Vue)
- ✅ 选中文本监听
- ✅ LLM API 调用
- ✅ 设置存储

### 需要注意
- Zotero 7 需要 manifest v3
- 部分 Zotero 内部 API 需要通过 content script 访问
- PDF.js 集成需要研究 Zotero 内部结构

### 下一步
1. 搭建开发环境
2. 运行官方模板
3. 尝试注入侧边栏
