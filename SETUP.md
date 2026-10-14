# 冷启动指南：从零跑通微信桥接

[English version](SETUP.en.md)

按顺序执行 9 步，把微信桥接从零跑通。安装命令来自插件官方文档，补丁和调度来自真实跑通的环境。

## 0. 前置条件

- Node.js `>= 22.13.0`
- OpenClaw `>= 2026.3.22`（建议 `>= 2026.5.12`）
- 一台长期开机的机器（Linux / macOS / WSL）

## 1. 安装 OpenClaw

按官方文档安装：https://docs.openclaw.ai/install

验证：

```bash
openclaw --version
```

## 2. 安装微信插件

```bash
npx -y @tencent-weixin/openclaw-weixin-cli install
```

装不上时换这种：

```bash
openclaw plugins install "@tencent-weixin/openclaw-weixin"
```

## 3. 启用插件

```bash
openclaw config set plugins.entries.openclaw-weixin.enabled true
```

## 4. 微信扫码登录

```bash
openclaw channels login --channel openclaw-weixin
```

用微信扫终端显示的二维码并确认授权。成功后凭证自动保存到 `~/.openclaw/openclaw-weixin/accounts/`。要绑多个账号就重复执行一次。

## 5. 启动网关并验证

```bash
openclaw gateway restart
openclaw channels status
curl -s -m 10 http://127.0.0.1:18789/health
```

健康检查返回 `{"ok":true,...}` 即正常。网关默认端口 `18789`。

## 6. 打补丁（避免重复回复）

插件默认收到消息会调用内置 agent。如果你在外部轮询处理消息，两条链路会同时回，导致用户收到重复回复。补丁让插件只写库、不派发：

先找到文件（hash 后缀因安装而异）：

```bash
find ~/.openclaw/npm/projects -path "*openclaw-weixin/dist/src/messaging/process-message.js"
```

备份原文件，然后在"消息写入数据库之后、调用内置 agent 之前"插入这三行：

```js
// PATCH: skip gateway agent dispatch entirely — messages are handled externally via quote_messages DB polling.
logger.info(`inbound dispatch skipped (external handler): peer=${ctx.To} accountId=${deps.accountId}`);
return;
```

实测中这三行加在原文件第 164 行之后。注意：插件升级或重装会覆盖补丁，升级后重新打一遍。

## 7. 部署脚本

```bash
mkdir -p ~/wechat-bridge
cp scripts/weixin-send.mjs scripts/weixin-send-image.mjs scripts/gateway-watchdog.sh ~/wechat-bridge/
chmod +x ~/wechat-bridge/gateway-watchdog.sh
```

发消息测试一下（把微信号换成你自己的）：

```bash
node ~/wechat-bridge/weixin-send.mjs "桥接测试" <你的微信号>
```

## 8. 设置定时任务

两个任务：

- **看门狗**：每 2 分钟跑一次 `gateway-watchdog.sh`。网关挂了自动拉起，拉不起来才需要人工介入。看门狗从 `~/.openclaw/.gateway-token` 读 token（OpenClaw 首次启动网关时生成），路径不对就改脚本里的 `TOKEN_FILE`。
- **轮询**：每 10 秒查一次 `quote_messages` 表，用水位文件记录已处理的最大 `created_at`。具体 SQL 和判定规则见 `SKILL.md` 的 "Poll for inbound messages" 一节。

OpenClaw 自带 scheduler 的可以直接建 interval 任务；其他环境用系统 cron 或循环脚本实现。关键规则只有一条：**只保留一条入站链路**，hook 和轮询二选一。

## 9. 端到端验证

1. `curl` 健康检查返回 `{"ok":true}`
2. 用 `weixin-send.mjs` 发一条测试消息，微信能收到
3. 从微信回一条消息，查 `quote_messages` 表出现 `direction='inbound'` 的新行
4. 手动杀掉网关进程，等 2 分钟，看门狗应自动拉起并恢复健康

四项全过，桥接就算跑通了。日常操作看 `SKILL.md`。

## 常见问题

- 插件报 OpenClaw 版本不受支持：升级 OpenClaw 后重启网关。
- Channel 显示 OK 但没连接：确认插件已启用，重启网关，确认已扫码登录。
- 发消息失败：插件升级后安装目录的 hash 可能变化，本仓库脚本会自动查找，无需手动改。
- 收到重复回复：检查是否同时跑了事件 hook 和轮询，只保留一条。
- 轮询误报新消息：`sqlite3 -json` 空结果必须当无新消息，不发确认、不动水位文件。
