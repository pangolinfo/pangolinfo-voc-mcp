/**
 * Tool: get_risk_alerts —— 负面突增预警(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/risk-alerts,query 带可选 days。只读不扣费。
 * 依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
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
      t({
        zh: "时间窗(天,可选,最大 365)。例:7、30。不传用后端默认。",
        en: "Time window in days (optional, max 365), e.g. 7, 30. Server default if omitted.",
      }),
    ),
});

export const getRiskAlerts: Tool<typeof inputSchema> = {
  name: "get_risk_alerts",
  description: t({
    zh: `[风险预警 · 免费] 负面突增预警:识别情感/声量异常波动,提示潜在舆情风险。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data.alerts[{ id, severity, type, triggeredAt, summary, relatedPosts[] }], count。
Use when: 用户问"有没有舆情风险/最近是不是有负面爆发"。
Don't use: 要稳态的情感分布(用 get_brand_sentiment);要逐条负面帖(用 search_brand_posts sentiment=negative)。`,
    en: `[Risk alerts · FREE] Sudden-negative alerts: flags abnormal sentiment/volume swings as potential PR risk.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data.alerts[{ id, severity, type, triggeredAt, summary, relatedPosts[] }], count.
Use when: user asks whether there's any PR risk / recent negative spike.
Don't use: for steady-state sentiment split (use get_brand_sentiment); for individual negative posts (use search_brand_posts sentiment=negative).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_risk_alerts: brandId=${input.brandId} days=${input.days ?? ""}`);
    const qs = buildQuery({ days: input.days });
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/risk-alerts${qs}`,
    );
  },
};
