# pangolinfo-voc-mcp

Pangolinfo 白标 **品牌社媒洞察(VOC) MCP**。本仓是 MCP 协议层,对 AI 客户端暴露品牌/话题社媒采集、读取和分析工具。

## 架构

终端 AI 用户只看到 Pangolinfo。本仓不持有任何上游凭证、不做扣费、不碰批发账户额度。凭证缓存、`externalUserId` 注入、积分扣费、错误映射和白标净化都在 Pangolinfo 后端。

```text
AI 客户端
  -> pangolinfo-voc-mcp (本仓, MCP 转发层)
  -> Pangolinfo 后端 (扣费、凭证、白标净化均在此)
  -> 上游数据供应商 API
```

生产 MCP 地址:

```text
https://voc.pangolinfo.com/mcp?api_key=<Pangolinfo JWT/API key>
```

## 工具

当前共 25 个工具:

- 上下文/规则: `social_capabilities`, `get_context`, `get_billing_rules`, `suggest_next_actions`, `explain_error`
- 知识空间: `prepare_space`, `create_space`
- 品牌管理: `list_brands`, `get_brand`, `prepare_brand_onboarding`, `setup_brand`, `update_brand`
- 采集: `diagnose_brand`, `refresh_brand`, `get_refresh_progress`, `wait_for_refresh`
- 数据读取: `get_brand_metrics`, `search_brand_posts`, `find_posts_about`, `get_brand_sentiment`, `get_voice_share`, `compare_competitors`, `get_risk_alerts`
- 分析: `analyze_brand`, `get_brand_summary`

默认接入路径是知识空间:

```text
prepare_space (免费出计划/estimatedPoints)
  -> 用户确认行业 + 平台 + 页数
  -> create_space (扣费并返回 spaceId + jobId)
  -> get_refresh_progress / wait_for_refresh
  -> 读取数据或 analyze_brand
```

## 计费

只读工具全免费。采集类工具 `create_space` / `refresh_brand` / `setup_brand` 在上游受理成功并返回预估后,按 Pangolinfo 积分口径记账:

```text
积分 = 品牌数 * 加权渠道单位 * 关键词数 * 页数 * 12
```

渠道单位:普通社媒渠道=1,`threads`=1,`reddit`=2,`amazon_reviews` 不参与采集公式。

`analyze_brand` 是同步深度分析,成功按 600 积分/次记账。`get_brand_summary` 免费。

## 平台

知识空间支持 9 个社媒平台:

```text
tiktok, instagram, youtube, x, facebook, pinterest, trustpilot, reddit, threads
```

默认预选 7 个: `tiktok/instagram/youtube/x/facebook/pinterest/trustpilot`。`threads` 可选且按 1 个渠道单位计,`reddit` 可选但按 2 个渠道单位计。

`amazon_reviews` 不是知识空间渠道。只有完整品牌 `setup_brand` 支持 Amazon Reviews,并且必须传:

```json
{
  "monitorPlatforms": ["amazon_reviews"],
  "amazonProducts": [{ "asin": "B0..." }]
}
```

关键词必须使用英文。含中日韩字符的关键词会在 MCP schema 层拒绝,中文话题请先翻译成英文关键词。

## 本地开发

```bash
npm ci
npm run typecheck
npm run build
npm run dev -- --transport=http --port=3000
```

健康检查:

```bash
curl http://localhost:3000/health
```

生产构建使用 Dockerfile。ACK 部署镜像 tag 以实际发布为准,当前版本为 `0.2.6`。
