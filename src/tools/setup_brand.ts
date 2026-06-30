/**
 * Tool: setup_brand —— 接入新品牌(同步建品牌 + 异步首采,扣费)。
 *
 * 调 POST /api/v1/social/brands。同步创建品牌并立即返回 brandId,同时触发一个
 * 异步首采任务(其 jobId 也在返回里,用 get_refresh_progress 轮询)。建品牌成功即扣不退。
 * 建品牌前可先用 prepare_brand_onboarding 由品牌名自动生成关键词/平台/竞品建议(免费)。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(t({ zh: "品牌名,如 'Anker'。", en: "Brand name, e.g. 'Anker'." })),
  monitorPlatforms: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "监测平台列表,如 ['youtube','x','tiktok','trustpilot']。可先用 prepare_brand_onboarding 拿建议。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Platforms to monitor, e.g. ['youtube','x','tiktok','trustpilot']. Use prepare_brand_onboarding for suggestions. Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
  keywords: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "监测关键词(可选)。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Keywords to monitor (optional). Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
  competitors: z
    .array(z.string())
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
        zh: "幂等键(可选)。重试同 key 不重复建品牌/重复扣费。不传则后端自动生成。",
        en: "Idempotency key (optional). Same key won't re-create or double-charge. Auto-generated if omitted.",
      }),
    ),
});

export const setupBrand: Tool<typeof inputSchema> = {
  name: "setup_brand",
  description: t({
    zh: `[接入新品牌 · 扣费] 创建一个要监测的品牌,并立即触发首轮社媒采集。
同步:立刻创建品牌并返回 brandId。异步:同时启动一个首采任务,其 jobId 也在返回里 —— 用 get_refresh_progress(jobId) 轮询首采进度,完成后才有数据可读/可分析。
扣费:建品牌成功即扣不退。
建议:建品牌前先用 prepare_brand_onboarding(品牌名)拿到关键词/平台/竞品建议,再带进来(免费)。
Returns: { brandId, jobId, ... }。
Use when: 用户要新增一个品牌做社媒洞察。
Don't use: 品牌已存在(用 list_brands 找,update_brand 改配置)。`,
    en: `[Onboard a brand · CHARGED] Create a brand to monitor and immediately trigger first-round collection.
Sync: creates the brand and returns brandId right away. Async: also starts a first-collection job whose jobId is in the response — poll it with get_refresh_progress(jobId); data is readable/analyzable once it finishes.
Charge: charged on success (brand created), non-refundable.
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
