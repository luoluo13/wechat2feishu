# Wechat2doc (Conductor)

## Related Docs
- [FEISHU_SETUP.md](./FEISHU_SETUP.md)

<div align="center">
  <img src="https://img.shields.io/badge/Status-V1.2%20Completed-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Style-Apple%20Minimalist-000000?style=for-the-badge" alt="Style" />
  <br/>
  <br/>
  <h3>极致打磨，让微信灵感瞬时归档。</h3>
  <p>以最优雅的方式，将深度好文保存至你的私人知识库。保留每一处细节，成就高效创作。</p>
</div>

---

## ✨ 项目简介

**Wechat2doc** 是一款高保真的微信公众号文章归档与同步工具。它不仅仅是一个简单的抓取脚本，更是一个追求极致用户体验的生产力工具。

- **极简美学**: 采用 Apple 风格的极简 UI 设计，大留白、毛玻璃质感、微交互动画。
- **高保真**: 像素级还原微信文章排版，智能去除广告和干扰元素。
- **云端同步**: 一键将本地归档的文章同步至飞书云文档，图片自动转存，链接自动替换。

## 🚀 核心功能 (已实现)

### V0.4: SaaS 服务化 (进行中)
- **身份认证**: 支持飞书 OAuth 2.0 扫码登录，自动管理用户会话。
- **权限闭环**: 转存文档所有权归属用户本人，支持删除与管理。
- **数据隔离**: 多用户环境下的数据隔离，保障个人隐私。
- **安全加固**: Token 采用 AES-256 加密存储。

### V0.3: 图形化交互 (已完成)
- **Web Dashboard**: 基于 Next.js 构建的本地现代化管理后台。
- **动态交互**: 智能识别登录状态，提供个性化的欢迎语与交互体验。
- **一键转存**: 粘贴 URL，系统自动执行“抓取 -> 解析 -> 下载资源 -> 上传飞书”全流程。
- **可视化历史**: 实时查看转存记录、状态（进行中/成功/失败）及耗时。
- **智能去噪**: 自动剔除二维码、底部广告、“往期推荐”等无关内容。

### V0.2: 飞书深度集成
- **身份认证**: 支持 Tenant Access Token 自动管理与刷新。
- **资源迁移**: 本地图片自动上传至飞书 Drive，解决防盗链问题。
- **文档生成**: 调用飞书导入接口，生成可编辑的在线文档。

### V0.1: 本地归档引擎
- **Markdown 转换**: 将 HTML 转换为标准 Markdown，兼容 Obsidian/Notion。
- **原子化存储**: 每篇文章独立文件夹，资源相对路径引用，便于迁移。

## 🛠 技术架构

- **前端**: Next.js (App Router), React, Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: Prisma ORM (本地开发默认 SQLite，生产规划为 MongoDB)
- **抓取引擎**: Playwright (解决懒加载), Cheerio (DOM 清洗), Turndown (HTML转MD)
- **UI 组件**: Custom Components (仿 shadcn/ui + Apple Design)

## 🏁 快速开始

### 前置要求
- Node.js 18+
- 一个飞书企业自建应用 (需开通云文档/云空间相关权限)

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
在项目根目录创建 `.env` 文件。对于本地开发，至少需要以下配置：

```env
# Database (Prisma)
DATABASE_URL="file:./dev.db"

# Auth / Local session secrets
AUTH_SECRET="replace-with-random-string"
JWT_SECRET="replace-with-random-string"
ENCRYPTION_KEY="replace-with-64-char-hex"
AUTH_URL="http://127.0.0.1:3000"
NEXTAUTH_URL="http://127.0.0.1:3000"

# Feishu / Lark Configuration
FEISHU_APP_ID=cli_xxxxxxxx      # 您的 App ID
FEISHU_APP_SECRET=xxxxxxxxxxxx  # 您的 App Secret

# Optional: only needed if you want Feishu OAuth login later
FEISHU_REDIRECT_URI="http://127.0.0.1:3000/api/auth/callback"

# Optional: SMTP for real email verification
# SMTP_HOST=
# SMTP_PORT=465
# SMTP_USER=
# SMTP_PASS=
```

- 本地开发请统一通过 `http://127.0.0.1:3000` 访问，不要混用 `localhost:3000`。
- 飞书开发者后台的 **安全设置 -> 重定向 URL** 必须精确配置为 `http://127.0.0.1:3000/api/auth/callback`，否则绑定飞书时会报 `20029`。
- 修改 `.env` 后请重启 `npm run dev`。

### 3. 初始化数据库
```bash
npx prisma generate
npx prisma db push
```

### 4. 启动服务
```bash
npm run dev
```
访问浏览器 [http://127.0.0.1:3000](http://127.0.0.1:3000)，即可看到图形化界面。

- `npm run dev` 会固定监听 `127.0.0.1:3000`。
- Next.js 启动时显示的 `Network` 只是当前进程推导出的可访问地址提示，不是额外部署了一个单独服务。

### 当前飞书同步说明
- 登录后需要先在首页绑定当前账号对应的飞书身份。
- 首页“绑定飞书”按钮会发起飞书 OAuth 授权，并把当前站内账号和一个飞书用户绑定起来。
- 同步到飞书时，当前版本会优先基于 `contentHtml` 生成 `DOCX` 再导入飞书，而不是走旧的 Markdown 导入链路。
- 这样可以明显改善飞书里的图片导入成功率，并保留大部分真实表格结构，文档会直接进入当前绑定用户的《我的文档库》。

### 本地开发说明
- 当前仓库的本地开发默认使用 SQLite，不需要先安装 MongoDB。
- 本地联调时请始终使用 `127.0.0.1:3000` 登录和回调，避免 `localhost` 与 `127.0.0.1` 混用导致 OAuth 会话失配。
- `send-code` 接口在未配置 SMTP 时会把验证码打印到终端，便于本地注册测试。
- 首次抓取文章前请确认 Playwright 浏览器已安装；如果未安装，执行 `npx playwright install`。

## 🗺️ 路线图 (Roadmap)

| 版本 | 功能模块 | 状态 | 说明 |
| :--- | :--- | :--- | :--- |
| **V0.1** | **核心归档器** | ✅ 已完成 | CLI 工具，本地 Markdown 转换与存储 |
| **V0.2** | **云端同步** | ✅ 已完成 | 对接飞书 API，实现图片上传与文档导入 |
| **V0.3** | **Web 界面化** | ✅ 已完成 | 现代化 Web UI，任务历史管理 |
| **V0.4** | **SaaS 服务化** | ✅ 已完成 | 支持飞书扫码登录 (OAuth)，多用户隔离，图片智能代理 |
| **V0.5** | **架构升级** | ✅ 已完成 | 迁移至 MongoDB 副本集，支持海量数据与聚合查询 |
| **V0.6** | **体验与商业化** | 🚧 进行中 | 全站深色模式，存储配额管理 (20篇限制) |
| **V0.7** | **社区与探索** | 📅 规划中 | 热门转存榜单，数据看板 (Open Stats) |

## 🛠 技术架构 (V0.5 / 生产规划)

- **前端**: Next.js (App Router), React, Tailwind CSS
- **后端**: Next.js API Routes (Serverless/Node.js)
- **数据库**: **MongoDB 7.0 (Replica Set)** + Prisma ORM
- **抓取引擎**: Playwright (无头浏览器)
- **云端集成**: Feishu Open Platform (OAuth 2.0 + Drive + Doc Import)

MIT License
