# 贡献指南

感谢你对 Zotero Paper Copilot 项目的兴趣！我们欢迎各种形式的贡献。

## 如何贡献

### 报告 Bug

1. 在 GitHub Issues 中搜索是否已存在相同问题
2. 如果没有，请创建新的 Issue，包含：
   - 清晰的标题和描述
   - 复现步骤
   - 预期 vs 实际行为
   - 环境信息 (Zotero 版本、操作系统等)

### 提出新功能

1. 在 GitHub Issues 中搜索相关讨论
2. 创建一个 Issue，描述：
   - 你希望实现的功能
   - 为什么需要这个功能
   - 可能的实现方案

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 进行开发并遵守代码规范
4. 编写测试（如果有）
5. 提交更改：`git commit -m 'feat: add xxx'`
6. 推送分支：`git push origin feature/your-feature`
7. 创建 Pull Request

## 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/ShiWenber/zotero-paper-copilot.git
cd zotero-paper-copilot

# 安装依赖
npm install

# 启动开发模式
npm start

# 运行测试
npm test

# 代码检查
npm run lint:check

# 代码格式化
npm run lint:fix
```

## 代码规范

- 使用 TypeScript
- 遵守 Prettier 格式化规范
- 使用 ESLint 检查代码
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

### 提交信息格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

类型 (type)：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

示例：
```
feat(llm-api): add Claude API support

- Add Claude API provider
- Support streaming responses
- Add API key configuration

Closes #123
```

## 项目结构

```
src/
├── modules/           # 功能模块
│   ├── sidebar.ts    # 侧边栏 UI
│   ├── llm-api.ts   # LLM API 对接
│   ├── summary.ts    # 摘要生成
│   └── ...
├── utils/            # 工具函数
│   ├── ztoolkit.ts  # Zotero 工具封装
│   ├── prefs.ts     # 配置管理
│   └── ...
└── hooks.ts         # 入口和生命周期
```

## 测试

本项目使用 Mocha + Chai 进行单元测试。

```bash
# 运行测试
npm test
```

## 问题解答

如果你有任何问题，欢迎在 GitHub Discussions 中提问。

---

感谢你的贡献！ 🎉
