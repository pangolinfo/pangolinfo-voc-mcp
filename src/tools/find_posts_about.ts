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
Returns: data.items[{ type, id, postId, platform, content, authorNickname, url, similarity(相关度), publishedAt }], count。兼容返回 posts[]=items[] alias,方便按帖子列表读取。
Use when: 用户用自然语言描述想找的帖子主题(如"提到送礼场景的""吐槽客服的");**也是出 VOC 报告时捞真实用户原话的首选工具**——报告里每品牌配 4–6 条带用户名/平台的真实引文,比只堆词频有说服力得多。
注意(refreshing 锁):若品牌处于 refreshing/dataReady:false(某平台采集卡住会锁住整个品牌),本工具会被阻塞报错。此时别卡在这、改用聚合读取(get_brand_summary/get_brand_sentiment/get_risk_alerts)或 analyze_brand 绕过,先出能出的部分。
Don't use: 要按平台/情感等结构化条件过滤(用 search_brand_posts);要汇总指标(用 get_brand_metrics)。`,
    en: `[Semantic search · FREE] Find posts by meaning (vector recall), not exact keyword match.
Requires existing data — if 'data not ready', run refresh_brand first.
Returns: data.items[{ type, id, postId, platform, content, authorNickname, url, similarity(relevance), publishedAt }], count. Also returns posts[]=items[] as a compatibility alias.
Use when: user describes the topic in natural language (e.g. 'posts mentioning gifting', 'complaints about support'); **also the go-to tool for pulling real user quotes when writing a VOC report** — 4–6 real quotes (with author/platform) per brand are far more convincing than word-frequencies alone.
Note (refreshing lock): if the brand is in refreshing / dataReady:false (one platform stuck collecting locks the whole brand), this tool is blocked and errors out. Don't get stuck — fall back to aggregate reads (get_brand_summary/get_brand_sentiment/get_risk_alerts) or analyze_brand to produce what you can.
Don't use: for structured filters like platform/sentiment (use search_brand_posts); for aggregate metrics (use get_brand_metrics).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`find_posts_about: brandId=${input.brandId} query=${input.query}`);
    const qs = buildQuery({ query: input.query, limit: input.limit });
    const resp = await ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/posts/semantic${qs}`,
    );
    return addPostsAlias(resp);
  },
};

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * DataScaler semantic search returns `items[]`; our earlier MCP text said
 * `posts[]`. Keep the upstream field and add a compatibility alias so agents
 * following either shape can read the result.
 */
function addPostsAlias(resp: unknown): unknown {
  if (!isRecord(resp)) return resp;

  const scopes: RecordLike[] = [resp];
  if (isRecord(resp.data)) {
    scopes.push(resp.data);
    if (isRecord(resp.data.data)) scopes.push(resp.data.data);
  }

  for (const scope of scopes) {
    if (Array.isArray(scope.items) && !Array.isArray(scope.posts)) {
      scope.posts = scope.items;
    }
  }
  return resp;
}
