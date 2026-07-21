/**
 * Tool: update_brand —— 更新品牌配置(免费)。
 *
 * 调 PATCH /api/v1/social/brands/{brandId},body 为除 brandId 外的字段(部分更新)。
 * 只改配置不扣费。改完关键词/竞品/平台后,若想让新口径生效到数据,需再 refresh_brand。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { englishKeywordSchema, fullBrandPlatformSchema } from "./_schemas.js";
import { t } from "../i18n.js";

// ⚠️ 字段名必须与 上游 Partner API 的 PATCH /brands/{id} 一致 ——
// 之前用 keywords/monitorPlatforms 会被上游当作"无有效改动"而报 400 INVALID_INPUT。
// 正确字段名:brandKeywords(品牌词) / categoryKeywords(品类词) / platforms / competitors
// / brandName / description。这些字段名与上游一致,execute 直接透传。
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
  brandKeywords: z
    .array(englishKeywordSchema("brandKeywords"))
    .max(30)
    .optional()
    .describe(
      t({
        zh: "品牌英文关键词列表(可选,最多 30 个,如 'Ugreen'、'Ugreen charger')。传则整体替换。传空数组 [] 会清空;想保持不变就别传。含中日韩字符会被拒绝。",
        en: "Brand English keywords (optional, max 30; terms that hit the brand itself, e.g. 'Ugreen', 'Ugreen charger'). Replaces the whole list if provided. [] clears it; omit to keep unchanged. CJK keywords are rejected.",
      }),
    ),
  categoryKeywords: z
    .array(englishKeywordSchema("categoryKeywords"))
    .max(30)
    .optional()
    .describe(
      t({
        zh: "品类英文关键词列表(可选,最多 30 个,如 'power bank'、'usb c hub')。传则整体替换。传空数组 [] 会清空;想保持不变就别传。",
        en: "Category English keywords (optional, max 30; generic category terms, e.g. 'power bank', 'usb c hub'). Replaces the whole list if provided. [] clears it; omit to keep unchanged.",
      }),
    ),
  competitors: z
    .array(z.string())
    .max(3)
    .optional()
    .describe(
      t({
        zh: "竞品列表(可选,最多 3 个)。传则整体替换。传空数组 [] 会清空;想保持不变就别传。",
        en: "Competitors (optional, max 3). Replaces the whole list if provided. [] clears it; omit to keep unchanged.",
      }),
    ),
  platforms: z
    .array(fullBrandPlatformSchema)
    .max(10)
    .optional()
    .describe(
      t({
        zh: "监测平台列表(可选,如 ['x','tiktok','youtube','trustpilot'])。支持社媒平台及 amazon_reviews。传则整体替换。传空数组 [] 会清空;想保持不变就别传。",
        en: "Monitor platforms (optional, e.g. ['x','tiktok','youtube','trustpilot']). Supports social platforms plus amazon_reviews. Replaces the whole list if provided. [] clears it; omit to keep unchanged.",
      }),
    ),
  brandName: z
    .string()
    .optional()
    .describe(t({ zh: "品牌名(可选,改品牌显示名)。", en: "Brand name (optional)." })),
  description: z
    .string()
    .optional()
    .describe(t({ zh: "品牌描述(可选)。", en: "Brand description (optional)." })),
});

export const updateBrand: Tool<typeof inputSchema> = {
  name: "update_brand",
  description: t({
    zh: `[更新配置 · 免费] 更新品牌的关键词/竞品/监测平台配置(部分更新,只传要改的;竞品最多 3 个)。
注意:本工具**不立即采集、不扣费**;改的是"长期监测配置",会在**下一次采集(手动 refresh_brand 或定时)时才生效**。想让新口径马上反映到数据,改完再调 refresh_brand。
Returns: data.brand{ ...更新后的配置 }。
Use when: 用户要增删关键词/竞品/平台。
Don't use: 建新品牌(用 setup_brand);只想看当前配置(用 get_brand)。`,
    en: `[Update config · FREE] Update a brand's keywords / competitors / monitor platforms (partial — send only what changes; competitors max 3).
Note: this does NOT collect or charge; it edits the long-term monitoring config, which takes effect on the NEXT collection (manual refresh_brand or scheduled). To reflect the new scope immediately, run refresh_brand after.
Returns: data.brand{ ...updated config }.
Use when: user wants to add/remove keywords/competitors/platforms.
Don't use: to create a new brand (use setup_brand); to just view config (use get_brand).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`update_brand: brandId=${brandId}`);
    return ctx.client.patch(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}`,
      body,
    );
  },
};
