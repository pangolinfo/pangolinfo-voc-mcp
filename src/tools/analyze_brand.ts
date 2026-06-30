/**
 * Tool: analyze_brand —— 自由提问做深度分析(同步,扣费)。
 *
 * 调 POST /api/v1/social/brands/{id}/analyze。同步:直接返回 report 正文(实测无 jobId),
 * 拿到报告即扣不退。systemPromptOverride 只改"怎么说"不改"数据怎么来/指标怎么算"
 * (契约 §9.2,DataScaler 服务端把数据口径段固定在前)。前置:品牌需已采集完成。
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
    .optional()
    .describe(
      t({ zh: "分析的时间窗(天),可选。", en: "Analysis time window in days (optional)." }),
    ),
  systemPromptOverride: z
    .string()
    .optional()
    .describe(
      t({
        zh: "提示词覆盖(可选)。只改输出'怎么说'(分析框架/报告结构/口吻/角色/侧重点),改不了数据口径与指标算法。",
        en: "Prompt override (optional). Changes only HOW it's said (framework/structure/tone/role/focus); cannot change data scope or metric definitions.",
      }),
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选)。重试同 key 不重复扣费。不传则后端自动生成。",
        en: "Idempotency key (optional). Same key won't double-charge. Auto-generated if omitted.",
      }),
    ),
});

export const analyzeBrand: Tool<typeof inputSchema> = {
  name: "analyze_brand",
  description: t({
    zh: `[深度分析 · 扣费 · 同步] 对某品牌的社媒数据自由提问,直接返回合成报告。
同步:本工具直接返回 report 正文(不是 jobId,不用轮询),可能耗时较久(最长约180s),请耐心等待。若你的运行环境更早超时,不要立刻重试(后端可能仍在生成且扣费不退),应先确认上次是否已产出。
扣费:拿到报告即扣不退。
前置:品牌需已采集完成 —— 若报 data not ready / refresh in progress,先 refresh_brand 并用 get_refresh_progress 等它完成,再分析。
提示词覆盖:systemPromptOverride 只能定制输出口吻/结构/角色,不能改数据怎么取、指标怎么算(由 DataScaler 保证一致)。
Returns: { report, usage, ... }(report 是报告正文)。
Use when: 用户要基于社媒数据做策略/选号/洞察类的开放问题。
Don't use: 只要现成指标/帖子(用 get_brand_metrics/search_brand_posts,免费);只要一句话摘要(用 get_brand_summary,免费)。`,
    en: `[Deep analysis · CHARGED · sync] Ask a free-form question over a brand's social data → returns the synthesized report directly.
Sync: returns the report body directly (not a jobId, no polling). May take a while (up to ~180s) — wait for the response. If your host times out earlier, do NOT immediately retry (the backend may still be generating and charges are non-refundable) — confirm whether the previous run produced a result first.
Charge: charged once the report is returned, non-refundable.
Precondition: brand must have collected data — if 'data not ready' / 'refresh in progress', run refresh_brand and wait via get_refresh_progress first.
Prompt override: systemPromptOverride customizes only tone/structure/role, NOT data retrieval or metric math.
Returns: { report, usage, ... } (report = the report body).
Use when: open-ended strategy / KOC-pick / insight questions over social data.
Don't use: for ready metrics/posts (get_brand_metrics/search_brand_posts, free); for a quick summary (get_brand_summary, free).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`analyze_brand: brandId=${brandId}`);
    // analyze 是同步出报告(DataScaler 实时跑 RAG+LLM,实测 30-60s+),
    // 给 180s deadline,避免被 client 默认 60s 掐断成假超时。
    return ctx.client.post(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}/analyze`,
      body,
      { deadlineMs: 180_000 },
    );
  },
};
