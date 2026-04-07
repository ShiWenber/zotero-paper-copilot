# Phase 1 任务 2: 搭建开发环境

## 本地需要安装的工具

### 1. Node.js 18+

**检查是否已安装：**
```bash
node --version
npm --version
```

**如未安装，推荐使用 fnm 管理 Node 版本：**
```bash
# 安装 fnm (macOS/Linux)
curl -fsSL https://fnm.vercel.app/install | bash

# 安装 Node.js 18
fnm install 18
fnm use 18

# 验证
node --version
```

**Windows 用户：** 直接从 https://nodejs.org 下载 LTS 版本

---

### 2. Git

**检查：**
```bash
git --version
```

**如未安装：**
- macOS: `brew install git`
- Ubuntu: `sudo apt install git`
- Windows: https://git-scm.com/download/win

---

### 3. Zotero 7

**下载：** https://www.zotero.org/download/

**安装后验证：**
- 启动 Zotero
- 菜单栏 → 帮助 → 关于 Zotero
- 确认版本 ≥ 7.0

---

## 初始化项目

### 1. 克隆官方模板

```bash
# 进入工作目录
cd ~/projects  # 或你的工作目录

# 克隆模板
git clone https://github.com/zotero/zotero-plugin-template.git zotero-moonlight

# 进入目录
cd zotero-moonlight
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置项目

编辑 `package.json`，修改项目名称：

```json
{
  "name": "zotero-moonlight",
  "version": "0.1.0",
  "description": "AI Assistant for Research Papers - Moonlight-like plugin for Zotero"
}
```

### 4. 构建测试

```bash
npm run build
```

**预期输出：** `build/` 目录下生成 `zotero-plugin.xpi`

---

## 安装插件到 Zotero

### 方法 1: 开发模式 (推荐)

```bash
# macOS
npm run symlink

# Windows
npm run symlink-win
```

这会在 Zotero 插件目录创建符号链接，修改代码后重启 Zotero 即可生效。

### 方法 2: 手动安装

1. 构建: `npm run build`
2. 打开 Zotero → 菜单 → 工具 → 附加组件
3. 拖入 `build/zotero-plugin.xpi`

---

## 验证安装

1. 重启 Zotero
2. 查看菜单栏是否有新插件
3. 打开浏览器控制台 (Shift+Cmd+J / Shift+Ctrl+J)
4. 检查是否有插件相关日志

---

## 下一步

环境搭建完成后，运行官方 template 验证基础框架可工作。
