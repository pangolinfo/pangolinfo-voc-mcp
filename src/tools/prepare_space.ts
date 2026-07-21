/**
 * Tool: prepare_space —— 出知识空间采集计划(免费,默认接入第一步)。
 *
 * 调 POST /api/v1/social/spaces/prepare。无副作用、不扣费。
 * 返回行业候选 + 建议关键词 + 默认渠道 + 三档深度及每档积分估算。
 * 这是"看看某品牌/话题最近在被讨论什么"的默认入口 —— 出计划 → 用户确认行业+渠道+深度 → create_space。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { englishKeywordSchema, socialPlatformSchema } from "./_schemas.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌名或话题,如 'Anker' / '无线耳机降噪'。",
        en: "Brand name or topic, e.g. 'Anker' / 'noise-cancelling earbuds'.",
      }),
    ),
  extraKeywords: z
    .array(englishKeywordSchema("extraKeywords"))
    .max(50)
    .optional()
    .describe(
      t({
        zh: "追加英文关键词(可选,≤50)。含中日韩字符会被拒绝;中文话题请先翻译成英文。传空数组 [] 无意义,省略即可。",
        en: "Extra English keywords (optional, ≤50). CJK keywords are rejected; translate non-English topics first. Omit if none.",
      }),
    ),
  platforms: z
    .array(socialPlatformSchema)
    .max(9)
    .optional()
    .describe(
      t({
        zh: "预选社媒渠道覆盖(可选)。不传则默认给 7 个社媒。仅支持 tiktok/instagram/youtube/x/facebook/pinterest/trustpilot/reddit/threads;知识空间不支持 amazon_reviews。",
        en: "Preselected social platforms (optional). Defaults to 7 social platforms if omitted. Only tiktok/instagram/youtube/x/facebook/pinterest/trustpilot/reddit/threads; Knowledge Spaces do not support amazon_reviews.",
      }),
    ),
});

export const prepareSpace: Tool<typeof inputSchema> = {
  name: "prepare_space",
  description: t({
    zh: `[出采集计划 · 免费 · 默认接入第一步] 由品牌名/话题生成一份采集计划,不扣费、无副作用。
这是"看看某品牌/话题最近在被讨论什么"的**默认入口**:先出计划,把行业候选和按页数预估的费用给用户看,确认后再 create_space 建空间。
Returns: data{ resolvedName, description, industryCandidates[], offeringCandidates[], suggestedKeywords[], brandKeywords[], defaultPlatforms[](7个社媒,各=1渠道单位), optionalPlatforms[](threads=1渠道单位,reddit=2渠道单位), depthOptions[]{tier,maxPages,eta,approxPostsPerPlatform,estimatedPoints}, nextStep }。
关键:采集页数由用户指定(1-10 页,默认 10)。depthOptions 是 上游按几档典型页数给出的预估(每档带 estimatedPoints = 采集要花的积分预估),参考它选页数;最终按 create_space 传入的实际 pages 计费。approxPostsPerPlatform(≈关键词数×页数×35%)只是粗估、非保证,实际以采集结果为准。
关键词必须英文:知识空间的社媒发现关键词请用英文(数据源主要索引英文内容,含中日韩字符的词会被上游丢弃)。中文品牌/话题也应译成英文关键词(如"无线耳机降噪"→"noise cancelling earbuds")。不传 extraKeywords 时,上游默认生成约 12 个英文关键词(品牌词+品类词,随品牌特征浮动,上限 30)。
命名:品牌名有官方英文写法时优先用官方英文名(resolvedName 已按此规整)。
下一步:用户选定**行业(必选,取自 industryCandidates)** + 渠道 + 页数(1-10)后,调 create_space。建空间前务必让用户确认行业/渠道/页数/预估积分与耗时(一次轻确认)。
Use when: 用户想了解某品牌/话题的社媒讨论、口碑、声量 —— 这类需求默认从这里开始。
Don't use: 用户明确要长期精细监测(竞品对比/官网/定时) → 用 setup_brand(完整品牌);品牌/空间已存在 → 用 list_brands 找(同行业/同目标应复用,勿重复新建)。`,
    en: `[Collection plan · FREE · default onboarding step 1] Generate a collection plan from a brand/topic. No side effects, no charge.
This is the **default entry** for "what's being said about brand/topic X lately": get the plan, show the user the industry candidates + the per-page cost estimate, then create_space after confirmation.
Returns: data{ resolvedName, description, industryCandidates[], offeringCandidates[], suggestedKeywords[], brandKeywords[], defaultPlatforms[](7 social, each=1 channel unit), optionalPlatforms[](threads=1 channel unit, reddit=2 channel units), depthOptions[]{tier,maxPages,eta,approxPostsPerPlatform,estimatedPoints}, nextStep }.
Pages are user-specified (1-10, default 10). depthOptions is the upstream provider's estimate at a few typical page counts (each with estimatedPoints = the points the collection will cost); use it to pick a page count — final billing uses the actual pages passed to create_space. approxPostsPerPlatform (≈ keywords × pages × 35%) is a rough estimate, not a guarantee.
Keywords MUST be English: Knowledge-Space social-discovery keywords must be English (the source indexes mostly English; keywords containing CJK characters are dropped upstream). Translate non-English brands/topics into English keywords (e.g. "无线耳机降噪" → "noise cancelling earbuds"). When extraKeywords is omitted, the upstream provider generates ~12 English keywords by default (brand + category terms, varies by brand, max 30).
Naming: prefer the official English brand name when one exists (resolvedName is already normalized this way).
Next: after the user picks an **industry (required, from industryCandidates)** + platforms + pages (1-10), call create_space. Always confirm industry/platforms/pages/estimated points & ETA with the user first (one light confirmation).
Use when: user wants to understand a brand/topic's social discussion, reputation, or share of voice — default to starting here.
Don't use: user explicitly wants long-term fine-grained monitoring (competitors/website/schedule) → use setup_brand; brand/space already exists → use list_brands (reuse same-industry/same-target spaces; don't create duplicates).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`prepare_space: query="${input.query}"`);
    return ctx.client.post("/api/v1/social/spaces/prepare", input);
  },
};
