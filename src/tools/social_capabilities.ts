/**
 * Tool: social_capabilities —— 自省(免费,无后端调用)。
 *
 * AI 第一次接入本 MCP 时建议先调:一次拿到工具全景、扣费项、异步轮询规则、
 * 典型工作流,避免边试边猜。纯本地数据,0 扣费,不打后端。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";
import { SERVER_VERSION } from "../version.js";

const inputSchema = z.object({});

export const socialCapabilities: Tool<typeof inputSchema> = {
  name: "social_capabilities",
  description: t({
    zh: `[自省 · 免费 · 0 调用] 一次性了解本 MCP 能干什么、怎么串、哪些扣费、异步怎么轮询。
AI 首次接入建议先调这个,别边试边猜。纯本地数据,不打后端、不扣费。
Returns: { version, tools[], charging, asyncModel, workflows[], notes[] }。`,
    en: `[Self-introspection · FREE · 0 backend calls] One call to learn what this MCP does, how tools chain, what's charged, how async polling works.
Recommended first call on integration. Local data only — no backend call, no charge.
Returns: { version, tools[], charging, asyncModel, workflows[], notes[] }.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("social_capabilities");
    return {
      version: SERVER_VERSION,
      product: t({
        zh: "Pangolin 品牌社媒洞察(白标)。社媒数据采集/语义检索/情感/竞品/深度分析。",
        en: "Pangolin brand social-media insight (white-label). Collection / semantic search / sentiment / competitors / deep analysis.",
      }),
      charging: t({
        zh: "只读全免费。仅 3 个操作扣费:setup_brand(建品牌)、refresh_brand(采集)、analyze_brand(深度分析)。受理即扣不退。get_brand_summary 免费。社媒洞察用独立额度池(social_api)。",
        en: "All reads free. Only 3 charged: setup_brand, refresh_brand, analyze_brand. Charged on acceptance, non-refundable. get_brand_summary is free. Separate credit pool (social_api).",
      }),
      asyncModel: t({
        zh: "采集是异步的:refresh_brand / setup_brand(首采)返回 jobId,用 get_refresh_progress(jobId) 轮询到 completed/partial 再读数据,绝不原地干等或重复发起。analyze_brand 是【同步】的,直接返回报告(可能耗时,耐心等)。analyze 前要确保品牌已采集完成。",
        en: "Collection is async: refresh_brand / setup_brand (first collection) return a jobId; poll get_refresh_progress until completed/partial, then read. analyze_brand is SYNC — returns the report directly (may take a while). Ensure the brand has collected data before analyze.",
      }),
      tools: [
        { name: "list_brands", group: "brand", charged: false },
        { name: "get_brand", group: "brand", charged: false },
        { name: "prepare_brand_onboarding", group: "brand", charged: false },
        { name: "setup_brand", group: "brand", charged: true },
        { name: "update_brand", group: "brand", charged: false },
        { name: "refresh_brand", group: "collect", charged: true, async: true },
        { name: "get_refresh_progress", group: "collect", charged: false },
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
          zh: "新品牌:prepare_brand_onboarding(拿建议) → setup_brand(建+首采,扣费) → get_refresh_progress(等首采) → 读数据。",
          en: "New brand: prepare_brand_onboarding → setup_brand (charged) → get_refresh_progress → read data.",
        }),
        t({
          zh: "刷新已有品牌:refresh_brand(扣费) → get_refresh_progress(等完成) → get_brand_metrics / search_brand_posts / get_brand_sentiment。",
          en: "Refresh existing: refresh_brand (charged) → get_refresh_progress → metrics / posts / sentiment.",
        }),
        t({
          zh: "深度问答:确认品牌已采集完成 → analyze_brand(扣费,同步,直接返回报告)。只要一句话总结用 get_brand_summary(免费)。",
          en: "Deep Q&A: ensure brand has data → analyze_brand (charged, sync, returns report directly). For a quick summary use get_brand_summary (free).",
        }),
      ],
      notes: [
        t({
          zh: "品牌数据按用户隔离:只看得到自己的品牌。报 data not ready 就先 refresh_brand。",
          en: "Brand data is per-user isolated. On 'data not ready', run refresh_brand first.",
        }),
      ],
    };
  },
};
