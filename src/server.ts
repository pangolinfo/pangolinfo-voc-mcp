/**
 * Pangolinfo DataScaler MCP - server entry point.
 *
 * Two transports supported, selected by argv / env:
 *
 *   1. stdio (default) — single user, single process. The AI client
 *      forks this binary, talks JSON-RPC over stdin/stdout. API key
 *      resolved once at boot from --api-key / env / config file.
 *
 *   2. HTTP / streamable (--transport=http or PANGOLINFO_TRANSPORT=http) —
 *      multi-tenant. Process stays up, accepts POST /mcp with the
 *      caller's API key in the URL query string (`?api_key=pgl_xxx`)
 *      or the `Authorization: Bearer pgl_xxx` header. Each request
 *      builds its own DataScalerClient + Server instance so two users
 *      never share auth state.
 *
 * In both modes, tool registration is identical — `buildServer(ctx)`
 * wires the same Server with the same social-insight tools and the same error
 * envelope semantics.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z, ZodError } from "zod";

// NOTE: i18n MUST be imported before tools/index — the i18n module
// auto-detects locale in a top-level IIFE so that tool files (which
// resolve `t({zh,en})` at their own top level) see the correct locale
// by the time they're evaluated. Keeping it as the first local import
// makes the ordering explicit. See CONTRACT-i18n.md §2.2.
import { getLocale, t } from "./i18n.js";
import { loadAuth } from "./auth.js";
import { DataScalerClient } from "./client.js";
import { CONFIG } from "./config.js";
import { PangolinfoError, hintFor } from "./errors.js";
import { tools } from "./tools/index.js";
import type { Tool, ToolContext, ToolLogger } from "./tools/_types.js";
import { SERVER_VERSION } from "./version.js";

/** Logger that writes to stderr — stdout is reserved for the stdio MCP protocol. */
const logger: ToolLogger = {
  info(msg) {
    process.stderr.write(`[pangolinfo-datascaler-mcp] ${msg}\n`);
  },
  error(msg, err) {
    const suffix = err ? `: ${err.stack ?? err.message}` : "";
    process.stderr.write(`[pangolinfo-datascaler-mcp][error] ${msg}${suffix}\n`);
  },
};

/**
 * Wire a Server instance against a given ToolContext (which carries the
 * client+logger). Identical behavior across transports — separating this
 * out lets the HTTP path build a fresh Server-per-request with the
 * caller's API key, while stdio builds it once at boot.
 */
/**
 * 面向 AI 的顶层剧本(MCP instructions)。用当前 locale 解析,让 agent 一上来就知道
 * 默认怎么接入、扣费/异步语义、别踩的坑。工具各自的 description 是细节,这里是全局策略。
 */
