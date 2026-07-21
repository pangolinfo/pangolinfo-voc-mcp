/**
 * Tool: refresh_brand —— 发起一次品牌社媒数据采集(异步,扣费)。
 *
 * 调 POST /api/v1/social/brands/{id}/refresh。异步:只返回 jobId 句柄,绝不阻塞 ——
 * 由 agent 用 get_refresh_progress 轮询。采集耗时(90% 在 3h 内)。
 * 采集受理成功后按 estimatedPoints 预估记账(响应里 billing.estimatedPoints 是预估)。
 * 采集深度用 depth(quick/standard/full=页深)或 maxPages(优先)控制。
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
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe(
      t({
        zh: "采集页数(1-10,默认 10)。页数越多数据越全、耗时越长、费用越高(按页计费)。不传=沿用品牌已配置页数。",
        en: "Collection pages (1-10, default 10). More pages = more data, longer, costlier (billed per page). Omit to keep the brand's configured pages.",
      }),
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      t({
        zh: "幂等键(可选,建议带)。网络重试时复用同一个值,降低重复发起采集/重复计费风险;换参数请换新键。",
        en: "Idempotency key (optional, recommended). Reuse the same value on retries to reduce duplicate-collection / duplicate-charge risk; use a new key when params change.",
      }),
    ),
});

export const refreshBrand: Tool<typeof inputSchema> = {
  name: "refresh_brand",
  description: t({
    zh: `[发起采集 · 扣费 · 异步] 立即为某品牌发起一次社媒数据采集。
⚠️ 异步:本工具只返回作业句柄 jobId,**不会等采集完成**(采集是异步长任务,通常 15–45 分钟,约 90% 在 3 小时内完成)。
拿到 jobId 后:**不要**写外部轮询脚本(网络抖动会中断)、**不要**建 host 侧定时/一次性自动化去等(不可靠、常静默不触发)、不要原地干等、不要重复发起。正确姿势:告诉用户预计 15–45 分钟,本轮先结束或做别的只读事,引导用户下次回来发一句「查进度」时再用 get_refresh_progress(jobId) 查;想在同一轮稍等片刻才用 wait_for_refresh(≤20s,超时即还控制权,别 while 循环)。
status 变为 completed/partial 后,再调读类工具(get_brand_metrics/search_brand_posts/...)或 report_follow_up_analysis,此时数据才是新的。
扣费:采集受理成功后按 estimatedPoints 预估记账(响应里 billing.estimatedPoints 是预估)。
在途去重:若该品牌已有采集在跑,不会重复发起(也不会重复扣费),而是复用/返回那个在途 jobId —— 直接用 get_refresh_progress 轮询它,等完成再按需重试。
页数:maxPages(1-10,默认 10)控制本次采集页数并影响费用与耗时;不传则沿用品牌已配置页数。
提示:若只是"数据可能旧了想定期更新",长期定时监测应走 dashboard / 高级接入,而非反复手动 refresh(每次都扣费)。
Returns: { jobId, queuePosition, etaMinutes, billing{estimatedPoints} }。
Use when: 用户要"刷新/更新某品牌的最新社媒数据"。
Don't use: 只想看已有数据(直接用读类工具,免费);查进度(用 get_refresh_progress)。`,
    en: `[Start collection · CHARGED · async] Immediately start a social-media data collection for a brand.
⚠️ Async: returns only a job handle (jobId) and does NOT wait for completion (long async job, usually 15–45 min, ~90% finish within 3h).
After getting jobId: do NOT write an external polling script (a network blip kills it), do NOT create a host-side scheduled/one-shot automation to wait (unreliable, often silently never fires), do NOT busy-wait or re-trigger. Correct pattern: tell the user it takes ~15–45 min, end this turn or do other read-only work, and guide the user to come back and say "check progress" — then call get_refresh_progress(jobId). To wait a moment within the same turn, use wait_for_refresh (≤20s, hands control back on timeout — no while loop).
Once status is completed/partial, call read tools (get_brand_metrics/search_brand_posts/...) or report_follow_up_analysis — data is fresh then.
Charge: recorded by estimatedPoints after collection acceptance (billing.estimatedPoints in the response is an estimate).
In-flight dedup: if a collection is already running for this brand, it will NOT start (or charge for) a second one — it reuses/returns that in-flight jobId. Poll it with get_refresh_progress and retry after it finishes.
Pages: maxPages (1-10, default 10) controls the page count for this collection and affects cost & duration; omit to keep the brand's configured pages.
Tip: if the user just thinks data may be stale and wants periodic updates, long-term scheduled monitoring should go through the dashboard / advanced onboarding, not repeated manual refreshes (each one is charged).
Returns: { jobId, queuePosition, etaMinutes, billing{estimatedPoints} }.
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
