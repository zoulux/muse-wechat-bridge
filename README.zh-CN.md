# muse-wechat-bridge

[English version](README.md)

把微信变成 Muse 的双向通道：通过 OpenClaw 的微信插件（`@tencent-weixin/openclaw-weixin`）收发微信消息、做网关保活、轮询新消息。

这是从一套真实跑通的配置里沉淀出来的 skill，包含发消息脚本、轮询方法、看门狗脚本，以及几个真实踩过的坑。

## 这是什么

- **发消息**：用 Node 脚本调用插件 API，把文本 / 图片发到微信
- **收消息**：插件把收到的消息写入本地 sqlite，用水位文件轮询新消息
- **保活**：定时检查网关健康，挂了自动重启
- **排障**：整理了单链路、空结果误判、插件升级覆盖补丁等真实教训

## 仓库结构

```
muse-wechat-bridge/
├── SKILL.md                  # skill 正文：发 / 收 / 保活 / 排障四部分
├── skill.yaml                # skill 元信息（名称、描述、分类）
├── scripts/
│   ├── weixin-send.mjs       # 发文本消息
│   ├── weixin-send-image.mjs # 发图片消息
│   └── gateway-watchdog.sh   # 网关看门狗
├── README.md                 # 本文件（中文）
└── README.en.md              # 英文版说明
```

## 前置条件

- 已安装 OpenClaw，并装好 `@tencent-weixin/openclaw-weixin` 插件
- 插件已完成微信扫码绑定，`~/.openclaw/openclaw-weixin/accounts/` 下有账号配置文件
- Node.js 可用

## 快速开始

发一条文本消息：

```bash
node scripts/weixin-send.mjs "你好，这是测试消息"
```

发一张图片：

```bash
node scripts/weixin-send-image.mjs "/path/to/photo.jpg" "配文"
```

多账号时用环境变量指定账号：

```bash
WEIXIN_ACCOUNT_ID=your-account-id node scripts/weixin-send.mjs "hi"
```

检查网关是否存活：

```bash
curl -s -m 10 http://127.0.0.1:18789/health
```

跑看门狗（建议用 cron 每 2 分钟跑一次）：

```bash
bash scripts/gateway-watchdog.sh
```

## 轮询新消息

插件收到消息后写入 `~/.openclaw/openclaw-weixin/ref-messages.sqlite` 的 `quote_messages` 表。用水位文件记录已处理的最大 `created_at`（毫秒时间戳），每次只查更大的：

```sql
SELECT conversation_id, message_id, direction, body, created_at
FROM quote_messages
WHERE direction = 'inbound' AND created_at > <watermark>
ORDER BY created_at ASC;
```

注意：`sqlite3 -json` 查不到结果时输出为空或 `[]`，必须当作"无新消息"，不要发确认、不要动水位文件。

## 隐私说明

本仓库不包含任何账号 ID、token、会话 ID 或其他个人信息。脚本里的账号 ID 改为自动发现（环境变量或账号目录），敏感凭证只在运行时从本地文件读取，绝不写进代码或日志。

## 许可证

MIT