const SERVER_INSTRUCTIONS = t({
  zh: `Pangolinfo 品牌社媒洞察(白标)。监测品牌/话题在社媒(TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot)的声量、情感、竞品、风险,并做 AI 深度分析。

接入策略(重要):
1. 首次接入先调 social_capabilities(自省) 或 get_context(实时计费模式/品牌/平台)。get_context 的 result.data.billingMode 为 prepaid 或 postpaid;postpaid 用户按账期记账,不要向用户询问或展示积分余额。
2. 用户想"看看某品牌/话题在讨论什么" → 默认走【知识空间】轻量快道:
   a) prepare_space(query) 出计划(行业候选+建议关键词+渠道+页数档位及每档 estimatedPoints),不扣费;
   b) 把行业候选和预计积分(estimatedPoints)给用户看,让用户确认【行业(必选)+渠道+页数】;
   c) create_space(name, industries, platforms, maxPages, userConfirmed:true) 建空间并首采(扣费,返回 spaceId + 采集 jobId)。**userConfirmed 是付费闸门:必填 true,且只有在你已用 estimatedPoints 向用户报价、拿到用户明确同意后才可置 true;未报价确认就调用会被拒(BAD_INPUT)。**
3. 只有用户明确要长期精细监测(竞品对比/官网/定时刷新/Amazon 评论)才用 setup_brand(完整品牌)。Amazon 评论必须同时提供 amazonProducts[{asin 或 url}]。

异步与轮询(重要,别踩坑):采集是异步长任务,通常 15–45 分钟(~90% 在 3 小时内完成)。create_space/refresh_brand/setup_brand 立即返回 jobId,**采集不会当场完成**。
禁止:**不要**写外部轮询脚本去等它跑完(网络抖动会让脚本中断);**不要**建 host 侧一次性/定时自动化任务去"到点自动出报告"(这类定时器不可靠、常静默不触发,会让整条任务断掉)。
正确姿势:① 告诉用户预计 15–45 分钟(~90% 在 3 小时内完成);② 不要空转干等,本轮可先结束或做别的只读事;③ 引导用户"下次回来发一句『查进度』",那时再用 get_refresh_progress(jobId) 查到 status=completed/partial;④ 只有想在同一轮里稍等片刻,才用 wait_for_refresh(≤20s,超时即返回当前进度 —— 超时就把控制权还给用户,不要 while 循环反复调)。完成后才有数据可读/可分析。analyze_brand 是同步的(直接返回报告,可能耗时,耐心等)。

计费:只读全免费。采集按 品牌数×加权渠道单位×关键词数×页数×12 积分 计(普通渠道=1,Threads=1,Reddit=2;受理成功后按预估记账);analyze_brand 每次 600 积分(成功才扣)。采集前务必用 prepare_space 的 estimatedPoints 给用户报价确认。prepaid 从积分余额扣;postpaid 不扣余额、按账期用量结算,但单价相同。

报错处理:data not ready → 先 diagnose_brand / refresh_brand;额度不足 → 先看 get_context.billingMode,prepaid 引导充值/升级,postpaid 引导联系账户管理员或 Pangolinfo 支持调整账期上限;不懂的错误码 → explain_error。知识空间不支持 Amazon;如需 Amazon 评论,改用 setup_brand + monitorPlatforms:['amazon_reviews'] + amazonProducts。品牌数据按用户隔离,只看得到自己的。`,
  en: `Pangolinfo brand social insight (white-label). Monitor a brand/topic's voice/sentiment/competitors/risk across social platforms (TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot), plus AI deep analysis.

Onboarding strategy (important):
1. On first use call social_capabilities (introspection) or get_context (live billing mode/brands/platforms). get_context result.data.billingMode is either prepaid or postpaid; postpaid users are settled by billing period, so do not ask for or display a point balance.
2. When a user wants to "see what's being said about brand/topic X" → default to the lightweight Knowledge Space path:
   a) prepare_space(query) → plan (industry candidates + suggested keywords + platforms + page tiers each with estimatedPoints), no charge;
   b) show the industry candidates and estimated points (estimatedPoints) to the user and confirm [industry (required) + platforms + pages];
   c) create_space(name, industries, platforms, maxPages, userConfirmed:true) → creates the space + first collection (charged; returns spaceId + collection jobId). **userConfirmed is a charge gate: required true, and you may set it true ONLY after you have quoted the cost to the user from estimatedPoints and they explicitly agreed; calling without quoting is rejected (BAD_INPUT).**
3. Use setup_brand (full brand) only when the user explicitly wants long-term fine-grained monitoring (competitor comparison / official site / scheduled refresh / Amazon reviews). Amazon reviews require amazonProducts[{asin or url}].

Async & polling (important — avoid these traps): collection is a long async job, usually 15–45 min (~90% done within 3h). create_space/refresh_brand/setup_brand return a jobId immediately; collection does NOT finish on the spot.
Do NOT: write an external polling script to wait it out (a network blip kills the script); create a host-side one-shot/scheduled automation to "auto-produce the report at time T" (such timers are unreliable and often silently never fire, breaking the whole task).
Correct pattern: ① tell the user it takes ~15–45 min (~90% within 3h); ② do NOT busy-wait — end this turn or do other read-only work; ③ guide the user to "come back and say 'check progress'", then call get_refresh_progress(jobId) until status=completed/partial; ④ only to wait a moment within the SAME turn, use wait_for_refresh (≤20s, returns current progress on timeout — on timeout hand control back to the user, do NOT call it in a while loop). Data is readable/analyzable only after completion. analyze_brand is synchronous (returns the report directly; may take a while).

Billing: all reads free. Collection costs brandCount × weightedChannelUnits × keywordCount × pages × 12 points (normal channels=1, Threads=1, Reddit=2; estimated at acceptance); analyze_brand costs 600 points on success. Always quote prepare_space's estimatedPoints before collecting. Prepaid deducts a point balance; postpaid does not deduct a balance and is settled by billing-period usage, with the same unit prices.

Errors: data not ready → diagnose_brand / refresh_brand first; out of quota → check get_context.billingMode first: prepaid users should top up/upgrade, postpaid users should contact their account admin or Pangolinfo support to adjust the period cap; unknown code → explain_error. Knowledge spaces don't support Amazon; for Amazon reviews use setup_brand + monitorPlatforms:['amazon_reviews'] + amazonProducts. Brand data is per-user isolated.`,
});

