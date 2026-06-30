/**
 * Tool: refresh_brand —— 发起一次品牌社媒数据采集(异步,扣费)。
 *
 * 调 POST /api/v1/social/brands/{id}/refresh。受理即扣不退:拿到 jobId 即扣。
 * 采集耗时(90% 在 3h 内),工具只返回 jobId 句柄,绝不阻塞 —— 由 agent 用
 * get_refresh_progress 轮询。这是本 MCP 异步语义的核心,描述里写死引导。
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
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选)。重试同 key 不重复扣费/重复发起。不传则后端自动生成。",
        en: "Idempotency key (optional). Same key won't double-charge or double-trigger. Auto-generated if omitted.",
      }),
    ),
});

export const refreshBrand: Tool<typeof inputSchema> = {
  name: "refresh_brand",
  description: t({
    zh: `[发起采集 · 扣费 · 异步] 立即为某品牌发起一次社媒数据采集。
⚠️ 异步:本工具只返回作业句柄 jobId,**不会等采集完成**(采集约 90% 在 3 小时内完成)。
拿到 jobId 后,请用 get_refresh_progress(jobId) 轮询进度,**不要原地干等、不要重复发起**。
status 变为 completed/partial 后,再调读类工具(get_brand_metrics/search_brand_posts/...)或 analyze_brand,此时数据才是新的。
扣费:受理即扣不退(拿到 jobId 即视为成功受理)。若已有采集在跑会报错(用 get_refresh_progress 查)。
Returns: { jobId, queuePosition, etaMinutes }。
Use when: 用户要"刷新/更新某品牌的最新社媒数据"。
Don't use: 只想看已有数据(直接用读类工具,免费);查进度(用 get_refresh_progress)。`,
    en: `[Start collection · CHARGED · async] Immediately start a social-media data collection for a brand.
⚠️ Async: returns only a job handle (jobId) and does NOT wait for completion (~90% finish within 3h).
After getting jobId, poll with get_refresh_progress(jobId). Do NOT busy-wait or re-trigger.
Once status is completed/partial, call read tools (get_brand_metrics/search_brand_posts/...) or analyze_brand — data is fresh then.
Charge: charged on acceptance, non-refundable (jobId returned = accepted). Errors if a refresh is already running (check get_refresh_progress).
Returns: { jobId, queuePosition, etaMinutes }.
Use when: user wants to refresh/update a brand's latest social data.
Don't use: to just view existing data (use read tools, free); to check progress (use get_refresh_progress).`,
  }),
  inputSchema,
  async execute(input, ctx) {
    const { brandId, ...body } = input;
    ctx.logger.info(`refresh_brand: brandId=${brandId}`);
    return ctx.client.post(
      `/api/v1/social/brands/${encodeURIComponent(brandId)}/refresh`,
      body,
    );
  },
};
