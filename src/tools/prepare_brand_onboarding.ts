/**
 * Tool: prepare_brand_onboarding —— 由品牌名自动生成配置建议(免费)。
 *
 * 调 POST /api/v1/social/brands/onboarding/prepare,body 透传。只读不扣费:
 * 给一个品牌名,返回建议的关键词/监测平台/竞品,供用户确认后喂给 setup_brand。
 * 常在 setup_brand 之前调,降低用户手填配置的成本。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  brandName: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌名。例:'Anker'。",
        en: "Brand name, e.g. 'Anker'.",
      }),
    ),
});

export const prepareBrandOnboarding: Tool<typeof inputSchema> = {
  name: "prepare_brand_onboarding",
  description: t({
    zh: `[配置建议 · 免费] 由品牌名自动生成关键词/监测平台/竞品建议。
常在 setup_brand 之前调:拿到建议项,用户确认/微调后再喂给 setup_brand 正式建档,省去手填。
Returns: data{ suggestedKeywords[], suggestedPlatforms[], suggestedCompetitors[] }。
Use when: 用户要为一个新品牌建档,但还没想好关键词/竞品/平台。
Don't use: 配置已明确(直接 setup_brand);品牌已建好(用 get_brand / update_brand)。`,
    en: `[Onboarding suggestion · FREE] Auto-generate keyword / platform / competitor suggestions from a brand name.
Often called before setup_brand: get suggestions, let the user confirm/tweak, then feed into setup_brand — saves manual entry.
Returns: data{ suggestedKeywords[], suggestedPlatforms[], suggestedCompetitors[] }.
Use when: onboarding a new brand but keywords/competitors/platforms aren't decided yet.
Don't use: config already clear (call setup_brand directly); brand already exists (use get_brand / update_brand).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`prepare_brand_onboarding: brandName=${input.brandName}`);
    return ctx.client.post(`/api/v1/social/brands/onboarding/prepare`, input);
  },
};
