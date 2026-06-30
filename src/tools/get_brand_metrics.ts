/**
 * Tool: get_brand_metrics —— 品牌指标概览(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/metrics,query 带可选 days。只读不扣费。
 * 依赖品牌已有采集数据 —— 若报 data not ready,先 refresh_brand。
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

export const getBrandMetrics: Tool<typeof inputSchema> = {
  name: "get_brand_metrics",
  description: t({
    zh: `[指标概览 · 免费] 某品牌的核心指标概览:声量、触达、互动、赞评转。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data.metrics{ volume, reach, engagement, likeCommentConversion, ... },支持按 days 时间窗。
Use when: 用户问"这品牌最近表现/声量/互动怎么样"。
Don't use: 要看具体帖子(用 search_brand_posts);要情感分布(用 get_brand_sentiment)。`,
    en: `[Metrics overview · FREE] Core metrics for a brand: volume, reach, engagement, like/comment conversion.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data.metrics{ volume, reach, engagement, likeCommentConversion, ... }, supports a days window.
Use when: user asks how a brand is performing (volume / engagement).
Don't use: for individual posts (use search_brand_posts); for sentiment split (use get_brand_sentiment).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_brand_metrics: brandId=${input.brandId} days=${input.days ?? ""}`);
    const qs = buildQuery(input);
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/metrics${qs}`,
    );
  },
};

function buildQuery(input: { days?: string }): string {
  const parts: string[] = [];
  if (input.days != null) parts.push(`days=${encodeURIComponent(input.days)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
