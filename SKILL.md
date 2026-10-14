# WeChat Bridge via OpenClaw

Operate the user's WeChat as a two way channel through the OpenClaw weixin plugin. Outbound messages go through a Node send script that calls the plugin API. Inbound messages land in a local sqlite database that you poll with a watermark. A watchdog keeps the gateway process alive.

## Send a message

- Send text with `node ~/workspace/tools/weixin-send.mjs "message text"`. Append a user id as second argument to target someone other than the default account owner.

- Send an image with `node ~/workspace/tools/weixin-send-image.mjs <image_path>`. The script uploads the file through the same plugin API.

- Treat every send as an outward action. Confirm with the user before sending anything they did not ask for, and never invent message content.

- Never print tokens, account ids or conversation ids in replies or logs. The send script reads credentials from `~/.openclaw/openclaw-weixin/accounts/` at runtime.

## Poll for inbound messages

- Query `~/.openclaw/openclaw-weixin/ref-messages.sqlite`, table `quote_messages`, for rows where `direction` is `inbound` and `created_at` is greater than the watermark in `~/.openclaw/wechat-poll-watermark.txt`. `created_at` is a millisecond timestamp.

- Treat an empty result or `[]` from `sqlite3 -json` as no new messages. Never send an acknowledgement and never rewrite the watermark file when there is nothing new.

- When new messages exist, first advance the watermark file to the largest `created_at`, then send a short acknowledgement such as a brief confirmation, then report each message with its timestamp converted to the user's timezone and its full text.

- Never treat rows with `direction` set to `outbound` as new inbound messages.

- Keep exactly one inbound path. If an event hook and a poller both process the same message the user gets duplicate replies, so disable one of them.

## Keep the gateway alive

- Check health with `curl -s -m 10 http://127.0.0.1:18789/health` and look for `"ok":true` in the response.

- Restart with `~/workspace/system/gateway-watchdog.sh` when the health check fails. The script kills stale processes, restarts the gateway with the token from `~/.openclaw/.gateway-token`, waits up to 90 seconds for recovery and logs to `~/workspace/system/gateway-watchdog.log`.

- Run the watchdog on a schedule, every 2 minutes works, so crashes recover without the user noticing. The gateway can flap every hour or so and still recover cleanly each time.

## Troubleshoot the channel

- Read `~/workspace/system/gateway-watchdog.log` first when messages stop flowing. Repeated restarts point at gateway instability rather than the plugin.

- Check that the plugin directory still exists when sends fail. The send script hardcodes the plugin install path including a hash, so a plugin upgrade or reinstall breaks it until the path is updated.

- Remember the plugin patch if duplicate agent replies appear. The file `process-message.js` inside the installed plugin was patched to return after writing to the database instead of invoking the built in agent, and a plugin reinstall overwrites that patch.

- Verify the watermark file holds a plain number when polling misbehaves. A cleared or corrupt watermark causes either missed messages or replays.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
