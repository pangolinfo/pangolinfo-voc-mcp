/**
 * Tool: compare_competitors —— 多维竞品对比(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/competitors/compare,query 带可选 days。只读不扣费。
 * 依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand。
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
    .string()
    .optional()
    .describe(
      t({
        zh: "时间窗(天,可选)。例:'7'、'30'。不传用后端默认。",
        en: "Time window in days (optional), e.g. '7', '30'. Server default if omitted.",
      }),
    ),
});

export const compareCompetitors: Tool<typeof inputSchema> = {
  name: "compare_competitors",
  description: t({
    zh: `[竞品对比 · 免费] 我 vs 各竞品的多维对比(声量、互动、情感、增长等并排)。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集(竞品需在品牌配置里设好)。
Returns: data.comparison[{ brand, volume, engagement, sentiment, growth, ... }](首行为本品牌),支持 days。
Use when: 用户要把自己和竞品在多个维度上摆在一起比。
Don't use: 只看声量份额走势(用 get_voice_share);只看自己(用 get_brand_metrics)。`,
    en: `[Competitor comparison · FREE] Me-vs-competitors across multiple dimensions (volume, engagement, sentiment, growth side by side).
Requires existing data — if 'data not ready', run refresh_brand first (competitors must be set in the brand config).
Returns: data.comparison[{ brand, volume, engagement, sentiment, growth, ... }] (own brand first), supports days.
Use when: user wants own brand and competitors lined up across several dimensions.
Don't use: for share-of-voice trend only (use get_voice_share); for own brand only (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`compare_competitors: brandId=${input.brandId} days=${input.days ?? ""}`);
    const qs = buildQuery(input);
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/competitors/compare${qs}`,
    );
  },
};

function buildQuery(input: { days?: string }): string {
  const parts: string[] = [];
  if (input.days != null) parts.push(`days=${encodeURIComponent(input.days)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
