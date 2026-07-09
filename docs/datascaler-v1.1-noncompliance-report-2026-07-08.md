# DataScaler Partner API v1.1 不符合项排查报告

日期: 2026-07-08  
环境: DataScaler production `https://app.datascaler.ai/partner/v1`  
验证方式: 使用 Pangolinfo 生产 Partner 凭证通过 `client_credentials` 换取 access token, 直连 DataScaler Partner API。未在文档中记录 token / secret。

## v1.1 期望口径

采集类计费:

```text
credits = brandCount * channelCount * keywordCount * pages * 0.02
Pangolinfo points = credits * 600
```

默认知识空间:

```text
brandCount = 1
channelCount = 7
keywordCount ~= 12
pages = 10
expected credits = 1 * 7 * 12 * 10 * 0.02 = 16.8
expected points = 10080
```

最小单元:

```text
1 brand * 1 channel * 1 keyword * 1 page = 0.02 credits = 12 points
```

`maxPages` 是 v1.1 推荐入参, 取值 1..10; `depth` 只保留兼容, 且同时传时 `maxPages` 优先。

## 已线上验证不符合 v1.1

### 1. `POST /spaces/prepare`

请求:

```http
POST https://app.datascaler.ai/partner/v1/spaces/prepare
X-DataScaler-External-User-Id: <pangolinfo-test-user-id>
Content-Type: application/json

{"query":"Anker"}
```

线上响应 requestId:

```text
mcp_req_85aeb74d-16eb-4e16-851d-fccb942a4911
```

实际返回仍是 v1.0:

```json
{
  "suggestedKeywordsCount": 6,
  "depthOptions": [
    { "tier": "quick", "maxPages": 3, "estimatedCredits": 5.25 },
    { "tier": "standard", "maxPages": 5, "estimatedCredits": 8.75 },
    { "tier": "full", "maxPages": 10, "estimatedCredits": 17.5 }
  ],
  "cost": {
    "model": "flat-credits",
    "formula": "brands × channels × pages × 0.25",
    "creditsByDepth": {
      "quick": 5.25,
      "standard": 8.75,
      "full": 17.5
    },
    "note": "Collection = 1 (space) × channels × pages × 0.25 credits ..."
  }
}
```

不符合点:

| 项 | 期望 v1.1 | 实际 production |
|---|---|---|
| 公式 | `brands × channels × keywords × pages × 0.02` | `brands × channels × pages × 0.25` |
| 默认关键词数 | 约 12 | 本次返回 6 |
| quick 预估 | 若 12 词: `5.04`; 若按实际 6 词: `2.52` | `5.25` |
| standard 预估 | 若 12 词: `8.4`; 若按实际 6 词: `4.2` | `8.75` |
| full 预估 | 若 12 词: `16.8`; 若按实际 6 词: `8.4` | `17.5` |
| 文案 | 不应出现 `0.25 credits` | 仍出现 `0.25 credits` |
| cost 字段 | 应包含关键词因子 | 无关键词因子 |

结论: `prepare_space` production 明确还在 v1.0 公式上。

## 源码证据显示高风险不符合 v1.1

以下端点未直接在 production 触发, 原因是会创建空间/品牌或发起采集, 会产生副作用和计费。判断依据来自 DataScaler 原版 MCP 源码 `D:\larkDownload\mcp\tools.ts` 和 `collection-billing.ts`; 同时 `prepare_space` 线上行为已经与该源码旧公式一致, 所以下列端点高可信同样未切 v1.1。

### 2. `POST /spaces`

功能: create_space, 创建知识空间并触发首采。

源码证据:

```text
D:\larkDownload\mcp\tools.ts
lines 2568-2573:
Flat credits: 1 (space) × channels × pages × 0.25
estimatedCredits = estimateCollectionCredits({ brandCount: 1, platforms, maxPages })

lines 2674-2678:
billing.estimatedCredits
note: Flat estimate = channels × pages × 0.25 ...
```

不符合点:

| 项 | 期望 v1.1 | 源码/预期实际 |
|---|---|---|
| 公式 | `1 × channels × keywordCount × pages × 0.02` | `1 × channels × pages × 0.25` |
| 关键词因子 | 必须计入 | 未传入 `keywordCount` |
| `billing.note` | 不应出现 `0.25` | 仍写 `channels × pages × 0.25` |

额外风险:

```text
D:\larkDownload\mcp\tools.ts
line 2567:
const resolvedMaxPages = resolveMaxPagesFromDepth({ depth: input.depth });
```

这里没有传 `input.maxPages`, 可能导致 `POST /spaces` 不遵守 v1.1 的 `maxPages` 优先规则。

### 3. `POST /brands`

功能: setup_brand, 完整品牌接入并触发首采。

源码证据:

```text
D:\larkDownload\mcp\tools.ts
lines 2134-2141:
Flat credits v1.0: (1 + competitors) × channels × pages × 0.25
setupEstimatedCredits = estimateCollectionCredits({
  brandCount: 1 + competitors,
  platforms,
  maxPages
})

lines 2282-2287:
billing.estimatedCredits
note: Flat estimate = (1 + competitors) × channels × pages × 0.25 ...
```

不符合点:

| 项 | 期望 v1.1 | 源码/预期实际 |
|---|---|---|
| 公式 | `(1 + competitors) × channels × keywordCount × pages × 0.02` | `(1 + competitors) × channels × pages × 0.25` |
| 关键词因子 | 必须计入 | 未传入 `keywordCount` |
| `billing.note` | 不应出现 `0.25` | 仍写 `0.25` |

### 4. `POST /brands/{brandId}/refresh`

功能: refresh_brand, 对已有品牌发起采集。

源码证据:

