/**
 * Tool: create_space —— 建知识空间 + 首采(扣费,默认接入第二步)。
 *
 * 调 POST /api/v1/social/spaces。建空间只占 1 个品牌位、本身不扣积分;
 * 采集完成时按 estimatedCredits 扣。空间底层就是品牌,返回 spaceId(=brandId),
 * 后续所有 /brands/{spaceId}/* (数据/分析/进度) 都用它。
 *
 * ⚠️ industries 必填(≥1,来自 prepare_space 的 industryCandidates + 用户确认);缺失后端返 400。
 * ⚠️ 不支持 amazon(传 amazon_reviews 后端返 400,引导用 setup_brand)。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(t({ zh: "空间/品牌名,如 'Anker'。", en: "Space/brand name, e.g. 'Anker'." })),
  industries: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe(
      t({
        zh: "行业(必填,≥1),取自 prepare_space 的 industryCandidates + 用户确认。写入空间描述、决定采集方向。缺失后端报 400。",
        en: "Industries (required, ≥1), from prepare_space's industryCandidates + user confirmation. Drives collection direction. 400 if missing.",
      }),
    ),
  offerings: z
    .array(z.string())
    .optional()
    .describe(t({ zh: "产品/服务(可选,来自 prepare)。", en: "Products/services (optional, from prepare)." })),
  platforms: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "用户确认的渠道(可选,默认 7 社媒;reddit/threads 同价)。⚠️不支持 amazon,传 amazon_reviews 报 400(需 Amazon 评论用 setup_brand)。",
        en: "Confirmed platforms (optional, default 7 social; reddit/threads same price). ⚠️No amazon — amazon_reviews returns 400 (use setup_brand for Amazon reviews).",
      }),
    ),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe(
      t({
        zh: "采集页数(1-10,默认 10)。每页 = 一屏社媒结果。页数越多数据越全、耗时越长、费用越高(按页计费)。",
        en: "Collection pages (1-10, default 10). Each page = one screen of social results. More pages = more data, longer, costlier (billed per page).",
      }),
    ),
  keywords: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "覆盖关键词(可选,留空自动生成约 12 个英文品牌+品类词,随品牌浮动,上限 30)。**必须英文**:数据源主要索引英文内容,含中日韩字符的词会被上游丢弃(中文话题请译成英文)。",
        en: "Override keywords (optional; ~12 English brand+category keywords auto-generated if omitted, varies by brand, max 30). **Must be English**: the source indexes mostly English; keywords with CJK characters are dropped upstream (translate non-English topics).",
      }),
    ),
  description: z
    .string()
    .optional()
    .describe(t({ zh: "覆盖描述(可选,留空由行业生成)。", en: "Override description (optional)." })),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,避免重复建空间/重复扣费:默认 24 小时内,同一个键命中会直接返回上次结果、不重跑不重扣;但同一个键若换了不同参数会报冲突错(换参数请换新键)。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to avoid a duplicate space / double-charge: within ~24h a repeat with the same key replays the previous result (no re-run, no re-charge); reusing the same key with DIFFERENT params returns a conflict error (use a new key for new params).",
      }),
    ),
});

export const createSpace: Tool<typeof inputSchema> = {
  name: "create_space",
  description: t({
    zh: `[建空间+首采 · 扣费 · 默认接入第二步] 创建一个知识空间并立即开始首轮社媒采集。
建空间只占 1 个品牌位、本身不扣积分;**采集完成时**按 estimatedPoints 扣积分(受理时按预估扣)。
⚠️ 前置:必须先 prepare_space 拿到 industryCandidates,让用户选定 **industries(必填)** 再调本工具;缺 industries 后端报 400。
⚠️ 不支持 amazon(传 amazon_reviews 报 400,引导用 setup_brand)。
异步:立即返回 spaceId + 采集 jobId,**不等采集完成**。用 get_refresh_progress(jobId) 轮询,或 wait_for_refresh 短等。完成后再调读类工具/analyze_brand。
空间底层就是品牌:返回的 spaceId = brandId,后续所有按 brandId 的工具都用它。
Returns: data{ spaceId(=brandId), keywords[], platforms[], maxPages, collection{jobId,total}, billing{estimatedPoints,chargedOn:'collection-completion'} }。
Use when: prepare_space 之后、用户已确认行业+渠道+页数。
Don't use: 要竞品对比/官网/定时(用 setup_brand);要 Amazon 评论(用 setup_brand)。
⚠️ 复用优先:create_space 只用于「新建」并占一个空间名额。调用前先 list_brands 查已有空间——若同一品牌/同一行业已有可复用空间,改用 refresh_brand 复用(必要时合并关键词后重采),**不要为同一目标重复新建第二个空间**。`,
    en: `[Create space + first collection · CHARGED · default onboarding step 2] Create a knowledge space and start first-round collection.
Creating a space only takes 1 brand slot (no credit charge itself); credits are charged **on collection completion** by estimatedPoints (charged upfront by estimate).
⚠️ Precondition: call prepare_space first to get industryCandidates, have the user pick **industries (required)**, then call this. 400 if industries missing.
⚠️ No amazon (amazon_reviews returns 400 — use setup_brand).
Async: returns spaceId + collection jobId immediately, does NOT wait. Poll get_refresh_progress(jobId) or wait_for_refresh. Then call read tools / analyze_brand.
A space IS a brand: returned spaceId = brandId; use it for all brandId-based tools.
Returns: data{ spaceId(=brandId), keywords[], platforms[], maxPages, collection{jobId,total}, billing{estimatedPoints,chargedOn:'collection-completion'} }.
Use when: after prepare_space, once the user confirmed industry + platforms + pages.
Don't use: for competitors/website/schedule (use setup_brand); for Amazon reviews (use setup_brand).
⚠️ Reuse first: create_space is for NEW spaces only and consumes a space slot. Before calling, list_brands to check existing spaces — if a reusable space for the same brand/industry exists, use refresh_brand on it instead (merge keywords + re-collect if needed). **Do NOT create a second space for the same target.**`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`create_space: name="${input.name}" maxPages=${input.maxPages ?? 10}`);
    return ctx.client.post("/api/v1/social/spaces", input);
  },
};
