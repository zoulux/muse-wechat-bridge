#!/usr/bin/env node
// Send a WeChat image message via the openclaw-weixin plugin API.
// Usage: node weixin-send-image.mjs "/path/to/image.jpg" "caption text" [to_user_id]
//
// The account id is resolved in this order:
//   1. WEIXIN_ACCOUNT_ID environment variable
//   2. The first *.json (excluding *.context-tokens.json) in the accounts dir
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

// Find the plugin install dir without hardcoding its hash suffix.
const projectsDir = join(homedir(), ".openclaw/npm/projects");
let pluginDir = null;
for (const entry of readdirSync(projectsDir)) {
  const candidate = join(
    projectsDir, entry, "node_modules/@tencent-weixin/openclaw-weixin"
  );
  if (existsSync(join(candidate, "package.json"))) {
    pluginDir = candidate;
    break;
  }
}
if (!pluginDir) {
  console.error("openclaw-weixin plugin not found under", projectsDir);
  process.exit(1);
}
const require = createRequire(join(pluginDir, "package.json"));
const { sendWeixinMediaFile } = await import(join(pluginDir, "dist/src/messaging/send-media.js"));

const ACCT_DIR = join(homedir(), ".openclaw/openclaw-weixin/accounts");
let accountId = process.env.WEIXIN_ACCOUNT_ID;
if (!accountId) {
  const files = readdirSync(ACCT_DIR).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".context-tokens.json")
  );
  if (files.length === 0) {
    console.error("No account file found in", ACCT_DIR);
    process.exit(1);
  }
  accountId = files[0].replace(/\.json$/, "");
}
const acct = JSON.parse(readFileSync(join(ACCT_DIR, `${accountId}.json`), "utf8"));
const ctxTokens = JSON.parse(
  readFileSync(join(ACCT_DIR, `${accountId}.context-tokens.json`), "utf8")
);

const filePath = process.argv[2];
const text = process.argv[3] || "";
const to = process.argv[4] || acct.userId;
if (!filePath) {
  console.error('Usage: node weixin-send-image.mjs "/path/to/image.jpg" "caption" [to_user_id]');
  process.exit(1);
}

const result = await sendWeixinMediaFile({
  filePath,
  to,
  text,
  opts: {
    baseUrl: acct.baseUrl,
    token: acct.token,
    contextToken: ctxTokens[to],
    accountId,
  },
});
console.log("sent:", JSON.stringify(result).slice(0, 200));
