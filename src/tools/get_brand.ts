/**
 * Tool: get_brand —— 读取单个品牌的配置详情(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}。只读不扣费。返回该品牌的关键词/
 * 竞品/监测平台等配置,以及数据是否就绪。已知 brandId 时用它,不用 list_brands。
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
});

export const getBrand: Tool<typeof inputSchema> = {
  name: "get_brand",
  description: t({
    zh: `[品牌详情 · 免费] 读取单个品牌的配置详情。
返回该品牌的关键词、竞品、监测平台等配置,以及数据是否就绪(dataReady)。
Returns: data.brand{ id, name, keywords, competitors, monitorPlatforms, dataReady, lastRefreshAt }。
Use when: 已知 brandId,想看它的配置/数据就绪状态。
Don't use: 不知道 brandId(先用 list_brands);想要指标数字(用 get_brand_metrics)。`,
    en: `[Brand detail · FREE] Read a single brand's configuration detail.
Returns the brand's keywords, competitors, monitor platforms and whether data is ready (dataReady).
Returns: data.brand{ id, name, keywords, competitors, monitorPlatforms, dataReady, lastRefreshAt }.
Use when: you know the brandId and want its config / data-ready status.
Don't use: when you don't know the brandId (use list_brands first); for metric numbers (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_brand: brandId=${input.brandId}`);
    return ctx.client.get(`/api/v1/social/brands/${encodeURIComponent(input.brandId)}`);
  },
};
