/**
 * Tool: analyze_brand —— DataScaler 固定口径深度分析 shortcut(同步,扣费)。
 *
 * 调 POST /api/v1/social/brands/{id}/analyze。同步:直接返回 report 正文(实测无 jobId)。
 * 扣费:命中套餐额度时免费,额度耗尽自动扣 600 积分(成功响应带 billing.chargedPoints=600)。
 *
 * ⚠️ v0.4:analyze 走 DataScaler **固定分析链路,不支持 systemPromptOverride**。
 *   若要完全用 Pangolin 自己的口吻/结构,改调只读数据端点
 *   (metrics/posts/find_posts_about/sentiment/voice-share/risk-alerts)后由你们自己的 LLM 推理输出。
 * 前置:品牌需已采集完成。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  brandId: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌 ID。该品牌需已有采集过的数据(否则报 data not ready,先 refresh_brand)。",
        en: "Brand id. Brand must have collected data (else 'data not ready' — run refresh_brand first).",
      }),
    ),
  question: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "自由提问。例:'帮我做安克在 YouTube 的 KOC 选号,该投哪些?'",
        en: "Free-form question, e.g. 'Pick KOCs for Anker on YouTube — who should we work with?'",
      }),
    ),
  days: z
    .number()
    .int()
    .positive()
    .max(365)
    .optional()
    .describe(
      t({ zh: "分析的时间窗(天,可选,最大 365)。", en: "Analysis time window in days (optional, max 365)." }),
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,降低重复分析/重复计费风险。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to reduce duplicate-analysis / duplicate-charge risk.",
      }),
    ),
});

export const analyzeBrand: Tool<typeof inputSchema> = {
  name: "analyze_brand",
  description: t({
    zh: `[深度分析 · 扣费 · 同步] 对某品牌的社媒数据自由提问,直接返回合成报告。
同步:本工具直接返回 report 正文(不是 jobId,不用轮询),可能耗时较久(通常 30-60s,上限约 100s),请耐心等待。若你的运行环境更早超时,不要立刻重试(后端可能仍在生成且扣费不退),应先确认上次是否已产出。
扣费:命中套餐额度免费,额度耗尽自动扣 600 积分(成功响应带 billing.chargedPoints=600)。
前置:品牌需已采集完成 —— 若报 data not ready / refresh in progress,先 refresh_brand 并用 get_refresh_progress 等它完成,再分析。
⚠️ 固定口径:analyze 走 DataScaler 固定分析链路,**不支持提示词覆盖**。想完全用自己的口吻/结构,改调只读端点(metrics/posts/find_posts_about/sentiment/voice-share/risk-alerts)后用自己的 LLM 输出。
Returns: { report, usage, billing? }(report 是报告正文;billing.chargedPoints=600 表示扣了 600 积分)。
Use when: 想要 DataScaler 直接给结论的 shortcut。
Don't use: 想完全控制输出口吻/结构(改用只读端点自己推理);只要指标/帖子(get_brand_metrics/search_brand_posts,免费);一句话摘要(get_brand_summary,免费)。`,
    en: `[Deep analysis · CHARGED · sync] Ask a free-form question over a brand's social data → returns the synthesized report directly.
Sync: returns the report body directly (not a jobId, no polling). May take a while (usually 30-60s, up to ~100s) — wait for the response. If your host times out earlier, do NOT immediately retry (the backend may still be generating and charges are non-refundable) — confirm whether the previous run produced a result first.
Charge: free when within plan quota; auto 600 points once quota is exhausted (success response carries billing.chargedPoints=600).
Precondition: brand must have collected data — if 'data not ready' / 'refresh in progress', run refresh_brand and wait via get_refresh_progress first.
Fixed pipeline: analyze runs DataScaler's fixed analysis pipeline and does NOT support prompt override. To fully control tone/structure, call the read-only endpoints (metrics/posts/find_posts_about/sentiment/voice-share/risk-alerts) and reason with your own LLM instead.
Returns: { report, usage, ... } (report = the report body).
Use when: open-ended strategy / KOC-pick / insight questions over social data.
Don't use: for ready metrics/posts (get_brand_metrics/search_brand_posts, free); for a quick summary (get_brand_summary, free).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`analyze_brand: brandId=${brandId}`);
    // analyze 是同步出报告(DataScaler 实时跑 RAG+LLM,实测 30-60s+)。
    // 上限受 scrapeapi 前置的 Cloudflare 524(~100s)约束——Java 侧 dataScalerWebClient
    // 配 115s 贴着 CF 下沿,这里 MCP deadline 设 110s(< CF 524),让超时在 CF 断连前
    // 就由 MCP 报干净的可重试错误,避免"CF 已断、后端仍在跑并扣了 AI 额度"的花钱买超时。
    return ctx.client.post(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}/analyze`,
      body,
      { deadlineMs: 110_000 },
    );
  },
};
