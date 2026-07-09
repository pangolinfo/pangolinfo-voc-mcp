/**
 * Tool: find_posts_about —— 语义检索(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/posts/semantic,query 带 query(必填)+limit(可选)。
 * 只读不扣费。按"意思"找帖(向量召回),而非关键词精确匹配。
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
  query: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "语义检索词(按'意思'找帖,非精确关键词)。例:'抱怨续航不行的帖子'。",
        en: "Semantic query (find posts by meaning, not exact keywords), e.g. 'posts complaining about battery life'.",
      }),
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe(t({ zh: "返回条数上限(可选,最大 100)。", en: "Max number of posts (optional, max 100)." })),
});

export const findPostsAbout: Tool<typeof inputSchema> = {
  name: "find_posts_about",
  description: t({
    zh: `[语义检索 · 免费] 按"意思"找帖(向量召回),而非关键词精确匹配。
依赖品牌已有数据 —— 若报 data not ready,先 refresh_brand 采集。
Returns: data.posts[{ id, platform, content, sentiment, score(相关度), url }], count。
Use when: 用户用自然语言描述想找的帖子主题(如"提到送礼场景的""吐槽客服的")。
Don't use: 要按平台/情感等结构化条件过滤(用 search_brand_posts);要汇总指标(用 get_brand_metrics)。`,
    en: `[Semantic search · FREE] Find posts by meaning (vector recall), not exact keyword match.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data.posts[{ id, platform, content, sentiment, score(relevance), url }], count.
Use when: user describes the topic in natural language (e.g. 'posts mentioning gifting', 'complaints about support').
Don't use: for structured filters like platform/sentiment (use search_brand_posts); for aggregate metrics (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`find_posts_about: brandId=${input.brandId} query=${input.query}`);
    const qs = buildQuery({ query: input.query, limit: input.limit });
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/posts/semantic${qs}`,
    );
  },
};
