# Pangolinfo 品牌社媒洞察 MCP 客户接入指南

本文面向接入 Pangolinfo 品牌社媒洞察(VOC) MCP 的客户和 AI Agent 开发者。客户只需要使用 Pangolinfo 提供的 MCP 地址和 API Key,不需要也不应该接触任何上游供应商账号或凭证。

## 1. 接入地址

生产 MCP 地址:

```text
https://voc.pangolinfo.com/mcp?api_key=<YOUR_PANGOLINFO_API_KEY>
```

如果你的 MCP 客户端支持 HTTP Header,也可以使用:

```text
URL: https://voc.pangolinfo.com/mcp
Header: Authorization: Bearer <YOUR_PANGOLINFO_API_KEY>
```

健康检查地址:

```text
https://voc.pangolinfo.com/health
```

注意:
- API Key 变更后,请在 AI 客户端里重新连接或重启 MCP 会话,多数客户端不会热加载配置。
- 不要把 API Key 发给第三方或写进公开仓库。
- 如果收到 401,通常是 API Key 没带上、填错或客户端没有重连。

## 2. MCP 能做什么

Pangolinfo 品牌社媒洞察 MCP 用于监测品牌或话题在主流社媒平台上的讨论,包括:

- 声量、互动、触达、平台分布
- 情感分布和正负面驱动因素
- 热门帖子和语义检索
- 竞品声量份额和多维对比
- 风险预警
- AI 深度分析和品牌摘要

当前共 25 个工具。建议 AI 首次接入时先调用:

```text
social_capabilities
get_context
get_billing_rules
```

这三个工具可以让 Agent 了解工具列表、账户状态、支持平台和计费规则。

## 3. 默认工作流:知识空间

当用户想了解某个品牌或话题在社媒上被如何讨论时,默认使用知识空间流程。

```text
prepare_space
  -> 向用户展示行业候选、平台、页数、estimatedPoints
  -> 用户确认行业 + 平台 + 页数
create_space
  -> 返回 spaceId 和采集 jobId
get_refresh_progress / wait_for_refresh
  -> 轮询到 completed 或 partial
diagnose_brand
  -> 确认 dataReady=true 且 totalPosts>0
读取数据或 analyze_brand
```

关键要求:
- `prepare_space` 免费,用于出采集计划和费用预估。
- 调 `create_space` 前必须让用户确认行业、平台、页数和预估积分。
- `create_space` 会发起异步采集并产生费用。
- 拿到 `jobId` 后不要反复创建空间,应使用 `get_refresh_progress` 轮询。
- 如果同品牌或同话题已经有空间,优先复用已有空间,不要重复创建。

## 4. 已有品牌/空间的工作流

如果用户已经有品牌或知识空间:

```text
list_brands
get_brand
diagnose_brand
```

根据诊断结果决定下一步:

- `dataReady=true` 且 `totalPosts>0`:可以直接读取数据或分析。
- `freshnessVerdict=refreshing`:采集仍在运行,用 `get_refresh_progress` 等待。
- `freshnessVerdict=stale` 或 `never`:如用户需要新数据,先确认费用,再用 `refresh_brand`。
- `totalPosts=0`:说明采集完成但没有抓到可用帖子,不是 MCP 故障。建议优化品牌名、关键词、平台或换更主流英文关键词。

## 5. 工具清单

### 上下文和规则

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `social_capabilities` | 免费 | MCP 自省,了解工具、流程、注意事项 |
| `get_context` | 免费 | 获取账户、billingMode、品牌列表、支持平台 |
| `get_billing_rules` | 免费 | 查看积分计费规则 |
| `suggest_next_actions` | 免费 | 根据当前状态推荐下一步 |
| `explain_error` | 免费 | 解释错误码和下一步 |

### 知识空间

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `prepare_space` | 免费 | 出采集计划、行业候选、关键词建议和 estimatedPoints |
| `create_space` | 扣费 | 创建知识空间并发起首轮采集,返回 spaceId 和 jobId |

### 品牌管理

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `list_brands` | 免费 | 列出当前用户已有品牌/空间 |
| `get_brand` | 免费 | 查看品牌配置和数据就绪状态 |
| `prepare_brand_onboarding` | 免费 | 为完整品牌接入生成关键词、平台、竞品建议 |
| `setup_brand` | 扣费 | 完整品牌接入,适合竞品、官网、Amazon 评论等高级场景 |
| `update_brand` | 免费 | 修改品牌关键词、平台、竞品等配置;不立即采集 |

### 采集

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `diagnose_brand` | 免费 | 检查数据是否就绪、是否过期、是否有帖子 |
| `refresh_brand` | 扣费 | 对已有品牌发起一次新采集 |
| `get_refresh_progress` | 免费 | 轮询采集 jobId 进度 |
| `wait_for_refresh` | 免费 | 短等采集完成,超时返回当前状态 |

