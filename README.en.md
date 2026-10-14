# muse-wechat-bridge

[中文版](README.md)

Turn WeChat into a two-way channel for Muse: send and receive WeChat messages through OpenClaw's weixin plugin (`@tencent-weixin/openclaw-weixin`), with gateway health checks and inbound polling.

This skill was distilled from a real working setup. It ships send scripts, a polling method, a watchdog script, and several lessons learned the hard way.

## What it does

- **Send**: call the plugin API from Node scripts to deliver text and images to WeChat
- **Receive**: the plugin writes inbound messages to a local sqlite database, polled with a watermark file
- **Stay alive**: check gateway health on a schedule and restart it automatically on failure
- **Troubleshoot**: documents real pitfalls such as duplicate inbound paths, empty-result misreads, and plugin upgrades wiping patches

## Repository layout

```
muse-wechat-bridge/
├── SKILL.md                  # the skill: send / receive / keep-alive / troubleshoot
├── skill.yaml                # skill metadata (name, description, category)
├── scripts/
│   ├── weixin-send.mjs       # send a text message
│   ├── weixin-send-image.mjs # send an image message
│   └── gateway-watchdog.sh   # gateway watchdog
├── README.md                 # Chinese readme
└── README.en.md              # this file
```

## Prerequisites

- OpenClaw installed with the `@tencent-weixin/openclaw-weixin` plugin
- WeChat account bound via QR scan, with account config files under `~/.openclaw/openclaw-weixin/accounts/`
- Node.js available

## Quick start

Send a text message:

```bash
node scripts/weixin-send.mjs "Hello from the bridge"
```

Send an image:

```bash
node scripts/weixin-send-image.mjs "/path/to/photo.jpg" "caption"
```

Pick an account explicitly when you have more than one:

```bash
WEIXIN_ACCOUNT_ID=your-account-id node scripts/weixin-send.mjs "hi"
```

Check the gateway:

```bash
curl -s -m 10 http://127.0.0.1:18789/health
```

Run the watchdog (every 2 minutes via cron works well):

```bash
bash scripts/gateway-watchdog.sh
```

## Polling for inbound messages

Inbound messages land in the `quote_messages` table of `~/.openclaw/openclaw-weixin/ref-messages.sqlite`. Track the largest processed `created_at` (millisecond timestamp) in a watermark file and only fetch newer rows:

```sql
SELECT conversation_id, message_id, direction, body, created_at
FROM quote_messages
WHERE direction = 'inbound' AND created_at > <watermark>
ORDER BY created_at ASC;
```

Heads up: `sqlite3 -json` returns empty output or `[]` when there is nothing new. Treat that as "no new messages": do not send an acknowledgement and do not touch the watermark file.

## Privacy

This repository contains no account ids, tokens, conversation ids, or any other personal information. The scripts resolve the account id automatically (environment variable or account directory), and credentials are only read from local files at runtime, never baked into code or logs.

## License

MIT