```text
D:\larkDownload\mcp\tools.ts
lines 3245-3255:
Flat credits v1.0: (1 + competitors) × channels × pages × 0.25
refreshBaseCredits = estimateCollectionCredits({
  brandCount: 1 + competitors,
  platforms,
  maxPages
})

lines 3352-3357:
billing.estimatedCredits
note: Flat estimate = (1 + competitors) × channels × pages × 0.25 ...
```

不符合点:

| 项 | 期望 v1.1 | 源码/预期实际 |
|---|---|---|
| 公式 | `(1 + competitors) × channels × keywordCount × pages × 0.02` | `(1 + competitors) × channels × pages × 0.25` |
| 关键词因子 | 必须按实际生效关键词数计费 | 未参与估算 |
| `billing.note` | 不应出现 `0.25` | 仍写 `0.25` |

## 下游进度接口的连带风险

### 5. `GET /refresh/{jobId}`

### 6. `GET /refresh/{jobId}/wait`

这两个端点本身未必计算费用, 但会回显采集 job 的 `billingIntent` / `baseCredits` / `chargedAmount`。

源码证据:

```text
D:\larkDownload\mcp\tools.ts
line 3410:
billingIntent: status.billingIntent ?? null
```

如果 `POST /spaces`, `POST /brands`, `POST /brands/{id}/refresh` 写入的是旧公式 `baseCredits`, 进度接口会继续回显旧口径金额。

## 已验证暂未发现 v1.1 公式问题的端点

以下 production 端点已直连验证, 未发现 `0.25`, `estimatedCredits`, `creditsByDepth` 之类采集公式字段:

| 端点 | requestId | 结论 |
|---|---|---|
| `GET /context` | `mcp_req_b557874a-d542-441c-a93d-ab8d1c53c2f3` | 无采集公式字段 |
| `GET /actions` | `mcp_req_24cfa348-6aca-46ff-8708-c5d87f56e71e` | 无采集公式字段 |
| `GET /account` | `mcp_req_d1962928-f15d-409d-94df-7e12fab6dd57` | 无采集公式字段 |
| `GET /brands` | `mcp_req_0e7a25b4-1418-42d4-88c1-dc075aa48562` | 空品牌列表, 无采集公式字段 |
| `POST /brands/onboarding/prepare` | `mcp_req_2413c7a0-db50-42ed-923e-235306dbe7dc` | 无采集公式字段 |
| `POST /brands/onboarding/competitors` | `mcp_req_100ceab1-b321-4e65-b976-8d49655bfa94` | 无采集公式字段 |
| `GET /errors/explain?code=DATA_NOT_READY` | `mcp_req_615d923e-f910-4096-9179-0008ca011e78` | 无采集公式字段 |

说明:

- `GET /context`, `GET /account`, `GET /actions` 是 DataScaler 原始账户接口, 仍会返回 DataScaler 侧 `plan`, `quota`, `credits.remaining`。这是白标净化问题, Pangolinfo scrapeapi 会剥离, 不属于 v1.1 采集公式问题。
- `analyze_brand` 仍是 1 credit/次, v1.1 通知明确该项不变。Pangolinfo 侧换算为 600 points/次。

## DataScaler 原版源码中的旧公式根因

核心旧公式模块:

```text
D:\larkDownload\mcp\collection-billing.ts
```

当前内容:

```ts
// billing v1.0
// credits = brandCount × billableChannels × pages × 0.25
export const CREDITS_PER_BRAND_CHANNEL_PAGE = 0.25;

export function estimateCollectionCredits(input) {
  return round2(
    brandCount * billableChannels(platforms).length * maxPages * 0.25
  );
}
```

v1.1 应改成:

```ts
credits = brandCount * billableChannels * keywordCount * maxPages * 0.02
```

并且所有调用点都必须传入实际生效的 `keywordCount`。

## 建议 DataScaler 侧修复清单

1. 更新 `collection-billing.ts`
   - `0.25` 改为 `0.02`
   - `CollectionCreditInput` 增加 `keywordCount`
   - `estimateCollectionCredits` 公式改为 `brandCount * channels * keywordCount * pages * 0.02`
   - 所有 `note/formula` 文案改为 v1.1

2. 更新 `POST /spaces/prepare`
   - 默认生成约 12 个英文关键词
   - `depthOptions[].estimatedCredits` 按关键词数计算
   - `cost.formula` 增加关键词因子
   - `cost.creditsByDepth` 按 v1.1 计算

3. 更新 `POST /spaces`
   - 计费按实际生效关键词数
   - 修正 `billing.estimatedCredits` 和 `billing.note`
   - 确认 `maxPages` 优先于 `depth`

4. 更新 `POST /brands`
   - 完整品牌按 `(1 + competitors) * channels * keywordCount * pages * 0.02`
   - 明确 keywordCount 是主品牌关键词数, 还是主品牌 + 每个竞品各自关键词数; 文档需要写清

5. 更新 `POST /brands/{brandId}/refresh`
   - 按当前品牌/本次覆盖后的实际生效关键词数计费
   - 如果请求传 `brandKeywords/categoryKeywords/keywords`, 应按更新后的关键词数计费

6. 回归进度接口
   - `GET /refresh/{jobId}` / `wait` 回显的 `billingIntent.baseCredits` / `chargedAmount` 应来自 v1.1 公式

7. 增加锚点测试
   - 标准 VOC: `4 * 7 * 12 * 10 * 0.02 = 67.2 credits`
   - 默认知识空间: `1 * 7 * 12 * 10 * 0.02 = 16.8 credits`
   - quick 最小示例: `1 * 4 * 12 * 3 * 0.02 = 2.88 credits`
   - 单位页: `1 * 1 * 1 * 1 * 0.02 = 0.02 credits`