### 数据读取

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `get_brand_metrics` | 免费 | 核心指标、平台指标、增长机会等 |
| `search_brand_posts` | 免费 | 按平台、情感、排序查看帖子 |
| `find_posts_about` | 免费 | 按语义查找帖子 |
| `get_brand_sentiment` | 免费 | 情感分布和正负面驱动因素 |
| `get_voice_share` | 免费 | 我方和竞品声量份额 |
| `compare_competitors` | 免费 | 多维度竞品对比 |
| `get_risk_alerts` | 免费 | 负面突增和风险预警 |

### 分析

| 工具 | 费用 | 说明 |
| --- | --- | --- |
| `analyze_brand` | 扣费 | AI 深度分析,同步返回报告 |
| `get_brand_summary` | 免费 | 快速品牌摘要 |

## 6. 计费规则

只读工具免费。采集类工具按 Pangolinfo 积分计费:

```text
积分 = 品牌数 * 渠道数 * 关键词数 * 页数 * 12
```

AI 深度分析:

```text
analyze_brand = 600 积分/次
```

说明:
- `prepare_space` 会返回 `estimatedPoints`,采集前应把这个数给用户确认。
- 采集类工具在采集受理成功后按预估记账。
- `get_context` 会返回当前用户的 `billingMode`:
  - `prepaid`:预付费,从 Pangolinfo 积分余额扣。
  - `postpaid`:后付费,按账期用量记账。
- 两种模式单价相同,只是结算方式不同。

## 7. 支持平台

知识空间默认支持 9 个社媒平台:

```text
tiktok
instagram
youtube
x
facebook
pinterest
trustpilot
reddit
threads
```

默认预选 7 个:

```text
tiktok, instagram, youtube, x, facebook, pinterest, trustpilot
```

不支持的平台包括但不限于:

```text
小红书, 微博, LinkedIn
```

如果用户要求不支持的平台,Agent 应明确告知当前不支持,并只在支持列表内提供替代方案。

## 8. Amazon Reviews

Amazon Reviews 不属于知识空间社媒流程,不能传给 `prepare_space` 或 `create_space`。

如果用户明确要 Amazon 评论,请使用完整品牌接入 `setup_brand`,并提供 ASIN 或 Amazon 商品链接:

```json
{
  "name": "Example Brand",
  "monitorPlatforms": ["amazon_reviews"],
  "keywords": ["example brand"],
  "amazonProducts": [
    { "asin": "B0XXXXXXXX" }
  ]
}
```

没有 ASIN 或商品链接时,不要启用 `amazon_reviews`。

## 9. 关键词要求

关键词必须使用英文。

原因:
- 上游社媒发现主要索引英文内容。
- 含中文、日文、韩文等字符的关键词会被丢弃或拒绝。

例子:

```text
错误: 无线耳机降噪
正确: noise cancelling earbuds
```

中文品牌或中文话题也建议翻译成英文关键词后再采集。

## 10. 数据就绪门禁

读数据和深度分析前,建议先调用:

```text
diagnose_brand
```

只有满足以下条件时才算数据就绪:

```text
dataReady=true
totalPosts > 0
```

常见状态:

| 状态 | 含义 | 下一步 |
| --- | --- | --- |
| `refreshing` | 采集运行中 | 用 `get_refresh_progress` 等待 |
| `fresh` | 数据可用 | 可以读取或分析 |
| `stale` 且 `totalPosts=0` | 采到 0 帖 | 优化关键词/平台后再采 |
| `failed` | 采集失败 | 查看错误,必要时重新确认后再 refresh |

不要在采集运行中重复发起 `create_space` 或 `refresh_brand`。

## 11. 常见错误处理

| 错误/现象 | 处理方式 |
| --- | --- |
| 401 / AUTH | 检查 API Key 是否传入,并重连 MCP |
| `BAD_INPUT` | 按错误提示修正参数;缺 brandId 时先 `list_brands` |
| `DATA_NOT_READY` | 先 `diagnose_brand`;需要新数据时确认费用后 `refresh_brand` |
| `REFRESH_IN_PROGRESS` | 用 `get_refresh_progress` 等待,不要重复发起 |
| `BRAND_NOT_FOUND` / 404 | brandId 不存在或不属于当前用户;用 `list_brands` 获取自己的 brandId |
| 额度不足 | 引导用户在 Pangolinfo 充值或联系账户管理员 |

如果需要 Pangolinfo 支持排查,请提供:

- 工具名
- MCP 返回的错误内容
- `requestId`
- `ref=...` 调用引用

## 12. 最小接入示例

不同 AI 客户端的 MCP 配置格式不完全一致。通用配置要点是:

```text
Transport: Streamable HTTP / HTTP MCP
URL: https://voc.pangolinfo.com/mcp?api_key=<YOUR_PANGOLINFO_API_KEY>
```

如果客户端支持 Header:

```text
URL: https://voc.pangolinfo.com/mcp
Authorization: Bearer <YOUR_PANGOLINFO_API_KEY>
```

接入后,让 Agent 先调用:

```text
social_capabilities
get_context
```

然后按用户意图选择知识空间或已有品牌流程。

