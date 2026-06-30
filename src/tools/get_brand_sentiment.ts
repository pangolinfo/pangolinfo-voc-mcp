/**
 * Tool: get_brand_sentiment —— 情感分布 + 正负驱动词(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/sentiment,query 带可选 days。只读不扣费。
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

export const getBrandSentiment: Tool<typeof inputSchema> = {
  name: "get_brand_sentiment",
  description: t({
    zh: `[情感分布 · 免费] 某品牌的情感分布(正/负/中占比)+ 正负驱动词(是什么把口碑往上/往下拉)。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data{ distribution{ positive, negative, neutral }, positiveDrivers[], negativeDrivers[] },支持 days。
Use when: 用户问"口碑好不好/大家在夸什么、骂什么"。
Don't use: 要看突发负面预警(用 get_risk_alerts);要具体负面帖子(用 search_brand_posts sentiment=negative)。`,
    en: `[Sentiment split · FREE] A brand's sentiment distribution (pos/neg/neutral share) + positive/negative drivers (what pulls reputation up/down).
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data{ distribution{ positive, negative, neutral }, positiveDrivers[], negativeDrivers[] }, supports days.
Use when: user asks how the reputation is / what people praise or complain about.
Don't use: for sudden-negative alerts (use get_risk_alerts); for the actual negative posts (use search_brand_posts sentiment=negative).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_brand_sentiment: brandId=${input.brandId} days=${input.days ?? ""}`);
    const qs = buildQuery(input);
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/sentiment${qs}`,
    );
  },
};

function buildQuery(input: { days?: string }): string {
  const parts: string[] = [];
  if (input.days != null) parts.push(`days=${encodeURIComponent(input.days)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
