/**
 * Pangolinfo DataScaler MCP - HTTP client.
 *
 * ALL outbound HTTP goes through this class. Tools call
 * `ctx.client.post(path, body)` / `ctx.client.get(path)` and never touch
 * fetch directly. Auth header (Pangolin API Key) is injected here.
 *
 * 注意:本 client 调的是 Pangolin 自己的后端 /api/v1/social/*(scrapeBase),
 * 不是 DataScaler。DataScaler 凭证由后端持有,这里只带 Pangolin 用户的 key。
 *
 * Uses Node 18+ built-in global `fetch`.
 */

import { CONFIG } from "./config.js";
import { PangolinfoError, codeFromHttpStatus, codeFromBizCode } from "./errors.js";

export interface DataScalerClientOptions {
  apiKey: string;
  /** Base URL — social 接口部署在 scrapeBase 上的 /api/v1/social/*。 */
  baseUrl: string;
  /** Optional fetch impl override, primarily for tests. */
  fetchImpl?: typeof fetch;
}

export class DataScalerClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: DataScalerClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT,
    };
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request("POST", path, body);
  }

  async patch(path: string, body: unknown): Promise<unknown> {
    return this.request("PATCH", path, body);
  }

  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  private async request(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    // Client-side hard timeout. social 端点都是请求-响应(refresh/analyze 也只返 jobId,
    // 秒回 —— 真正的采集/分析是后台异步,由 agent 轮询 get_refresh_progress),
    // 所以统一用一个适中的 deadline。
    const deadlineMs = 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError");
      if (aborted) {
        throw new PangolinfoError(
          "NETWORK",
          0,
          `请求超时:${method} ${path} 超过 ${Math.round(deadlineMs / 1000)}s 未返回(可重试)。` +
            `Request timed out after ${Math.round(deadlineMs / 1000)}s (retriable).`,
          { method, path, deadlineMs, reason: "timeout" },
        );
      }
      throw new PangolinfoError(
        "NETWORK",
        0,
        `网络错误:无法连接 ${method} ${path}(可重试)。` +
          `Network error calling ${method} ${path}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        { method, path, cause: err, reason: "network" },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const code = codeFromHttpStatus(res.status);
      const text = await safeReadText(res);
      throw new PangolinfoError(
        code,
        res.status,
        text || res.statusText || `HTTP ${res.status}`,
        { httpStatus: res.status, method, path, body: text },
      );
    }

    const text = await safeReadText(res);
    if (!text) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return text;
    }

    // Pangolin 后端业务错误以 HTTP 200 + 非零 `code` 返回(ApiResponse 封装)。
    // social 错误码在 93xx 段(见 errors.ts codeFromBizCode)。
    if (isErrorEnvelope(parsed)) {
      const env = parsed as BackendEnvelope;
      throw new PangolinfoError(
        codeFromBizCode(env.code),
        res.status,
        env.message ?? `Backend error ${env.code}`,
        { bizCode: env.code, bizMessage: env.message, method, path, data: env.data },
      );
    }

    return parsed;
  }
}

interface BackendEnvelope {
  code: number;
  message?: string;
  data?: unknown;
}

function isErrorEnvelope(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { code?: unknown }).code === "number" &&
    (body as { code: number }).code !== 0
  );
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
