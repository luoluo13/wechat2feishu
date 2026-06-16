# 飞书配置说明

本文档说明本项目接入飞书时需要完成的配置项，包括应用创建、权限开通、回调地址、本地联调和常见报错。

## 1. 创建飞书应用

1. 进入飞书开放平台。
2. 创建企业自建应用。
3. 获取 `App ID` 和 `App Secret`。
4. 填入项目根目录的 `.env`：

```env
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxx
```

## 2. 本地环境变量

本项目本地开发统一使用 `127.0.0.1:3000`，不要混用 `localhost:3000`。

```env
AUTH_URL="http://127.0.0.1:3000"
NEXTAUTH_URL="http://127.0.0.1:3000"
FEISHU_REDIRECT_URI="http://127.0.0.1:3000/api/auth/callback"
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxx
```

修改后请重启 `npm run dev`。

## 3. 配置重定向 URL

飞书开放平台后台：

1. 打开应用。
2. 进入“安全设置”。
3. 在“重定向 URL”中添加：

```text
http://127.0.0.1:3000/api/auth/callback
```

4. 保存后执行“创建版本”并“发布”。

注意：

- 这个地址必须和 `.env` 中的 `FEISHU_REDIRECT_URI` 完全一致。
- 协议、主机名、端口、路径任何一项不一致，都可能触发 `20029`。

## 4. 需要开通的权限

当前项目至少需要：

- `contact:user.base:readonly`
- `drive:drive`
- `drive:drive.metadata:readonly`

说明：

- `contact:user.base:readonly` 用于读取绑定飞书用户的基础信息。
- `drive:drive` 用于创建、导入、移动和管理云空间文件。
- `drive:drive.metadata:readonly` 用于读取目录和文件元数据。

开通权限后，同样需要“创建版本”并“发布”。

如果前端仍提示权限不足，通常是以下原因之一：

1. 新权限还没有发布。
2. 当前用户使用的是旧授权。
3. 需要重新点击一次“绑定飞书”完成新授权。

## 5. 如何完成绑定

1. 启动项目：

```bash
npm run dev
```

2. 打开：

```text
http://127.0.0.1:3000
```

3. 登录站内账号。
4. 点击首页“绑定飞书”。
5. 在飞书授权页完成授权。

绑定成功后，后续“推送到飞书”生成的文档会进入该飞书用户自己的《我的文档库》。

## 6. 常见报错

### Error 20029

含义：重定向地址不合法。

优先检查：

1. `.env` 中的 `FEISHU_REDIRECT_URI`
2. 飞书后台配置的重定向 URL
3. 浏览器实际访问地址是否是 `http://127.0.0.1:3000`

三者必须完全一致。

### Access denied. One of the following scopes is required

含义：权限没开通，或者用户还是旧授权。

处理方法：

1. 在开放平台补开对应权限。
2. 创建版本并发布。
3. 回到项目首页重新点击“绑定飞书”。

### 文档没有出现在《我的文档库》

优先检查：

1. 是否完成了“绑定飞书”。
2. 当前推送是否走的是绑定后的用户身份。
3. 是否还在使用旧授权或旧版本逻辑。

本项目当前预期行为是：成功绑定后，新生成文档直接进入绑定用户自己的《我的文档库》。