function buildServer(ctx: ToolContext): Server {
  const toolsByName = new Map<string, Tool>(tools.map((t) => [t.name, t]));

  const server = new Server(
    {
      name: "pangolinfo-datascaler-mcp",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema, {
        $refStrategy: "none",
      }) as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const reqId = nextReqId();
    const keyTag = ctx.keyTag ?? "stdio";
    const toolName = req.params.name;
    const rawArgs = req.params.arguments ?? {};
    const startedAt = process.hrtime.bigint();

    const tool = toolsByName.get(toolName);
    if (!tool) {
      logCall({ reqId, keyTag, tool: toolName, args: rawArgs, ms: 0, code: "BAD_INPUT" });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `[BAD_INPUT] Unknown tool: ${toolName}`,
          },
        ],
      };
    }

    // Validate input ourselves (safeParse) so a schema failure becomes a
    // human-readable [BAD_INPUT] the AI can act on — naming the offending
    // field, the rule it broke, and the field's own description — instead
    // of a raw ZodError JSON blob the AI can't parse into a fix.
    const validation = tool.inputSchema.safeParse(rawArgs);
    if (!validation.success) {
      logCall({
        reqId,
        keyTag,
        tool: toolName,
        args: rawArgs,
        ms: elapsedMs(startedAt),
        code: "BAD_INPUT",
      });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              `[BAD_INPUT] ${formatZodError(validation.error, tool)}\n` +
              `${hintFor("BAD_INPUT")}\n(retriable=no)\n(ref=${reqId})`,
          },
        ],
      };
    }

    try {
      const parsed = validation.data;
      const result = await tool.execute(parsed, ctx);
      logCall({
        reqId,
        keyTag,
        tool: toolName,
        args: rawArgs,
        ms: elapsedMs(startedAt),
        code: "OK",
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const code = err instanceof PangolinfoError ? err.code : "BAD_INPUT";
      logCall({
        reqId,
        keyTag,
        tool: toolName,
        args: rawArgs,
        ms: elapsedMs(startedAt),
        code,
      });
      return toErrorEnvelope(err, toolName, reqId);
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Structured call logging. One JSON line per tool invocation to stderr, which
// in HTTP mode lands in the pod log (kubectl logs / log platform). Lets us
// answer "which customer called which tool with what args, and what happened"
// when a user reports a problem — the gap that made support triage painful.
//
// `reqId` correlates the MCP-side log line with the backend's own
// ThirdPartyApiCallLog (billing) record. Args are logged in FULL (not
// truncated) per product decision — payloads here carry no secrets.
// ---------------------------------------------------------------------------

let reqCounter = 0;
function nextReqId(): string {
  // Monotonic per-process id. Avoids Date.now()/Math.random() (unavailable
  // in some sandboxes) and is enough to correlate within a pod's lifetime.
  reqCounter += 1;
  return `r${reqCounter.toString(36)}`;
}

function elapsedMs(startedAt: bigint): number {
  return Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
}

interface CallLogFields {
  reqId: string;
  keyTag: string;
  tool: string;
  args: unknown;
  ms: number;
  code: string;
}

function logCall(f: CallLogFields): void {
  let line: string;
  try {
    line = JSON.stringify({
      t: "call",
      reqId: f.reqId,
      key: f.keyTag,
      tool: f.tool,
      args: f.args,
      ms: f.ms,
      code: f.code,
    });
  } catch {
    // args may contain a circular structure (shouldn't, but be safe) —
    // never let logging throw and break the actual tool response.
    line = JSON.stringify({
      t: "call",
      reqId: f.reqId,
      key: f.keyTag,
      tool: f.tool,
      args: "[unserializable]",
      ms: f.ms,
      code: f.code,
    });
  }
  process.stderr.write(`${line}\n`);
}

/**
 * Render a ZodError into AI-actionable text. For each failing field:
 *   - the dotted path (`followups[2]`, `nicheTitle`)
 *   - Zod's own rule message ("ASIN must be 10 ...", "Invalid enum value ...")
 *   - the field's `.describe()` so the AI sees what a VALID value looks like
 *
 * All content comes from the tool's schema itself — no rules invented here.
 * If the schema's constraint changes, this text changes with it.
 */
function formatZodError(error: ZodError, tool: Tool): string {
  // Pull the per-field description map from the tool's top-level object
  // shape. Tools all use z.object({...}) with .describe() on each field.
  const shape =
    tool.inputSchema instanceof z.ZodObject
      ? (tool.inputSchema.shape as Record<string, z.ZodTypeAny>)
      : {};

  const lines = error.issues.map((issue) => {
    const pathStr = issue.path.length ? issue.path.join(".") : "(root)";
    const topField = issue.path[0];
    let descHint = "";
    if (typeof topField === "string" && shape[topField]) {
      const desc = shape[topField].description;
      if (desc) {
        // Keep it short — first sentence / up to ~140 chars — so a long
        // bilingual describe doesn't drown the actual error.
        const firstSentence = desc.split(/[。.\n]/)[0]?.trim() ?? "";
        const clipped =
          firstSentence.length > 140
            ? `${firstSentence.slice(0, 140)}…`
            : firstSentence;
        if (clipped) descHint = `（该参数说明：${clipped}）`;
      }
    }
    return `参数 ${pathStr}：${issue.message}${descHint}`;
  });

  return (
    `${tool.name} 入参校验失败 / invalid arguments：\n` +
    lines.map((l) => `  • ${l}`).join("\n")
  );
}

function toErrorEnvelope(err: unknown, toolName: string, reqId?: string) {
  // A trailing reference line lets a confused user quote `ref=…` to support,
  // which we can grep against the call log. Omitted when no reqId (defensive).
  const ref = reqId ? `\n(ref=${reqId})` : "";

  if (err instanceof PangolinfoError) {
    logger.error(`tool ${toolName} failed [${err.code}]`, err);
    // Line 1: [CODE] + human-first message. Line 2: hint with retry guidance
    // + user action. Line 3: an explicit retriable flag so the AI doesn't have
    // to infer whether to retry.
    const retry = err.retriable ? "retriable=yes" : "retriable=no";
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `[${err.code}] ${err.message}\n${hintFor(err.code)}\n(${retry})${ref}`,
        },
      ],
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error(
    `tool ${toolName} failed unexpectedly`,
    err instanceof Error ? err : undefined,
  );
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `[BAD_INPUT] ${message}\n${hintFor("BAD_INPUT")}\n(retriable=no)${ref}`,
      },
    ],
  };
}

