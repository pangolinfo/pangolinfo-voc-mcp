# 接入 `get_social_voc_report_kit`(免费社媒 VOC 报告套件)· 设计文档

> 日期:2026-07-15 · schema 契约:`social-voc-report-kit.v1.2`
> 关联接入指南:`D:\larkDownload\partner-social-voc-report-kit-接入指南.md`
> 关联现有设计:`docs/specs/2026-06-29-social-insights-mcp-design.md`

---

## 1. 背景与目标

DataScaler 新增一个 **免费** 的 Partner 能力:一次调用拿到「报告套件 JSON」(reportSpec + 模块数据 + 叙述 + 样式 CSS + 装配提示),由**本地 AI 装配成完整 HTML** 报告交给终端用户。

- Partner REST:`GET /partner/v1/brands/{id}/social-voc-report-kit`
- MCP 工具名(固定):`get_social_voc_report_kit`
- **计费:免费**(不扣 Credits、不占 AI 问答额度)。

**为什么重要**:此前出 VOC 报告只有两条路——路径 A(`analyze_brand`,扣 600 积分、口径窄、固定口吻)和路径 B(纯免费只读工具自产,叙事全靠 agent)。report kit 是**第三条路 = A 的官方成品质量 + B 的零费用**,故本次将其升为**出报告的首选默认路径**。

**目标**:在不改鉴权、不改既有采集/读接口的前提下,MCP 新增该工具、scrapeapi 新增转发端点,先指向 **staging** DataScaler 联调验证,**暂不上生产**(等 DataScaler 生产就绪再切)。

## 2. 前置探查结论(已实测 staging)

| 项 | 结论 |
|----|------|
| staging OAuth 换 token | 必须 **HTTP Basic Auth**(client 凭证放 header,body 只带 grant_type)。scrapeapi `TokenManager` 本就如此,无需改。 |
| 新端点是否部署 | **已在 staging 部署**:打不存在 brandId 返回结构化 `BRAND_NOT_FOUND`(HTTP 404,含 ok/code/status/userMessage/userMessageEn/nextActions),非路由级 404。 |
| 错误信封 | 与现有端点一致 → scrapeapi 现有 `mapBizCode`/`mapHttpStatus` 已能处理,无需新增错误映射。 |
| staging 数据 | 品牌数据按 externalUserId 隔离,现无有数据品牌;成功响应体结构以文档 §3 契约为准,真实核对留待联调(不阻塞开发)。 |

## 3. 范围决策(已与用户确认)

1. **落地范围** = 两仓都改 + 先指向 staging 联调,暂不上生产。
2. **联调方式** = 直接用 staging 凭证 curl 打 DataScaler staging 验证契约(本地无 scrapeapi dev 环境)。
3. **报告默认路径** = report kit 升为出报告**首选**;`analyze_brand` 降为「要额外深度策略结论才花 600 积分」的进阶项;免费只读工具仍作补强(引文/图表/趋势/风险样本)。
4. **工具定位(方案甲)** = 装配职责显式化:工具描述里**写死交付铁律**(调后必须装配成完整 HTML,禁止只用 Markdown;务必遵循返回体的 delivery/assemblyHints/style)。

## 4. 改动清单

### 4.1 scrapeapi(Java 转发层)— 3 文件

**`SocialController.java`**:新增
```java
@GetMapping("/brands/{brandId}/social-voc-report-kit")
public Mono<ApiResponse<JSONObject>> getSocialVocReportKit(
        @PathVariable String brandId,
        @RequestParam(required = false) Integer days,
        @RequestParam(required = false) String filterBy,
        @RequestParam(required = false) String lang,
        @RequestParam(required = false) Boolean forceRefresh) {
    JSONObject q = new JSONObject();
    if (days != null) q.put("days", days);
    putIfPresent(q, "filterBy", filterBy);
    putIfPresent(q, "lang", lang);
    if (forceRefresh != null) q.put("forceRefresh", forceRefresh);
    return socialService.getSocialVocReportKit(requireUserId(), brandId, q).map(this::purifySuccess);
}
```
放在「数据(只读)」段末尾(与其他免费只读端点同组)。免费:走 `requireUserId()`(不需 token,不进扣费)。

