/**
 * Tool: get_brand_summary —— 品牌洞察摘要(免费,快速一段式)。
 *
 * 调 POST /api/v1/social/brands/{brandId}/summary,body 为除 brandId 外字段(可空对象)。
 * 上游确认 summary **不扣费**:这是同步、快速的一段式总结,与 analyze_brand
 * (扣费、同步、深度自由提问)区分。依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand。
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
        zh: "品牌 ID(来自 list_brands / setup_brand)。",
        en: "Brand id (from list_brands / setup_brand).",
      }),
    ),
  days: z
    .number()
    .int()
    .positive()
    .max(365)
    .optional()
    .describe(
      t({ zh: "摘要覆盖的时间窗(天,可选,最大 365)。", en: "Summary time window in days (optional, max 365)." }),
    ),
});

export const getBrandSummary: Tool<typeof inputSchema> = {
  name: "get_brand_summary",
  description: t({
    zh: `[品牌摘要 · 免费] 一段式品牌洞察摘要 —— 快速、同步、**不扣费**。
把声量/情感/竞品/风险等浓缩成一段可读总结,适合"快速给我个总览"。
与 analyze_brand 区分:analyze_brand 是扣费 + 同步 + 可自由提问的深度报告;本工具是免费 + 同步 + 固定的一段式摘要,可放心调。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data{ summary(一段文本), highlights[] }。
Use when: 用户要"这品牌现在整体怎么样"的快速总览。
Don't use: 要带具体提问的深度分析/选号(用 analyze_brand,扣费);要结构化指标(用 get_brand_metrics)。`,
    en: `[Brand summary · FREE] One-paragraph brand insight summary — fast, synchronous, NOT charged.
Condenses volume/sentiment/competitor/risk into a readable paragraph; great for 'give me a quick overview'.
Vs analyze_brand: analyze_brand is charged + synchronous + free-form deep report; this is free + synchronous + a fixed one-paragraph summary — safe to call freely.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data{ summary(text), highlights[] }.
Use when: user wants a quick overall read on the brand.
Don't use: for deep analysis with a specific question / KOC-pick (use analyze_brand, charged); for structured metrics (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`get_brand_summary: brandId=${brandId} days=${input.days ?? ""}`);
    return ctx.client.post(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}/summary`,
      body,
    );
  },
};