/**
 * Detect the transport from argv (`--transport=http`) or env
 * (PANGOLINFO_TRANSPORT=http). stdio is the default for back-compat
 * with every existing AI client install.
 */
function detectTransport(): "stdio" | "http" {
  const fromArg = process.argv.find((a) => a.startsWith("--transport="));
  if (fromArg) {
    const v = fromArg.split("=")[1]?.toLowerCase();
    if (v === "http" || v === "stdio") return v;
  }
  const fromEnv = process.env.PANGOLINFO_TRANSPORT?.toLowerCase();
  if (fromEnv === "http" || fromEnv === "stdio") return fromEnv;
  return "stdio";
}

/**
 * Extract the per-request API key from either:
 *   - `?api_key=pgl_xxx` URL query parameter (Sorftime-style, easiest)
 *   - `Authorization: Bearer pgl_xxx` header (more professional)
 *
 * The `Bearer` scheme is matched case-INSENSITIVELY per RFC 7235 §2.1
 * ("auth-scheme" is case-insensitive). Many agents/HTTP libraries emit
 * lowercase `bearer ` or uppercase `BEARER `; rejecting those caused
 * spurious 401s even when the caller's key was perfectly valid — the
 * header was present but silently ignored, so the request fell through
 * to the (absent) URL param. See server.ts auth tests.
 *
 * Returns null if neither is present — caller responds 401.
 */
/**
 * The MCP StreamableHTTP transport requires POST requests to accept both
 * `application/json` and `text/event-stream`. Agents frequently send only
 * one (or none), yielding a confusing 406. Normalize the header in place
 * so the SDK transport is satisfied — callers shouldn't need to know the
 * transport's content-negotiation rules. Only mutates when something is
 * missing; a correct header is left untouched.
 */
