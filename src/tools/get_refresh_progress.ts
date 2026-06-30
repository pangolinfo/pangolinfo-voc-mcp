/**
 * Tool: get_refresh_progress —— 查采集/分析作业进度(免费,可反复轮询)。
 *
 * 调 GET /api/v1/social/refresh/{jobId}。refresh_brand / analyze_brand /
 * setup_brand 的异步首采都返回 jobId,统一用这个查进度。免费,随便轮询。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  jobId: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "作业 ID(来自 refresh_brand / analyze_brand / setup_brand 的返回)。",
        en: "Job id (from refresh_brand / analyze_brand / setup_brand response).",
      }),
    ),
});

export const getRefreshProgress: Tool<typeof inputSchema> = {
  name: "get_refresh_progress",
  description: t({
    zh: `[查进度 · 免费] 查询一个异步作业(采集/分析/首采)的进度。免费,可反复轮询。
配合 refresh_brand / analyze_brand / setup_brand 使用:它们返回 jobId,这里轮询直到 status 终态。
Returns: { status, progress, phase, platform, postsCollected, postsAnalyzed }。
status ∈ processing(进行中) | completed(完成) | partial(部分完成) | failed(失败)。
轮询建议:间隔几十秒查一次,不要高频空转。status=completed/partial 后再去取数据/读分析结果。
Use when: 发起了 refresh/analyze/setup 后,等它跑完。
Don't use: 没有 jobId 时。`,
    en: `[Check progress · FREE] Poll an async job (collection / analysis / first-collection). Free, poll as needed.
Pairs with refresh_brand / analyze_brand / setup_brand: they return a jobId; poll here until a terminal status.
Returns: { status, progress, phase, platform, postsCollected, postsAnalyzed }.
status ∈ processing | completed | partial | failed.
Polling: every tens of seconds, don't spin. Once completed/partial, fetch data / read the analysis result.
Use when: after starting a refresh/analyze/setup, wait for it to finish.
Don't use: when you have no jobId.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(`get_refresh_progress: jobId=${input.jobId}`);
    return ctx.client.get(
      `/api/v1/social/refresh/${encodeURIComponent(input.jobId)}`,
    );
  },
};
