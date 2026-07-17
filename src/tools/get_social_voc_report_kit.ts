/**
 * Tool: get_social_voc_report_kit —— 社媒 VOC 报告套件(免费)。
 *
 * 调 GET /api/v1/social/brands/{brandId}/social-voc-report-kit,query 带可选
 * days/filterBy/lang/forceRefresh。只读不扣费(schema social-voc-report-kit.v1.x)。
 *
 * 返回可装配的「报告套件 JSON」(reportSpec + 模块数据 + 叙述 + 样式 CSS + 装配提示),
 * 由调用方 AI 装配成完整 HTML 报告交给用户。这是出 VOC 报告的**默认首选**(免费,官方成品质量)。
 *
 * ⚠️ 交付铁律(方案甲,显式化):拿到 kit 后必须装配成完整 HTML 文档交付,禁止只用 Markdown 充当报告。
 * 依赖品牌已有采集数据 —— 若报 data not ready / refresh in progress,先 refresh_brand。
 */

import { z } from "zod";

import type { Tool } from "./_types.js";
import { buildQuery } from "./_query.js";
import { t } from "../i18n.js";

const inputSchema = z.object({
  brandId: z
    .string()
    .min(1)
    .describe(
      t({
        zh: "品牌 ID(来自 list_brands / create_space / setup_brand)。该品牌需已采集完成(否则 data not ready,先 refresh_brand)。",
        en: "Brand id (from list_brands / create_space / setup_brand). Brand must have collected data (else 'data not ready' — run refresh_brand first).",
      }),
    ),
  days: z
    .number()
    .int()
    .positive()
    .max(365)
    .optional()
    .describe(
      t({
        zh: "分析时间窗(天,可选,1-365,默认 30)。",
        en: "Analysis time window in days (optional, 1-365, default 30).",
      }),
    ),
  filterBy: z
    .enum(["collected", "published"])
    .optional()
    .describe(
      t({
        zh: "按采集时间 / 发布时间过滤(可选):collected / published,与 get_brand_metrics 语义一致。",
        en: "Filter by collected time / published time (optional): collected / published, same semantics as get_brand_metrics.",
      }),
    ),
  lang: z
    .string()
    .optional()
    .describe(
      t({
        zh: "叙述语言(可选,如 zh-CN / en-US,默认 en-US)。跟随用户语言。",
        en: "Narrative language (optional, e.g. zh-CN / en-US, default en-US). Follow the user's language.",
      }),
    ),
  forceRefresh: z
    .boolean()
    .optional()
    .describe(
      t({
        zh: "跳过套件层缓存重建(可选,默认 false)。请节制使用以防打爆上游;数据更新后套件会自动失效,通常不需要。",
        en: "Skip the kit-layer cache and rebuild (optional, default false). Use sparingly to avoid hammering upstream; the kit auto-invalidates on new data, so usually unnecessary.",
      }),
    ),
});

