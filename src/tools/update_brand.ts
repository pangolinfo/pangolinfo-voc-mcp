/**
 * Tool: update_brand —— 更新品牌配置(免费)。
 *
 * 调 PATCH /api/v1/social/brands/{brandId},body 为除 brandId 外的字段(部分更新)。
 * 只改配置不扣费。改完关键词/竞品/平台后,若想让新口径生效到数据,需再 refresh_brand。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

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
  keywords: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "监测关键词列表(可选)。传则整体替换。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Monitor keywords (optional). Replaces the whole list if provided. Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
  competitors: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "竞品列表(可选)。传则整体替换。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Competitors (optional). Replaces the whole list if provided. Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
  monitorPlatforms: z
    .array(z.string())
    .optional()
    .describe(
      t({
        zh: "监测平台列表(可选)。传则整体替换。注:传空数组 [] 会清空该项;想保持不变就别传这个字段。",
        en: "Monitor platforms (optional). Replaces the whole list if provided. Note: passing [] clears this field; omit the field to keep it unchanged.",
      }),
    ),
});

export const updateBrand: Tool<typeof inputSchema> = {
  name: "update_brand",
  description: t({
    zh: `[更新配置 · 免费] 更新品牌的关键词/竞品/监测平台配置(部分更新,只传要改的)。
注意:改完配置后,若要新口径反映到数据上,需再调 refresh_brand 重新采集。
Returns: data.brand{ ...更新后的配置 }。
Use when: 用户要增删关键词/竞品/平台。
Don't use: 建新品牌(用 setup_brand);只想看当前配置(用 get_brand)。`,
    en: `[Update config · FREE] Update a brand's keywords / competitors / monitor platforms (partial — send only what changes).
Note: after changing config, run refresh_brand to make the new scope reflect in the data.
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
