/**
 * Tool: get_voice_share —— 我 vs 竞品声量份额趋势(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/voice-share,query 带可选 days。只读不扣费。
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

export const getVoiceShare: Tool<typeof inputSchema> = {
  name: "get_voice_share",
  description: t({
    zh: `[声量份额 · 免费] 我 vs 竞品的声量份额(share of voice)趋势。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集(竞品需在品牌配置里设好)。
Returns: data{ series[{ date, shares{ self, [competitor]: pct } }], current{ self, competitors[] } },支持 days。
Use when: 用户问"我在赛道里的声量占比/相比竞品的份额走势"。
Don't use: 要多维(不只声量)的竞品对比(用 compare_competitors);只看自己绝对指标(用 get_brand_metrics)。`,
    en: `[Share of voice · FREE] Me-vs-competitor share-of-voice trend.
Requires existing data — if 'data not ready', run refresh_brand first (competitors must be set in the brand config).
Returns: data{ series[{ date, shares{ self, [competitor]: pct } }], current{ self, competitors[] } }, supports days.
Use when: user asks for my share of voice / trend vs competitors.
Don't use: for multi-dimension competitor comparison (use compare_competitors); for own absolute metrics only (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_voice_share: brandId=${input.brandId} days=${input.days ?? ""}`);
    const qs = buildQuery(input);
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/voice-share${qs}`,
    );
  },
};

function buildQuery(input: { days?: string }): string {
  const parts: string[] = [];
  if (input.days != null) parts.push(`days=${encodeURIComponent(input.days)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
