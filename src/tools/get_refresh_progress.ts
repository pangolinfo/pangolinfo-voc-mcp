/**
 * Tool: get_refresh_progress —— 查采集/分析作业进度(免费,可反复轮询)。
 *
 * 调 GET /api/v1/social/refresh/{jobId}。create_space / refresh_brand /
 * setup_brand 的采集任务返回 jobId,统一用这个查进度。免费,随便轮询。
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
        zh: "采集作业 ID(来自 create_space / refresh_brand / setup_brand 的返回)。",
        en: "Collection job id (from create_space / refresh_brand / setup_brand response).",
      }),
    ),
});

export const getRefreshProgress: Tool<typeof inputSchema> = {
  name: "get_refresh_progress",
  description: t({
    zh: `[查进度 · 免费] 查询一个异步采集作业(建空间首采/刷新/品牌首采)的进度。免费,可反复轮询。
配合 create_space / refresh_brand / setup_brand 使用:它们返回采集 jobId,这里轮询直到 status 终态。
Returns: { status, progress, phase, platform, postsCollected, postsAnalyzed }。
status ∈ processing(进行中) | completed(完成) | partial(部分完成) | failed(失败)。
轮询建议:间隔几十秒查一次,不要高频空转。status=completed/partial 后再去取数据/读分析结果。
Use when: 发起了 create_space/refresh/setup 后,等采集跑完。
Don't use: 没有 jobId 时。`,
    en: `[Check progress · FREE] Poll an async collection job (space first-collection / refresh / brand first-collection). Free, poll as needed.
Pairs with create_space / refresh_brand / setup_brand: they return a collection jobId; poll here until a terminal status.
Returns: { status, progress, phase, platform, postsCollected, postsAnalyzed }.
status ∈ processing | completed | partial | failed.
Polling: every tens of seconds, don't spin. Once completed/partial, fetch data / read the analysis result.
Use when: after starting create_space/refresh/setup, wait for collection to finish.
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
