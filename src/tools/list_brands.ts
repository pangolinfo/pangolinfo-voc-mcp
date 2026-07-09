/**
 * Tool: list_brands —— 列出当前用户的品牌(免费,常用入口)。
 *
 * 调 GET /api/v1/social/brands。这是 AI 接入后建议先调的入口:拿到 brandId
 * 才能调其它按 brandId 的工具。数据隔离由后端按 externalUserId 做,只返回该用户自己的品牌。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe(t({ zh: "返回条数上限(可选,最大 100)。", en: "Max number of brands (optional, max 100)." })),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(t({ zh: "分页偏移(可选)。", en: "Pagination offset (optional)." })),
});

export const listBrands: Tool<typeof inputSchema> = {
  name: "list_brands",
  description: t({
    zh: `[列品牌 · 免费] 列出当前用户在做社媒监测的品牌。
这是接入后建议先调的入口:其它按 brandId 的工具都需要先从这里拿到 brandId。
只返回当前用户自己的品牌(数据隔离)。
Returns: data.brands[{ id, name, monitorPlatforms, dataReady, lastRefreshAt }], count。
Use when: 开始任何品牌操作前、或用户问"我有哪些品牌"。
Don't use: 已知 brandId 且要详情(用 get_brand)。`,
    en: `[List brands · FREE] List brands the current user monitors.
Recommended first call: every brandId-based tool needs a brandId from here.
Returns only the current user's own brands (data isolation).
Returns: data.brands[{ id, name, monitorPlatforms, dataReady, lastRefreshAt }], count.
Use when: before any brand operation, or "what brands do I have".
Don't use: when you know the brandId and want detail (use get_brand).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`list_brands: limit=${input.limit ?? ""} offset=${input.offset ?? ""}`);
    const qs = buildQuery({ limit: input.limit, offset: input.offset });
    return ctx.client.get(`/api/v1/social/brands${qs}`);
  },
};