export const getSocialVocReportKit: Tool<typeof inputSchema> = {
  name: "get_social_voc_report_kit",
  description: t({
    zh: `[VOC 报告套件 · 免费 · 出报告默认首选] 一次拿到可装配的社媒 VOC 报告套件:reportSpec(模块清单)+ 各模块结构化数据与叙述 + 自包含 CSS + 装配提示。免费,不扣积分、不占 AI 额度。
【交付铁律】拿到套件后**必须**把它装配成一份**完整 HTML 文档**(用 \`\`\`html 代码块 或 .html 文件产物)交给用户;**禁止**只用 Markdown 标题/表格充当完整报告。
【怎么装配】把返回体的 delivery.instruction + assemblyHints.systemPromptFragment + style(cssSnippet/tokens/classMap)+ reportSpec + modules 一并交给你自己的模型,一次生成完整 HTML。modules 按 id 查找(overview/trends/voice/platforms),别写死数组下标;schemaVersion 用 startsWith('social-voc-report-kit.v1') 判断。
【CSS 铁律】若把样式内联进 <style>,必须是浏览器可直接解析的**扁平 CSS**;**禁止**未编译的 Tailwind 嵌套 / @apply / 规则体里以 > ~ + 开头的嵌套块(如 .divide-y{>:not(...){...}})—— 这会让浏览器中断解析、丢掉后续规则,图表条塌成 0 高透明,报告看着"很简陋"。更稳的做法:引 Tailwind CDN(<script src="https://cdn.tailwindcss.com"></script>),或只用套件自带的 style.cssSnippet(--ds- 变量那套,已是扁平 CSS)。
【不编造铁律】modules[].data 里没有的数字/关键词次数/引文一律不得编造;某模块 status 为 degraded/failed 时降级渲染已有 data 并展示其 error 提示。
前置:品牌需已采集完成 —— 若报 data not ready / refresh in progress,先 refresh_brand 并用 get_refresh_progress 等完成再调。
Returns: data = { schemaVersion, delivery, meta, reportSpec, style, assemblyHints, modules[] }。
Use when: 用户要"出一份社媒 VOC 报告 / 导出 HTML 报告 / 类似 social 洞察页的报告"。这是默认首选。
Don't use: 只要单点指标(get_brand_metrics 等免费只读);想要额外的自由提问式深度策略结论且用户愿意花积分(analyze_brand,扣 600 积分,调前先确认)。免费能力,不要引导用户为报告本身充值。`,
    en: `[VOC report kit · FREE · default first choice for reports] Get an assemble-ready social VOC report kit in one call: reportSpec (module list) + per-module structured data & narrative + self-contained CSS + assembly hints. Free — no points, no AI quota.
[Delivery hard rule] After getting the kit you MUST assemble it into a COMPLETE HTML document (a \`\`\`html code block or a .html file artifact) for the user; do NOT pass off Markdown headings/tables as the full report.
[How to assemble] Hand your own model the returned delivery.instruction + assemblyHints.systemPromptFragment + style (cssSnippet/tokens/classMap) + reportSpec + modules together, and generate the full HTML in one shot. Look up modules by id (overview/trends/voice/platforms), do NOT hardcode array indices; gate on schemaVersion via startsWith('social-voc-report-kit.v1').
[CSS hard rule] If you inline styles into <style>, they MUST be flat, browser-parseable CSS; do NOT emit uncompiled Tailwind nesting / @apply / nested blocks starting with > ~ + inside a rule body (e.g. .divide-y{>:not(...){...}}) — the browser aborts parsing at that point and drops all following rules, collapsing chart bars to 0-height transparent and making the report look "bare". Safer: pull in the Tailwind CDN (<script src="https://cdn.tailwindcss.com"></script>), or use only the kit's own style.cssSnippet (the --ds- variable set, already flat CSS).
[No fabrication] Never invent numbers/keyword counts/quotes not present in modules[].data; when a module status is degraded/failed, render its existing data degraded and show its error note.
Precondition: brand must have collected data — if 'data not ready' / 'refresh in progress', run refresh_brand and wait via get_refresh_progress first.
Returns: data = { schemaVersion, delivery, meta, reportSpec, style, assemblyHints, modules[] }.
Use when: user wants "a social VOC report / an exported HTML report / a report like the social insights page". This is the default first choice.
Don't use: for single metrics (get_brand_metrics etc., free read-only); for an extra free-form deep strategy analysis when the user is willing to spend points (analyze_brand, 600 points, confirm first). This is free — do not push the user to top up for the report itself.`,
  }),
  inputSchema,
  async execute(input, ctx) {
    ctx.logger.info(
      `get_social_voc_report_kit: brandId=${input.brandId} days=${input.days ?? ""} lang=${input.lang ?? ""}`,
    );
    const qs = buildQuery({
      days: input.days,
      filterBy: input.filterBy,
      lang: input.lang,
      forceRefresh: input.forceRefresh,
    });
    return ctx.client.get(
      `/api/v1/social/brands/${encodeURIComponent(input.brandId)}/social-voc-report-kit${qs}`,
    );
  },
};
