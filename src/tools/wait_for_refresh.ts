/**
 * Tool: wait_for_refresh —— 短等一个采集作业完成(免费,不无限阻塞)。
 *
 * 调 GET /api/v1/social/refresh/{jobId}/wait?timeoutSeconds=。无副作用、不扣费。
 * 短暂等待,超时即返回当前进度(可能仍是 processing),不会一直挂着。
 * 配合 create_space / refresh_brand 返回的 jobId 用;没等到完成就继续用
 * get_refresh_progress 轮询。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  jobId: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "采集作业 ID(来自 create_space / refresh_brand)。",
        en: "Collection job id (from create_space / refresh_brand).",
      }),
    ),
  timeoutSeconds: z
    .number()
    .int()
    .min(3)
    .max(20)
    .optional()
    .describe(
      t({
        zh: "最长等待秒数(可选,3-20 秒,默认由后端定)。超时即返回当前进度,不会无限等。",
        en: "Max wait seconds (optional, 3-20s, backend default). Returns current progress on timeout — never waits forever.",
      }),
    ),
});

export const waitForRefresh: Tool<typeof inputSchema> = {
  name: "wait_for_refresh",
  description: t({
    zh: `[短等采集完成 · 免费] 短暂等待一个采集作业完成,超时即返回当前进度(不会一直阻塞)。
配合 create_space/refresh_brand 的 jobId 用。不扣费。
Returns: 同 get_refresh_progress(status/progress/billingIntent...)。
Use when: 想稍等一下看采集完没完,但不想无限等。注意:仍可能返回 processing(没等到完成),此时继续用 get_refresh_progress 轮询。`,
    en: `[Short-wait for collection · FREE] Briefly wait for a collection job to finish; returns current progress on timeout (never blocks forever).
Use with the jobId from create_space/refresh_brand. No charge.
Returns: same as get_refresh_progress (status/progress/billingIntent...).
Use when: you want to wait a bit to see if collection finished, without waiting forever. Note: may still return 'processing' (not done) — keep polling with get_refresh_progress then.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`wait_for_refresh: jobId=${input.jobId}`);
    const qs = buildQuery({ timeoutSeconds: input.timeoutSeconds });
    return ctx.client.get(
      `/api/v1/social/refresh/${encodeURIComponent(input.jobId)}/wait${qs}`,
    );
  },
};
