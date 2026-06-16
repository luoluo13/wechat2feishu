# 调试与故障排查指南 (Troubleshooting)

本文档记录了 Wechat2doc 开发过程中遇到的常见问题、原因分析及解决方案，重点聚焦于飞书开放平台 (OAuth, 权限) 的集成。

## 1. 身份认证 (OAuth 2.0)

### 🔴 Error 20029: redirect_uri 请求不合法
*   **现象**：点击“登录飞书”后，跳转页面显示错误码 20029。
*   **原因**：代码中使用的 `redirect_uri` (本项目本地开发统一为 `http://127.0.0.1:3000/api/auth/callback`) 与飞书开发者后台配置的不一致，或者本地混用了 `localhost:3000` 和 `127.0.0.1:3000`。
*   **解决方案**：
    1.  进入飞书开发者后台 -> **安全设置** -> **重定向 URL**。
    2.  添加完整的 URL（包含协议和端口），本地开发请填写 `http://127.0.0.1:3000/api/auth/callback`。
    3.  本地浏览器访问地址也必须统一使用 `http://127.0.0.1:3000`，不要再打开 `http://localhost:3000`。
    4.  **关键**：添加后必须点击顶部的 **“创建版本” -> “发布”** 才能生效。

### 🔴 Feishu User Auth Error: missing app id or app secret
*   **现象**：后端日志报错，提示获取 User Token 失败。
*   **原因**：飞书 API (`/authen/v1/access_token`) 规范要求。
    *   **错误做法**：将 `app_id` 和 `app_secret` 放在请求 Body 中。
    *   **正确做法**：必须获取 `app_access_token` (Tenant Token)，并将其放入请求 Header 的 `Authorization` 字段中 (`Bearer <token>`)。Body 中只需要传 `code` 和 `grant_type`。

### 🟡 登录后无法注销 (Session 残留)
*   **现象**：点击退出登录后，再次点击登录直接跳过扫码，自动登入旧账号。
*   **原因**：飞书官网的 Cookie 依然有效，导致 OAuth 流程自动授权。
*   **调试建议**：在开发测试时，建议使用浏览器的 **“无痕模式”** 进行登录测试，或者在测试前先手动访问飞书官网退出登录。

## 2. 权限管理 (Scopes)

### 🔴 Access denied. One of the following scopes is required: [drive:drive]
*   **现象**：OAuth 登录成功，但执行转存 (获取根目录、上传文件) 时报错。
*   **原因**：权限配置混淆。
    *   **应用权限 (Application Scope)**：授予机器人/应用的权限。
    *   **用户权限 (User Scope)**：授予应用代表用户执行操作的权限。
    *   **陷阱**：在后台开通了“应用权限”的 `drive:drive`，但**忘记开通“用户权限”**列下的同名权限。
*   **解决方案**：
    1.  进入飞书开发者后台 -> **权限管理**。
    2.  确保在 **“API 权限”** 列表中，显式勾选并开通了支持 **User** 模式的 `drive:drive` 或 `drive:drive.readonly`。
    3.  **发布版本**。
    4.  **强制用户重新授权**：用户必须注销并重新扫码，在弹出的授权框中点击同意，新的 Scope 才会写入 Token。

### 🟡 无法删除/移动生成的文档
*   **现象**：文档创建成功，但用户在飞书界面上没有“删除”按钮。
*   **原因**：所有权归属错误。
    *   如果使用 `tenant_access_token` (应用身份) 创建，文档归属机器人，用户仅作为协作者。
    *   如果使用 `user_access_token` (用户身份) 创建，文档归属用户本人。
*   **解决方案**：确保后端逻辑中，优先使用 `user_access_token` 调用 Drive API。

## 3. 数据库 (Prisma & SQLite)

### 🔴 Unique constraint failed on the fields: (`originalUrl`)
*   **现象**：重复转存同一篇文章时报错。
*   **原因**：数据库字段设置了 `@unique`，而代码使用了 `create` 方法。
*   **解决方案**：改用 `prisma.article.upsert` 方法。如果记录存在，则更新状态和时间；如果不存在，则创建。

### 🔴 Cannot read properties of undefined (reading 'user')
*   **现象**：代码中调用 `prisma.user` 报错，但 Schema 文件里明明有 User 表。
*   **原因**：修改 `schema.prisma` 后，虽然运行了 migrate，但没有重新生成 Client 库。
*   **解决方案**：运行 `npx prisma generate`，并**重启 Next.js 开发服务器**。