function ensureStreamableAccept(req: IncomingMessage): void {
  if (req.method !== "POST") return;
  const raw: string | string[] | undefined = req.headers["accept"];
  const current = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  // NOTE: the SDK checks for the LITERAL substrings "application/json" and
  // "text/event-stream" — it does NOT honor `*/*`. So a client sending
  // `Accept: */*` still gets a 406 unless we add the explicit types.
  // Match the SDK's literal check exactly here.
  const lc = current.toLowerCase();
  const hasJson = lc.includes("application/json");
  const hasSse = lc.includes("text/event-stream");
  if (hasJson && hasSse) return;

  const parts: string[] = [];
  if (current.trim()) parts.push(current.trim());
  if (!hasJson) parts.push("application/json");
  if (!hasSse) parts.push("text/event-stream");
  const fixed = parts.join(", ");

  // Update BOTH header views. The MCP SDK's Node transport delegates to
  // Hono's @hono/node-server, which rebuilds the Web `Request` headers
  // from `req.rawHeaders` (the flat [k0,v0,k1,v1,...] array) and ignores
  // the normalized `req.headers` map entirely. So mutating `req.headers`
  // alone is invisible to the transport — we must patch `rawHeaders` too.
  req.headers["accept"] = fixed;
  const rh = req.rawHeaders;
  let patched = false;
  for (let i = 0; i < rh.length; i += 2) {
    if (rh[i]?.toLowerCase() === "accept") {
      rh[i + 1] = fixed;
      patched = true;
      // Keep scanning: there can be multiple Accept entries; collapsing
      // them all to the fixed value is fine and avoids partial matches.
    }
  }
  if (!patched) {
    rh.push("Accept", fixed);
  }
}

function extractApiKey(req: IncomingMessage): string | null {
  // Authorization header takes precedence (less likely to end up in
  // logs / browser history; for clients that bother to set it).
  const auth = req.headers["authorization"];
  if (typeof auth === "string") {
    // Case-insensitive "bearer" + at least one space, then the token.
    const m = /^bearer\s+(.+)$/i.exec(auth.trim());
    if (m) {
      const k = m[1].trim();
      if (k) return k;
    }
  }

  // Fall back to ?api_key=... in the URL.
  if (req.url) {
    try {
      // req.url is path+query only; pair with a dummy origin so URL parses.
      const u = new URL(req.url, "http://localhost");
      const k = u.searchParams.get("api_key") ?? u.searchParams.get("apiKey");
      if (k) return k;
    } catch {
      /* fallthrough */
    }
  }

  return null;
}

