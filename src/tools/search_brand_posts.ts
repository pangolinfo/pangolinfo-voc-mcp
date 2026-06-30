/**
 * Tool: search_brand_posts —— 帖子检索(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/posts,query 带可选 platform/sentiment/sortBy/limit。
 * 只读不扣费。依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand。
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
  platform: z
    .string()
    .optional()
    .describe(
      t({
        zh: "平台过滤(可选)。例:'youtube'、'tiktok'、'instagram'。",
        en: "Platform filter (optional), e.g. 'youtube', 'tiktok', 'instagram'.",
      }),
    ),
  sentiment: z
    .enum(["positive", "negative", "neutral"])
    .optional()
    .describe(
      t({
        zh: "情感过滤(可选):positive / negative / neutral。",
        en: "Sentiment filter (optional): positive / negative / neutral.",
      }),
    ),
  sortBy: z
    .string()
    .optional()
    .describe(
      t({
        zh: "排序字段(可选)。例:'recent'(最新)、'engagement'(互动高)。",
        en: "Sort field (optional), e.g. 'recent', 'engagement'.",
      }),
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(t({ zh: "返回条数上限(可选)。", en: "Max number of posts (optional)." })),
});

export const searchBrandPosts: Tool<typeof inputSchema> = {
  name: "search_brand_posts",
  description: t({
    zh: `[帖子检索 · 免费] 按平台/情感/排序检索某品牌的社媒帖子。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data.posts[{ id, platform, author, content, sentiment, engagement, postedAt, url }], count。
Use when: 用户要看"某平台/某情感下的具体帖子"、或要按互动排序看热帖。
Don't use: 按"意思/语义"找帖(用 find_posts_about);只要汇总指标(用 get_brand_metrics)。`,
    en: `[Post search · FREE] Retrieve a brand's social posts by platform / sentiment / sort.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data.posts[{ id, platform, author, content, sentiment, engagement, postedAt, url }], count.
Use when: user wants specific posts on a platform/sentiment, or top posts by engagement.
Don't use: to find posts by meaning/semantics (use find_posts_about); for aggregate metrics (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`search_brand_posts: brandId=${input.brandId} platform=${input.platform ?? ""}`);
    const qs = buildQuery({
      platform: input.platform,
      sentiment: input.sentiment,
      sortBy: input.sortBy,
      limit: input.limit,
    });
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/posts${qs}`,
    );
  },
};