**`SocialService.java`**:接口加
```java
/** 社媒 VOC 报告套件(免费)。返回 reportSpec+模块数据+叙述+样式+装配提示,供本地 AI 装配 HTML。 */
Mono<JSONObject> getSocialVocReportKit(String userId, String brandId, JSONObject query);
```

**`SocialServiceImpl.java`**:实现(与 getMetrics 同型,免费只读)
```java
@Override
public Mono<JSONObject> getSocialVocReportKit(String userId, String brandId, JSONObject query) {
    return client.get("/brands/" + encPath(brandId) + "/social-voc-report-kit" + qs(query), userId);
}
```

### 4.2 scrapeapi purify 定向豁免（DataScalerClient.java）— 关键改动

**问题**:`purifyText()` 对**每个字符串值**做 `credits→points`、`dashboard→...`、`Credit→Point` 等替换。report kit 含大段 `style.cssSnippet`、`assemblyHints.systemPromptFragment`、`modules[].narrative.markdown`、`delivery.instruction`,若其中含 "credit"/"dashboard" 等字样会被误替换,破坏 CSS 或叙述文本。

**方案（字段名定向豁免）**:在 `purifyNode` 遍历 Map 的字符串值时,对一组「非计费大文本字段名」跳过 `purifyText`,但仍照常剥离账户字段(creditsRemaining/checkoutLink 等)与做 credits→points 数值换算。豁免字段名集合(大小写精确):
```
cssSnippet, systemPromptFragment, instruction, narrative, markdown,
css, tokens, classMap, chartHints, emptyStates, sectionLabels
```
实现:把当前
```java
for (Object key : obj.keySet()) {
    Object value = obj.get(key);
    if (value instanceof String) {
        obj.put(key, purifyText((String) value));
    }
}
```
改为:`if (value instanceof String && !PURIFY_TEXT_EXEMPT.contains(String.valueOf(key)))`。
> 说明:数值型账户字段剥离与 credits→points 换算**不受豁免影响**(那些走 key 名判断,不经 purifyText);豁免只作用于 C 类「字符串文案替换」。安全天性不变:未知字段仍原样保留,只多放过这些已知大文本字段。

### 4.3 MCP（TS）— 2 文件 + 引导

