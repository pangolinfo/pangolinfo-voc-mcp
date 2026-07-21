/**
 * Tool: create_space —— 建知识空间 + 首采(扣费,默认接入第二步)。
 *
 * 调 POST /api/v1/social/spaces。建空间只占 1 个空间名额、本身不扣积分;
 * 采集受理成功后按 estimatedPoints 预估记账。空间底层就是品牌,返回 spaceId(=brandId),
 * 后续所有 /brands/{spaceId}/* (数据/分析/进度) 都用它。
 *
 * ⚠️ industries 必填(≥1,来自 prepare_space 的 industryCandidates + 用户确认);缺失后端返 400。
 * ⚠️ 知识空间不支持 Amazon Reviews;要 Amazon 评论走 setup_brand + amazonProducts。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { englishKeywordSchema, socialPlatformSchema } from "./_schemas.js";
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
    .array(socialPlatformSchema)
    .max(9)
    .optional()
    .describe(
      t({
        zh: "用户确认的社媒渠道(可选,默认 7 社媒各=1渠道单位;threads=1,reddit=2)。仅支持 tiktok/instagram/youtube/x/facebook/pinterest/trustpilot/reddit/threads;知识空间不支持 amazon_reviews。",
        en: "Confirmed social platforms (optional, default 7 social platforms each=1 channel unit; threads=1, reddit=2). Only tiktok/instagram/youtube/x/facebook/pinterest/trustpilot/reddit/threads; Knowledge Spaces do not support amazon_reviews.",
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
    .array(englishKeywordSchema("keywords"))
    .min(1)
    .max(30)
    .optional()
    .describe(
      t({
        zh: "覆盖英文关键词(可选,1-30 个;留空自动生成约 12 个英文品牌+品类词,随品牌浮动,上限 30)。含中日韩字符会被拒绝,中文话题请先翻译成英文。",
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
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,降低重复建空间/重复计费风险;换参数请换新键。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to reduce duplicate-space / duplicate-charge risk; use a new key when params change.",
      }),
    ),
  userConfirmed: z
    .literal(true)
    .describe(
      t({
        zh: "付费确认闸门(必填,只接受 true)。本工具会扣费。置 true 之前,你必须先用 prepare_space 的 estimatedPoints 向用户报价(行业+渠道+页数+预估积分+预计耗时),并得到用户的明确同意。⚠️ 严禁在未向用户报价、未拿到用户确认的情况下自行置 true —— 那等于替用户擅自付费。仅当你已经把预估费用摆给用户、用户点头后,才置 true。",
        en: "Charge confirmation gate (required, only accepts true). This tool is CHARGED. Before setting this true, you MUST quote the cost to the user from prepare_space's estimatedPoints (industry + platforms + pages + estimated points + ETA) and get the user's explicit approval. ⚠️ NEVER set this true on your own without quoting and getting user confirmation — that spends the user's money without consent. Set true only after you have shown the estimate to the user and they agreed.",
      }),
    ),
});

export const createSpace: Tool<typeof inputSchema> = {
  name: "create_space",
  description: t({
    zh: `[建空间+首采 · 扣费 · 默认接入第二步] 创建一个知识空间并立即开始首轮社媒采集。
建空间只占 1 个空间名额、本身不扣积分;采集受理成功后按 estimatedPoints 预估记账。
⚠️ 付费确认闸门:本工具必填 userConfirmed:true。**先用 prepare_space 的 estimatedPoints 向用户报价(行业+渠道+页数+预估积分+预计耗时)、拿到用户明确同意,才置 true 调本工具。** 未报价确认就调用会被拒(缺 userConfirmed 直接 BAD_INPUT)。
⚠️ 前置:必须先 prepare_space 拿到 industryCandidates,让用户选定 **industries(必填)** 再调本工具;缺 industries 后端报 400。
⚠️ 知识空间不支持 Amazon Reviews;要 Amazon 评论请改用 setup_brand,并传 monitorPlatforms:['amazon_reviews'] + amazonProducts[{asin 或 url}]。
异步:立即返回 spaceId + 采集 jobId,**不等采集完成**(采集是异步长任务,通常 15–45 分钟,~90% 在 3 小时内完成)。
⚠️ 采集等待纪律(别踩坑):**不要**写外部轮询脚本去等(网络抖动会中断);**不要**建 host 侧一次性/定时自动化任务去等(不可靠、常静默不触发)。正确姿势:① 告诉用户预计 15–45 分钟(~90% 在 3 小时内完成);② 不要空转干等,本轮可先结束或做别的只读事;③ 让用户下次回来发一句「查 VOC 进度」,那时再用 get_refresh_progress(jobId) 查,完成后再读数据/report_follow_up_analysis;④ 只有想在同一轮里稍等片刻,才用 wait_for_refresh(≤20s,超时即返回,别 while 循环反复调)。
空间底层就是品牌:返回的 spaceId = brandId,后续所有按 brandId 的工具都用它。
Returns: data{ spaceId(=brandId), keywords[], platforms[], maxPages, collection{jobId,total,...}, billing{estimatedPoints,chargedOn:'acceptance' 或类似受理时点} }。(注:返回不含预计耗时字段,耗时按下方 15–45 分钟固定口径向用户说明即可。)
Use when: prepare_space 之后、用户已确认行业+渠道+页数,并已同意预估费用。
Don't use: 要竞品对比/官网/定时(用 setup_brand);要 Amazon 评论(用 setup_brand + amazonProducts)。
⚠️ 复用优先:create_space 只用于「新建」并占一个空间名额。调用前先 list_brands 查已有空间——若同一品牌/同一行业已有可复用空间,改用 refresh_brand 复用(必要时合并关键词后重采),**不要为同一目标重复新建第二个空间**。`,
    en: `[Create space + first collection · CHARGED · default onboarding step 2] Create a knowledge space and start first-round collection.
Creating a space only consumes 1 space slot (no point charge itself); collection is recorded by estimatedPoints after acceptance.
⚠️ Charge confirmation gate: this tool REQUIRES userConfirmed:true. **Quote the cost to the user first from prepare_space's estimatedPoints (industry + platforms + pages + estimated points + ETA), get explicit approval, THEN set true and call.** Calling without quoting is rejected (missing userConfirmed → BAD_INPUT).
⚠️ Precondition: call prepare_space first to get industryCandidates, have the user pick **industries (required)**, then call this. 400 if industries missing.
⚠️ Knowledge Spaces do not support Amazon Reviews; for Amazon reviews use setup_brand with monitorPlatforms:['amazon_reviews'] + amazonProducts[{asin or url}].
Async: returns spaceId + collection jobId immediately, does NOT wait (collection is a long async job, usually 15–45 min, ~90% done within 3h).
⚠️ Collection wait discipline (avoid these traps): do NOT write an external polling script to wait (a network blip kills it); do NOT create a host-side one-shot/scheduled automation to wait (unreliable, often silently never fires). Correct pattern: ① tell the user it takes ~15–45 min (~90% within 3h); ② do NOT busy-wait — end this turn or do other read-only work; ③ have the user come back and say "check VOC progress", then call get_refresh_progress(jobId), and read data / report_follow_up_analysis once done; ④ only to wait a moment within the SAME turn, use wait_for_refresh (≤20s, returns on timeout — do not call it in a while loop).
A space IS a brand: returned spaceId = brandId; use it for all brandId-based tools.
Returns: data{ spaceId(=brandId), keywords[], platforms[], maxPages, collection{jobId,total,...}, billing{estimatedPoints,chargedOn:'acceptance' or similar} }. (Note: the response carries NO ETA field — state the duration to the user using the fixed 15–45 min figure below.)
Use when: after prepare_space, once the user confirmed industry + platforms + pages AND approved the estimated cost.
Don't use: for competitors/website/schedule (use setup_brand); for Amazon reviews (use setup_brand + amazonProducts).
⚠️ Reuse first: create_space is for NEW spaces only and consumes a space slot. Before calling, list_brands to check existing spaces — if a reusable space for the same brand/industry exists, use refresh_brand on it instead (merge keywords + re-collect if needed). **Do NOT create a second space for the same target.**`,
  }),
  inputSchema,
  async execute(input, ctx) {
    // userConfirmed 是 MCP 侧付费闸门(见 inputSchema),不是后端契约字段 ——
    // 剥掉再 POST,发给后端的 payload 与加闸门前完全一致。
    const { userConfirmed: _userConfirmed, ...body } = input;
    ctx.logger.info(`create_space: name="${input.name}" maxPages=${input.maxPages ?? 10}`);
    return ctx.client.post("/api/v1/social/spaces", body);
  },
};
