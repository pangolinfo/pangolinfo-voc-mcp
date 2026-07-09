/**
 * Tool: setup_brand —— 接入新品牌(同步建品牌 + 异步首采,扣费)。
 *
 * 调 POST /api/v1/social/brands。同步创建品牌并立即返回 brandId,同时触发一个
 * 异步首采任务(其 jobId 也在返回里,用 get_refresh_progress 轮询)。建品牌成功即扣不退。
 * 建品牌前可先用 prepare_brand_onboarding 由品牌名自动生成关键词/平台/竞品建议(免费)。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import {
  amazonProductSchema,
  englishKeywordSchema,
  fullBrandPlatformSchema,
} from "./_schemas.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(t({ zh: "品牌名,如 'Anker'。", en: "Brand name, e.g. 'Anker'." })),
  monitorPlatforms: z
    .array(fullBrandPlatformSchema)
    .max(10)
    .optional()
    .describe(
      t({
        zh: "监测平台列表,如 ['youtube','x','tiktok','trustpilot']。完整品牌可包含 amazon_reviews,但必须同时传 amazonProducts。注:传空数组 [] 会清空该项;想保持不变就别传。",
        en: "Platforms to monitor, e.g. ['youtube','x','tiktok','trustpilot']. Full-brand setup may include amazon_reviews, but amazonProducts is then required. [] clears this field; omit to keep unchanged.",
      }),
    ),
  keywords: z
    .array(englishKeywordSchema("keywords"))
    .min(1)
    .max(30)
    .optional()
    .describe(
      t({
        zh: "英文监测关键词(可选,1-30 个)。含中日韩字符会被拒绝;中文话题请先翻译成英文。想保持不变就别传这个字段。",
        en: "English keywords to monitor (optional, 1-30). CJK keywords are rejected; translate non-English topics first. Omit to keep unchanged.",
      }),
    ),
  competitors: z
    .array(z.string())
    .max(3)
    .optional()
    .describe(
      t({
        zh: "竞品品牌(可选,用于声量份额/竞品对比)。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Competitor brands (optional). Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,降低重复建品牌/重复计费风险;换参数请换新键。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to reduce duplicate-brand / duplicate-charge risk; use a new key when params change.",
      }),
    ),
  amazonProducts: z
    .array(amazonProductSchema)
    .min(1)
    .max(20)
    .optional()
    .describe(
      t({
        zh: "Amazon Reviews 商品列表。仅当 monitorPlatforms 包含 amazon_reviews 时需要;每项至少提供 asin 或 url。",
        en: "Amazon Reviews product list. Required only when monitorPlatforms includes amazon_reviews; each item needs at least asin or url.",
      }),
    ),
}).refine(
  (input) =>
    !input.monitorPlatforms?.includes("amazon_reviews") ||
    Boolean(input.amazonProducts?.length),
  {
    path: ["amazonProducts"],
    message:
      "amazonProducts is required when monitorPlatforms includes amazon_reviews",
  },
);

export const setupBrand: Tool<typeof inputSchema> = {
  name: "setup_brand",
  description: t({
    zh: `[接入新品牌 · 扣费] 创建一个要监测的品牌,并立即触发首轮社媒采集。
这是**完整品牌**接入(含竞品/官网/定时),是显式高级用法;想快速看某品牌讨论用 create_space(知识空间)更轻。
Amazon Reviews:只有用户明确要 Amazon 评论且能提供 ASIN 或 Amazon 商品链接时,才传 monitorPlatforms:['amazon_reviews'] + amazonProducts[{asin 或 url}]。
同步:立刻创建品牌并返回 brandId。异步:同时启动一个首采任务,其 jobId 也在返回里 —— 用 get_refresh_progress(jobId) 轮询首采进度,完成后才有数据可读/可分析。
扣费:采集受理成功后按 estimatedPoints 预估记账。
建议:建品牌前先用 prepare_brand_onboarding(品牌名)拿到关键词/平台/竞品建议,再带进来(免费)。
Returns: { brandId, jobId, ... }。
Use when: 用户要新增一个品牌做社媒洞察。
Don't use: 品牌已存在(用 list_brands 找,update_brand 改配置)。`,
    en: `[Onboard a brand · CHARGED] Create a brand to monitor and immediately trigger first-round collection.
This is **full brand** onboarding (competitors/website/scheduling) — an explicit advanced path; to quickly see discussion about a brand, create_space (knowledge space) is lighter.
Amazon Reviews: only include monitorPlatforms:['amazon_reviews'] + amazonProducts[{asin or url}] when the user explicitly wants Amazon reviews and can provide ASINs or Amazon product URLs.
Sync: creates the brand and returns brandId right away. Async: also starts a first-collection job whose jobId is in the response — poll it with get_refresh_progress(jobId); data is readable/analyzable once it finishes.
Charge: recorded by estimatedPoints after collection acceptance.
Tip: call prepare_brand_onboarding(name) first for keyword/platform/competitor suggestions (free), then pass them here.
Returns: { brandId, jobId, ... }.
Use when: user wants to add a new brand for social insight.
Don't use: brand already exists (find via list_brands, edit via update_brand).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`setup_brand: name="${input.name}"`);
    return ctx.client.post("/api/v1/social/brands", input);
  },
};