/**
 * Read the request body as a JSON object. Used to parse a single
 * MCP JSON-RPC payload before handing it to the SDK transport.
 *
 * SDK's transport.handleRequest accepts either a raw Node request or
 * a pre-parsed body — we parse here so a malformed body returns a clean
 * 400 instead of dying inside the transport.
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function startStdio(): Promise<void> {
  // stdio mode: resolve API key once at boot from --api-key / env /
  // config file. Single user, single process.
  const auth = loadAuth();
  logger.info(`auth loaded from ${auth.source}; scrape_base=${auth.scrapeBase}`);
  const client = new DataScalerClient({
    apiKey: auth.apiKey,
    baseUrl: auth.scrapeBase,
  });
  const ctx: ToolContext = { client, logger };
  const server = buildServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`stdio server connected; ${tools.length} tool(s) registered.`);
}

async function startHttp(): Promise<void> {
  // HTTP mode: multi-tenant. One process, many users — each request
  // brings its own API key. No global auth state, no shared client.
  const port = readPort();
  const scrapeBase = process.env.PANGOLINFO_SCRAPE_BASE ?? CONFIG.DEFAULT_SCRAPE_BASE;

  const httpServer = createServer(async (req, res) => {
    // Health endpoint for k8s liveness/readiness probes. No auth.
    if (req.method === "GET" && (req.url === "/health" || req.url === "/healthz")) {
      writeJson(res, 200, {
        status: "ok",
        version: SERVER_VERSION,
        toolCount: tools.length,
      });
      return;
    }

    // Single MCP endpoint. The streamable transport accepts both
    // POST (request/response) and GET (server-initiated SSE stream).
    // We support both methods on /mcp; SDK transport routes internally.
    const isMcpPath = req.url?.startsWith("/mcp") || req.url?.startsWith("/?");
    if (!isMcpPath && req.url !== "/" && !req.url?.startsWith("/?")) {
      writeJson(res, 404, { error: "Not found", hint: "POST /mcp" });
      return;
    }

    // The StreamableHTTP transport (MCP spec) requires the POST `Accept`
    // header to advertise BOTH application/json AND text/event-stream;
    // otherwise it rejects the request with 406. Many agents/HTTP libs
    // send only `Accept: application/json` (or omit Accept entirely),
    // which surfaced to users as an opaque 406. We don't want callers to
    // care about this protocol detail, so we backfill the missing media
    // type here before handing the request to the SDK transport.
    ensureStreamableAccept(req);

    const apiKey = extractApiKey(req);
    if (!apiKey) {
      // Connection-layer AUTH failure (no key reached the server at all).
      // This is the "mcp 服务连接错误 / 401" customers see before any tool
      // runs. Give the AI the same structured shape it gets from tool
      // errors: a class, an explicit non-retriable flag, and a concrete
      // user action with the website URL.
      writeJson(res, 401, {
        error: "AUTH",
        retriable: false,
        message:
          "未提供 API Key —— 请求未携带凭据，重试无用。" +
          "Missing API key. The request carried no credentials; retrying will not help.",
        hint:
          `请在 MCP 配置里加上 API Key(URL 加 ?api_key=pgl_xxx,或 HTTP 头 Authorization: Bearer pgl_xxx),` +
          `然后重启/重新连接本 MCP 服务使其生效 —— 配置不会热加载。没有 Key 请到 ${CONFIG.WEBSITE_URL} 登录获取。 / ` +
          `Add the key in your MCP config (?api_key=pgl_xxx in the URL, or an ` +
          `Authorization: Bearer pgl_xxx header), then restart/reconnect this MCP server for it to take effect — config is not hot-reloaded. Get a key at ${CONFIG.WEBSITE_URL}.`,
      });
      return;
    }

    // Build per-request client/server. No state leakage between callers.
    const requestLogger: ToolLogger = {
      info(msg) {
        // Don't log full keys — last 4 chars only.
        const tag = `k=…${apiKey.slice(-4)}`;
        process.stderr.write(`[pangolinfo-datascaler-mcp][${tag}] ${msg}\n`);
      },
      error(msg, err) {
        const tag = `k=…${apiKey.slice(-4)}`;
        const suffix = err ? `: ${err.stack ?? err.message}` : "";
        process.stderr.write(`[pangolinfo-datascaler-mcp][${tag}][error] ${msg}${suffix}\n`);
      },
    };

    const client = new DataScalerClient({
      apiKey,
      baseUrl: scrapeBase,
    });
    const ctx: ToolContext = {
      client,
      logger: requestLogger,
      keyTag: `…${apiKey.slice(-8)}`,
    };
    const server = buildServer(ctx);

    // Stateless transport: no sessionId, each request is independent.
    // sessionIdGenerator: undefined opts into stateless mode per SDK docs.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Wire transport to server and let SDK handle the rest.
    res.on("close", () => {
      // Best-effort cleanup if client disconnects mid-stream.
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      const body = req.method === "POST" ? await readJsonBody(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (err) {
      requestLogger.error("handleRequest threw", err instanceof Error ? err : undefined);
      if (!res.headersSent) {
        writeJson(res, 500, {
          error: "SERVER",
          retriable: true,
          message:
            "MCP 服务端临时错误,通常可重试。 / " +
            "Transient MCP server error, usually retriable. " +
            (err instanceof Error ? err.message : String(err)),
        });
      }
    }
  });

  httpServer.listen(port, () => {
    logger.info(
      `http server listening on :${port}; ` +
        `endpoint=/mcp health=/health; ` +
        `${tools.length} tool(s) registered; ` +
        `scrape_base=${scrapeBase}`,
    );
  });

  // Graceful shutdown on SIGTERM (k8s rolling-update sends this).
  const shutdown = (signal: string) => {
    logger.info(`received ${signal}, shutting down...`);
    httpServer.close(() => {
      logger.info("http server closed");
      process.exit(0);
    });
    // Hard kill after 10s if connections won't drain.
    setTimeout(() => {
      logger.error("forced exit after 10s drain timeout");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

function readPort(): number {
  // --port=3000 takes precedence over PORT env (which k8s/PaaS love).
  const fromArg = process.argv.find((a) => a.startsWith("--port="));
  if (fromArg) {
    const n = Number(fromArg.split("=")[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fromEnv = Number(process.env.PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 3000;
}

async function main(): Promise<void> {
  // i18n auto-init already ran on module load; log the resolved locale.
  logger.info(`locale=${getLocale()} version=${SERVER_VERSION}`);
  const transport = detectTransport();
  logger.info(`transport=${transport}`);

  if (transport === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  logger.error("fatal startup error", err instanceof Error ? err : undefined);
  process.exit(1);
});
