/**
 * Tool: social_capabilities —— 自省(免费,无后端调用)。
 *
 * AI 第一次接入时建议先调:一次拿到工具全景、默认接入路径(知识空间)、扣费规则、
 * 异步轮询规则、典型工作流。纯本地数据,0 扣费,不打后端。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";
import { SERVER_VERSION } from "../version.js";

const inputSchema = z.object({});

export const socialCapabilities: Tool<typeof inputSchema> = {
  name: "social_capabilities",
  description: t({
    zh: `[自省 · 免费 · 0 调用] 一次性了解本 MCP:能干什么、默认怎么接入、哪些扣费、异步怎么轮询、典型工作流。
AI 首次接入建议先调这个(或 get_context 拿实时账户数据)。纯本地数据,不打后端、不扣费。
Returns: { version, product, onboarding, charging, asyncModel, tools[], workflows[], notes[] }。`,
    en: `[Self-introspection · FREE · 0 backend calls] One call to learn: what this MCP does, the default onboarding path, what's charged, how async polling works, typical workflows.
Recommended first call (or get_context for live account data). Local only — no backend call, no charge.
Returns: { version, product, onboarding, charging, asyncModel, tools[], workflows[], notes[] }.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("social_capabilities");
    return {
      version: SERVER_VERSION,
      product: t({
        zh: "Pangolinfo 品牌社媒洞察(白标)。监测品牌/话题在 TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot 等的声量、情感、竞品、风险,并做 AI 深度分析。",
        en: "Pangolinfo brand social insight (white-label). Monitor a brand/topic's voice/sentiment/competitors/risk across TikTok/X/YouTube/Instagram/Facebook/Pinterest/Trustpilot, plus AI deep analysis.",
      }),
      onboarding: t({
        zh: "默认走【知识空间】(轻量快道):prepare_space(出计划+费用,免费) → 用户确认行业(必选)+渠道+页数 → create_space(建空间+首采,扣费)。只有要竞品对比/官网/定时监测/Amazon 评论才用 setup_brand(完整品牌);Amazon 评论必须传 amazonProducts。",
        en: "Default path = Knowledge Space (lightweight): prepare_space (plan + cost, free) → user confirms industry (required) + platforms + pages → create_space (create + first collection, charged). Use setup_brand (full brand) only for competitors/website/scheduled monitoring/Amazon reviews; Amazon reviews require amazonProducts.",
      }),
      charging: t({
        zh: "只读全免费。采集类(create_space/refresh_brand/setup_brand)按品牌数×渠道数×关键词数×页数×12积分计费,采集受理成功后按预估记账。analyze_brand 每次 600 积分(成功才扣)。prepare_space/get_brand_summary 免费。",
        en: "All reads free. Collection (create_space/refresh_brand/setup_brand) costs brandCount × channelCount × keywordCount × pages × 12 points, recorded by estimate after collection acceptance. analyze_brand = 600 points on success. prepare_space/get_brand_summary are free.",
      }),
      asyncModel: t({
        zh: "采集是异步的:create_space/refresh_brand/setup_brand(首采)返回 jobId,用 get_refresh_progress(jobId) 轮询到 completed/partial 再读数据,或 wait_for_refresh 短等。绝不原地干等或重复发起。analyze_brand 是【同步】的,直接返回报告(可能耗时,耐心等)。",
        en: "Collection is async: create_space/refresh_brand/setup_brand return a jobId; poll get_refresh_progress until completed/partial, or wait_for_refresh briefly. Never busy-wait or re-trigger. analyze_brand is SYNC — returns the report directly (may take a while).",
      }),
      tools: [
        { name: "get_context", group: "context", charged: false },
        { name: "suggest_next_actions", group: "context", charged: false },
        { name: "explain_error", group: "context", charged: false },
        { name: "get_billing_rules", group: "context", charged: false },
        { name: "prepare_space", group: "onboarding", charged: false },
        { name: "create_space", group: "onboarding", charged: true, async: true },
        { name: "list_brands", group: "brand", charged: false },
        { name: "get_brand", group: "brand", charged: false },
        { name: "prepare_brand_onboarding", group: "brand", charged: false },
        { name: "setup_brand", group: "brand", charged: true, async: true },
        { name: "update_brand", group: "brand", charged: false },
        { name: "diagnose_brand", group: "collect", charged: false },
        { name: "refresh_brand", group: "collect", charged: true, async: true },
        { name: "get_refresh_progress", group: "collect", charged: false },
        { name: "wait_for_refresh", group: "collect", charged: false },
        { name: "get_brand_metrics", group: "data", charged: false },
        { name: "search_brand_posts", group: "data", charged: false },
        { name: "find_posts_about", group: "data", charged: false },
        { name: "get_brand_sentiment", group: "data", charged: false },
        { name: "get_voice_share", group: "data", charged: false },
        { name: "compare_competitors", group: "data", charged: false },
        { name: "get_risk_alerts", group: "data", charged: false },
        { name: "analyze_brand", group: "analyze", charged: true, async: false },
        { name: "get_brand_summary", group: "analyze", charged: false },
      ],
      workflows: [
        t({
          zh: "看某品牌/话题在讨论什么(默认):prepare_space(出计划+费用) → 确认行业+渠道+页数 → create_space(扣费,返 jobId) → wait_for_refresh/get_refresh_progress(等采集) → get_brand_metrics/analyze_brand。",
          en: "Explore a brand/topic (default): prepare_space → confirm industry+platforms+pages → create_space (charged, jobId) → wait_for_refresh/get_refresh_progress → get_brand_metrics/analyze_brand.",
        }),
        t({
          zh: "刷新已有品牌:diagnose_brand(看要不要采) → refresh_brand(扣费) → get_refresh_progress(等完成) → 读数据。",
          en: "Refresh existing: diagnose_brand → refresh_brand (charged) → get_refresh_progress → read data.",
        }),
        t({
          zh: "深度问答:确认品牌已采集完成 → analyze_brand(600 积分,同步返回报告)。一句话总结用 get_brand_summary(免费)。",
          en: "Deep Q&A: ensure data → analyze_brand (600 points, sync). Quick summary: get_brand_summary (free).",
        }),
      ],
      notes: [
        t({
          zh: "品牌数据按用户隔离,只看得到自己的。报 data not ready 就先 diagnose_brand / refresh_brand。知识空间不支持 Amazon;要 Amazon 评论用 setup_brand + monitorPlatforms:['amazon_reviews'] + amazonProducts。采集前用 prepare_space 的 estimatedPoints 给用户报价。",
          en: "Brand data is per-user isolated. On 'data not ready', diagnose_brand / refresh_brand first. Knowledge spaces don't support Amazon; for Amazon reviews use setup_brand + monitorPlatforms:['amazon_reviews'] + amazonProducts. Quote prepare_space's estimatedPoints before collecting.",
        }),
        t({
          zh: "【复用优先·重要】create_space 只用于「新建」空间并占一个空间名额。建空间前务必先 list_brands 查已有空间——若同一品牌/同一行业已有可复用的空间,应改用 refresh_brand 复用它(必要时合并关键词后重采),**不要为同一目标重复新建第二个**。空间名额有限且重复空间会分散数据。",
          en: "[Reuse first · IMPORTANT] create_space is for NEW spaces only and consumes a space slot. Before creating, ALWAYS list_brands to check existing spaces — if a reusable space for the same brand/industry already exists, use refresh_brand on it instead (merge keywords + re-collect if needed). **Do NOT create a second space for the same target.** Slots are limited and duplicate spaces fragment the data.",
        }),
        t({
          zh: "支持平台:默认 7 个社媒渠道 tiktok/instagram/youtube/x/facebook/pinterest/trustpilot(prepare_space 预选);可选同价渠道 reddit/threads(同价无附加费,默认不选);amazon_reviews 不属社媒、需 ASIN 或 Amazon 商品链接,知识空间流程不支持(要 Amazon 评论走 setup_brand + amazonProducts)。所有社媒渠道同价:每品牌/渠道/关键词/页 12 积分。不支持的平台(如小红书/微博/LinkedIn)要明确告知用户不支持,只在支持列表内给替代。",
          en: "Supported platforms: default 7 social channels tiktok/instagram/youtube/x/facebook/pinterest/trustpilot (pre-selected in prepare_space); optional same-price channels reddit/threads (no surcharge, off by default); amazon_reviews is not social + needs an ASIN or Amazon product URL, excluded from the Knowledge Space flow (use setup_brand + amazonProducts for Amazon reviews). All social channels use the same price: 12 points per brand/channel/keyword/page. For unsupported platforms (e.g. Xiaohongshu/Weibo/LinkedIn) tell the user they're unsupported and only suggest alternatives from the supported list.",
        }),
        t({
          zh: "【数据就绪门禁】dataReady = 最近一次采集 completed **且** 采到帖子数>0(采到 0 帖仍算 stale、非故障,常见于新建空品牌或关键词在数据源无内容)。读类工具/analyze_brand 前应确保就绪:数据未就绪会报 DATA_NOT_READY、采集在跑会报 REFRESH_IN_PROGRESS —— 这两种都是可等待的,先 get_refresh_progress 等 completed 再读,不要当失败。",
          en: "[Data-readiness gate] dataReady = last collection completed AND posts>0 (0 posts still counts as stale, NOT a failure — common for a brand-new empty space or keywords with no content in the source). Ensure readiness before read tools / analyze_brand: not-ready → DATA_NOT_READY, collection running → REFRESH_IN_PROGRESS — both are waitable, poll get_refresh_progress until completed then read; don't treat them as failures.",
        }),
        t({
          zh: "【用语与命名】对用户一律称「知识空间」,不要说「品牌位/品牌位额度」。品牌名有官方英文写法时优先用官方英文名。知识空间的社媒发现关键词必须用英文(含中日韩字符的词会被上游丢弃,中文话题请译成英文)。",
          en: "[Wording & naming] Always call it a 'Knowledge Space' to users, not 'brand slot'. Prefer the official English brand name when one exists. Knowledge-Space social-discovery keywords must be English (CJK-containing keywords are dropped upstream; translate non-English topics).",
        }),
        t({
          zh: "【计费细则】建知识空间/建品牌本身只占一个名额、不扣积分;积分在采集受理成功后按 estimatedPoints 预估记账,公式为品牌数×渠道数×关键词数×页数×12。所有计费金额保留 2 位小数。定时/长期监测请走 dashboard 或高级接入,直连 MCP 默认不排期。",
          en: "[Billing details] Creating a space/brand only takes a slot and costs no points; collection is recorded by estimatedPoints after acceptance: brandCount × channelCount × keywordCount × pages × 12. All billing amounts keep 2 decimals. Scheduled/long-term monitoring goes through the dashboard or advanced onboarding — direct MCP does not schedule by default.",
        }),
      ],
    };
  },
};
