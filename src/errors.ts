/**
 * Pangolinfo VOC MCP - structured error type.
 *
 * 每个返回给 AI 的错误都是 PangolinfoError(沿用主 MCP 同一个类名以统一语义)。
 * server 层把它翻成 { isError:true, content:[...] }。工具只 throw,不构造 envelope。
 *
 * 三个问题必须让 AI 一眼看懂:
 *   1. 什么类型问题?         → [CODE] 标签
 *   2. 该不该重试?           → retriable
 *   3. 用户该做什么?         → hintFor 的 action 行(AUTH/QUOTA 带官网 URL)
 */

import { CONFIG } from "./config.js";
import { t } from "./i18n.js";

export type PangolinfoErrorCode =
  | "AUTH"
  | "QUOTA"
  | "RATE_LIMIT"
  | "BAD_INPUT"
  | "SERVER"
  | "NETWORK";

export class PangolinfoError extends Error {
  constructor(
    public code: PangolinfoErrorCode,
    public httpStatus: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "PangolinfoError";
  }

  get retriable(): boolean {
    return isRetriable(this.code);
  }
}

/**
 * HTTP 状态码 → 错误类。用于网络代理/网关返回的真正非 2xx。
 * Pangolinfo 后端自身的业务错误是 HTTP 200 + 非零 code,走 codeFromBizCode。
 */
export function codeFromHttpStatus(status: number): PangolinfoErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 402) return "QUOTA";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 400 && status < 500) return "BAD_INPUT";
  if (status >= 500) return "SERVER";
  return "SERVER";
}

/**
 * Pangolinfo 后端业务错误码 → 6 类。
 *
 * SOURCE OF TRUTH — 转录自
 *   crawler-ext-service/ext-scrapeapi/.../exception/ErrorCode.java
 * social 转发接口复用 scrapeapi 的 ErrorCode,新增 93xx social 段。
 * 不要靠数字范围猜:invalid token 是 1004(在 1xxx 参数块),不是 401。
 */
export function codeFromBizCode(bizCode: number): PangolinfoErrorCode {
  switch (bizCode) {
    // 1xxx 参数异常
    case 1004: // INVALID_TOKEN
      return "AUTH";
    case 1001: // PARAM_IS_NULL
    case 1002: // INVALID_PARAM
    case 1010: // INVALID_API_NAME
      return "BAD_INPUT";
    case 1003: // DUPLICATE_REQUEST
      return "RATE_LIMIT";

    // 2xxx 账户异常 — 额度/套餐相关,重试无用
    case 2000: // ACCOUNT_NOT_EXIST
      return "AUTH";
    case 2001: // BALANCE_INSUFFICIENT
    case 2005: // ACCOUNT_NOT_HAVE_VALID_SETMEAL
    case 2007: // ACCOUNT_ALREADY_EXPIRED
    case 2009: // USAGE_LIMIT_EXCEEDED
    case 2010: // ACCOUNT_BILL_DAY_MISSING
      return "QUOTA";

    // 3xxx 用户模块
    case 3000: // USER_NOT_FOUND
    case 3002: // AUTH_FAIL
    case 3003: // USER_NOT_LOGIN
      return "AUTH";

    // 4xxx 权限/限流
    case 4002: // IP_DENIED
    case 4003: // PERMISSION_DENIED
      return "AUTH";
    case 4029: // TOO_MANY_REQUESTS
    case 4030: // SERVICE_BUSY
      return "RATE_LIMIT";

    // 93xx 社媒洞察(社媒数据由上游数据供应商提供,Java 已把其错误映射成这些码)
    case 9300: // SOCIAL_SERVICE_UNAVAILABLE — 上游/凭证/token 问题,临时
      return "SERVER";
    case 9301: // SOCIAL_BRAND_NOT_FOUND — 品牌不存在或不属于该用户
    case 9302: // SOCIAL_DATA_NOT_READY — 还没采集过数据,需先 refresh
    case 9303: // SOCIAL_REFRESH_IN_PROGRESS — 已有采集在跑
      return "BAD_INPUT";
    case 9304: // SOCIAL_QUOTA_EXCEEDED — 额度耗尽(零售闸门或上游渠道池)
      return "QUOTA";
    case 9305: // SOCIAL_RATE_LIMITED — 调用过频
      return "RATE_LIMIT";

    // 5xxx + catch-all
    default:
      return "SERVER";
  }
}

function isRetriable(code: PangolinfoErrorCode): boolean {
  return code === "RATE_LIMIT" || code === "SERVER" || code === "NETWORK";
}

/**
 * 给 AI 看的结构化提示。server 层渲染成错误文本块。
 * 按当前 locale 在调用时(运行时)解析。
 */
export function hintFor(code: PangolinfoErrorCode): string {
  const url = CONFIG.WEBSITE_URL;
  switch (code) {
    case "AUTH":
      return t({
        zh:
          `API Key 无效或已失效。这不是临时故障,用同一个 key 重试一定还会失败 —— 不要重试。请引导用户:` +
          `1) 登录 ${url} 在控制台复制正确的 API Key;` +
          `2) 写入 ~/.pangolinfo/config.json 或 mcp.json 的 --api-key / ?api_key=;` +
          `3) 重启/重连本 MCP 服务。运行中的进程不热加载 key,你(agent)无法替用户改配置或重连。`,
        en:
          `Invalid or expired API key. Not transient — do NOT retry. Guide the user: ` +
          `1) Log in at ${url} and copy the correct API key; ` +
          `2) Write it into ~/.pangolinfo/config.json or --api-key / ?api_key= in mcp.json; ` +
          `3) Restart / reconnect this MCP server. A running process does NOT hot-reload the key.`,
      });
    case "QUOTA":
      return t({
        zh: `社媒洞察额度不足、账期上限不足或套餐已过期(重试无用)。先用 get_context 看 billingMode:prepaid 用户请前往 ${url} 充值/升级;postpaid 用户请联系账户管理员或 Pangolinfo 支持调整账期上限。`,
        en: `Social-insight quota is insufficient, the billing-period cap is exceeded, or the plan expired (retrying won't help). First call get_context and check billingMode: prepaid users should top up/upgrade at ${url}; postpaid users should contact their account admin or Pangolinfo support to adjust the period cap.`,
      });
    case "RATE_LIMIT":
      return t({
        zh: "调用频率过高(临时)。请降低频率,稍候几秒后重试。",
        en: "Rate limited (transient). Slow down and retry after a few seconds.",
      });
    case "BAD_INPUT":
      return t({
        zh: "请求参数有误,或品牌状态不满足(如品牌不存在、还没采集过数据)。请按错误信息修正:不存在的品牌先用 list_brands 选;没数据先 refresh_brand;已有采集在跑就用 get_refresh_progress 查进度。",
        en: "Invalid input or brand-state precondition unmet (brand missing / no data yet / refresh already running). Fix per the message: pick a brand via list_brands; run refresh_brand if no data; check get_refresh_progress if a refresh is running.",
      });
    case "SERVER":
      return t({
        zh: "服务端临时错误(通常可重试)。请稍候重试;若多次失败请联系 Pangolinfo 支持。",
        en: "Transient server-side error (usually retriable). Retry shortly; contact Pangolinfo support if it persists.",
      });
    case "NETWORK":
      return t({
        zh: "网络异常(临时)。请检查本地到 pangolinfo.com 的网络后重试。",
        en: "Network error (transient). Check local connectivity to pangolinfo.com and retry.",
      });
  }
}
