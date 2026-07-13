/**
 * Tool: get_context —— 一次加载计费模式/品牌/渠道(免费,建议接入先调)。
 *
 * 调 GET /api/v1/social/context。无副作用、不扣费。
 * 一把梭把 AI 接入所需的上下文(billingMode/品牌列表/支持渠道)拿全,
 * 免得逐个工具试探。建议 AI 首次接入时先调这个。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({});

export const getContext: Tool<typeof inputSchema> = {
  name: "get_context",
  description: t({
    zh: `[上下文 · 免费 · 建议接入先调] 一次加载计费模式、已有知识空间/品牌列表、支持平台。
无参数、无副作用、不扣费。AI 首次接入或需要全局状态时先调这个,免得逐个工具试探。
返回是 Pangolinfo 后端 envelope。计费模式看 result.data.billingMode: "prepaid" 表示预付费扣积分余额,"postpaid" 表示后付费按账期记账、不返回也不应询问积分余额。品牌和平台通常在 result.data.data.brands[] / result.data.data.supportedPlatforms[];平台里的 billingChannelUnits 是采集计费权重(reddit=2,普通社媒/threads=1)。
Use when: AI 首次接入、或需要知道用户有哪些知识空间/计费模式/支持哪些平台。`,
    en: `[Context · FREE · recommended first call] Load billing mode, existing knowledge spaces/brands, and supported platforms in one shot.
No params, no side effects, no charge. Call this on first onboarding or whenever you need global state, instead of probing tool by tool.
The response is a Pangolinfo backend envelope. Read result.data.billingMode: "prepaid" means points are deducted from a prepaid balance; "postpaid" means usage is settled by billing period, with no point-balance field returned or expected. Brands/platforms are usually under result.data.data.brands[] / result.data.data.supportedPlatforms[]; billingChannelUnits on platforms is the collection billing weight (reddit=2, normal social/threads=1).
Use when: AI onboarding, or you need to know the user's knowledge spaces / billing mode / supported platforms.`,
  }),
  inputSchema,
  async execute(_input, ctx) {
    ctx.logger.info("get_context");
    return ctx.client.get("/api/v1/social/context");
  },
};
