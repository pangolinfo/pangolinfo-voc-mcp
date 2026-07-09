/**
 * examples/mock-backend.mjs
 *
 * 演示用的极简 mock 后端 —— 扮演真实链路中 Java(crawler-ext-service) 的
 * `/api/v1/social/*` 那一跳,仅用于本地把 MCP 跑通看数据流。
 *
 * ⚠️ 这不是生产代码。真实 Java 那一跳还会做:
 *   - 校验 Pangolinfo API Key、从已认证会话取 userId(注入为 externalUserId)
 *   - 扣费(deductBalance,受理即扣)、按操作差异化定价
 *   - DataScaler 错误码 → Pangolinfo 6 类错误模型映射
 * 这里只做最小转发:注入 DataScaler token + 一个演示用 externalUserId → 透传 staging。
 *
 * 凭证从环境变量读,绝不硬编码(本仓是 public)。运行前先 export:
 *   DATASCALER_TOKEN_ENDPOINT  (如 https://staging.datascaler.ai/oauth/token)
 *   DATASCALER_API_BASE        (如 https://staging.datascaler.ai/partner/v1)
 *   DATASCALER_CLIENT_ID
 *   DATASCALER_CLIENT_SECRET
 *   DEMO_EXTERNAL_USER_ID      (可选,默认 u_demo)
 *   MOCK_PORT                  (可选,默认 8787)
 */
import { createServer } from "node:http";

const TOKEN_EP = need("DATASCALER_TOKEN_ENDPOINT");
const DS_BASE = need("DATASCALER_API_BASE");
const CLIENT_ID = need("DATASCALER_CLIENT_ID");
const CLIENT_SECRET = need("DATASCALER_CLIENT_SECRET");
const EXTERNAL_USER = process.env.DEMO_EXTERNAL_USER_ID || "u_demo";
const PORT = Number(process.env.MOCK_PORT || 8787);

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[mock-java] 缺少环境变量 ${name}。见 examples/README.md`);
    process.exit(1);
  }
  return v;
}

let cachedToken = null;
let expiresAt = 0;
async function getToken() {
  if (cachedToken && Date.now() < expiresAt) return cachedToken;
  // DataScaler 要求 client_secret_basic:凭证走 Basic Auth 头。
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_EP, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`token endpoint HTTP ${res.status}`);
  }
  const j = await res.json();
  cachedToken = j.access_token;
  expiresAt = Date.now() + ((j.expires_in || 3600) - 300) * 1000;
  return cachedToken;
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d || null));
  });
}

const server = createServer(async (req, res) => {
  // MCP 的 client 调 baseUrl + /api/v1/social/<...>。剥前缀拼到 DataScaler。
  const u = new URL(req.url, "http://localhost");
  const m = u.pathname.match(/^\/api\/v1\/social(.*)$/);
  if (!m) {
    res.writeHead(404).end("not a /api/v1/social path");
    return;
  }
  const dsPath = m[1] + (u.search || "");
  const body = await readBody(req);
  const t0 = Date.now();
  try {
    const token = await getToken();
    const dsRes = await fetch(`${DS_BASE}${dsPath}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-DataScaler-External-User-Id": EXTERNAL_USER,
        "Content-Type": "application/json",
      },
      body: req.method === "GET" ? undefined : body,
    });
    const text = await dsRes.text();
    const ms = Date.now() - t0;
    // 标注真实 Java 会在哪扣费(setup/refresh/analyze 的写操作)
    const op = m[1].replace(/\?.*$/, "");
    const charged = req.method !== "GET" && /\/refresh$|\/analyze$|^\/brands$/.test(op);
    process.stderr.write(
      `[mock-java] ${req.method} ${dsPath} -> ${dsRes.status} ${ms}ms` +
        `${charged ? "  [真实 Java 在此扣费]" : ""}\n`,
    );
    res.writeHead(dsRes.status, { "Content-Type": "application/json" }).end(text);
  } catch (e) {
    process.stderr.write(`[mock-java] ERR ${dsPath}: ${e.message}\n`);
    res.writeHead(502).end(JSON.stringify({ code: 9300, message: e.message }));
  }
});

server.listen(PORT, () =>
  process.stderr.write(
    `[mock-java] listening :${PORT} (扮演 Java /api/v1/social/*, externalUser=${EXTERNAL_USER})\n`,
  ),
);
