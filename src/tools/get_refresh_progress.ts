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
轮询建议:采集是 15–45 分钟的长任务,**不要在一轮对话里 while 循环反复查、也不要写脚本/定时器代查**。查一次若仍 processing,就告诉用户还要等(采集通常 15–45 分钟)、结束本轮,让用户下次回来说「查进度」时再查。status=completed/partial 后再去取数据/读分析结果。
Use when: 发起了 create_space/refresh/setup 后,等采集跑完。
Don't use: 没有 jobId 时。`,
    en: `[Check progress · FREE] Poll an async collection job (space first-collection / refresh / brand first-collection). Free, poll as needed.
Pairs with create_space / refresh_brand / setup_brand: they return a collection jobId; poll here until a terminal status.
Returns: { status, progress, phase, platform, postsCollected, postsAnalyzed }.
status ∈ processing | completed | partial | failed.
Polling: collection is a 15–45 min long job — do NOT while-loop it within one turn, and do NOT write a script/timer to poll on your behalf. If one check is still 'processing', tell the user it still needs time (collection usually takes 15–45 min) and end the turn; let the user come back and say "check progress" to poll again. Once completed/partial, fetch data / read the analysis result.
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
