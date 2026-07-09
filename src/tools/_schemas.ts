import { z } from "zod";

import { t } from "../i18n.js";

export const socialPlatformIds = [
  "tiktok",
  "instagram",
  "youtube",
  "x",
  "facebook",
  "pinterest",
  "trustpilot",
  "reddit",
  "threads",
] as const;

export const fullBrandPlatformIds = [
  ...socialPlatformIds,
  "amazon_reviews",
] as const;

export const socialPlatformSchema = z.enum(socialPlatformIds);
export const fullBrandPlatformSchema = z.enum(fullBrandPlatformIds);

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;

export function englishKeywordSchema(label: string) {
  return z
    .string()
    .min(1)
    .max(100)
    .refine((value) => !CJK_RE.test(value), {
      message: `${label} must be English; translate CJK keywords before calling this tool`,
    });
}

export const amazonProductSchema = z.object({
  asin: z
    .string()
    .min(1)
    .max(20)
    .optional()
    .describe(t({ zh: "Amazon ASIN。", en: "Amazon ASIN." })),
  url: z
    .string()
    .url()
    .optional()
    .describe(t({ zh: "Amazon 商品链接。", en: "Amazon product URL." })),
  title: z
    .string()
    .max(500)
    .optional()
    .describe(t({ zh: "商品标题(可选)。", en: "Product title (optional)." })),
  image: z
    .string()
    .url()
    .optional()
    .describe(t({ zh: "商品图片链接(可选)。", en: "Product image URL (optional)." })),
}).refine((value) => Boolean(value.asin || value.url), {
  message: "amazonProducts item requires asin or url",
});