**新建 `src/tools/get_social_voc_report_kit.ts`**:照 `get_brand_metrics.ts` 模式。
- input schema:`brandId`(必填 string)、`days`(int 1..365,可选)、`filterBy`(`collected|published`,可选 enum)、`lang`(string,可选,默认随用户语言)、`forceRefresh`(boolean,可选)。
- execute:`buildQuery({ days, filterBy, lang, forceRefresh })` → `ctx.client.get("/api/v1/social/brands/{id}/social-voc-report-kit"+qs)`。
- description（中英双语，方案甲写死交付铁律）要点:
  - `[VOC 报告套件 · 免费]` 一次拿到可装配的报告套件(reportSpec/模块数据/叙述/CSS/装配提示)。
  - **交付铁律**:调用后**必须**把 kit 装配成完整 HTML 文档(` ```html ` 或 `.html` 产物)交给用户;**禁止**只用 Markdown 标题/表格充当完整报告。
  - 装配时务必遵循返回体的 `delivery.instruction` + `assemblyHints.systemPromptFragment` + `style.cssSnippet/tokens/classMap` + `reportSpec` + `modules`。
  - 铁律·不编造:`modules[].data` 里没有的数字/引文不得编造。
  - 前置:品牌需已采集完成;data not ready / refresh in progress → 先 refresh + get_refresh_progress。
  - 免费,**不要**引导用户为报告本身充值。
  - `schemaVersion` 用 `startsWith("social-voc-report-kit.v1")` 判断,按 `id` 查 module,别写死下标。

**`src/tools/index.ts`**:import `getSocialVocReportKit`,append 到数组「分析」段、`analyzeBrand` **之前**(新首选)。工具数 25 → 26。

**`src/server.ts` SERVER_INSTRUCTIONS**:重写「产出 VOC 报告」段(中英双语):
- 【默认首选:免费官方报告套件】出 VOC 报告默认先用 `get_social_voc_report_kit`(免费),拿到 kit 后按其 delivery/assemblyHints/style 装配完整 HTML。
- 【进阶付费选项】只有当用户明确想要额外的深度策略结论/自由提问式分析时,才提 `analyze_brand`(扣 600 积分,调前必须确认)。不再把 analyze_brand 当默认。
- 【免费补强仍保留】report kit 装配后可再用免费只读工具(metrics/sentiment/risk_alerts/posts/voice_share/summary)补真实引文、分平台明细、72h 高风险样本、趋势图。
- 保留:不编造铁律、图表可视化、每块数据配 so-what、refreshing 锁绕行。
- 兜底 B(纯自产)保留为「report kit 不可用或用户另有定制需求」时的退路。

## 5. 数据流

```
终端用户「出一份社媒 VOC 报告」
  → MCP get_social_voc_report_kit(brandId, days?, lang?)
  → GET /api/v1/social/brands/{id}/social-voc-report-kit?...   (scrapeapi)
  → SocialController → SocialService → DataScalerClient.get(...)
  → GET /partner/v1/brands/{id}/social-voc-report-kit  (DataScaler staging, Bearer + X-External-User-Id)
  → 响应 kit JSON → purify(定向豁免大文本字段) → ApiResponse.success
  → MCP 返回 kit → agent 按 delivery/assemblyHints/style 装配完整 HTML → 交付用户
```

## 6. 错误处理

复用现有链路,无需新增:
- `DATA_NOT_READY` / `REFRESH_IN_PROGRESS`(409)→ 现有 `mapBizCode` 已映射,引导先 refresh/查进度。
- `BRAND_NOT_FOUND`(404)→ 现有映射,已实测。
- `429` 限流 → 现有 `SOCIAL_RATE_LIMITED`;工具描述提醒节制 `forceRefresh`。
- 部分模块 `status=failed` 但 `ok:true` → 属正常「尽力返回」,agent 应降级渲染已有 module、展示 error 提示(写进工具描述与引导)。

## 7. 测试与验证

1. `npm run typecheck && npm run build`(MCP)。
2. stdio 起 `dist/server.mjs`,`tools/list` 确认出现 `get_social_voc_report_kit`(26 工具),并**分别验 en/zh locale** 的 instructions 含新报告引导。
3. scrapeapi:`mvn compile`(dev profile)编译通过。
4. **联调(需有数据品牌)**:staging 建空间采集 → 完成后 `GET .../social-voc-report-kit` 拿成功响应体,核对 §3 契约字段,并确认 purify 后 cssSnippet/narrative 未被误伤、账户字段已剥离、计费字段(若有)已 credits→points。
5. 错误路径:错误 brandId → BRAND_NOT_FOUND;无数据品牌 → DATA_NOT_READY。

## 8. 部署（本轮不执行,记录时序）

先 staging 联调通过 → 待 DataScaler **生产**部署该端点后 → scrapeapi build+push ACR + ACK 改 tag + MCP `scripts/window/docker-mcp.sh <tag>` build+push + ACK 改 tag → 生产 voc.pangolinfo.com 验证。版本:MCP 拟 v0.4.0(新增工具 + 报告默认路径翻转)。

## 9. 非目标（YAGNI）

- 不实现服务端直出 HTML(产品边界是 kit JSON + 本地装配,见文档 FAQ)。
- 不做「三路让用户自选」(老板后续意图,本轮按「新工具当默认首选」;若后续要改,只动引导文案)。
- 不改任何既有工具的 schema / 计费。
- 不上生产。
