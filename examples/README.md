# examples — 端到端使用流程演示

用真实 MCP 协议跑通 `pangolinfo-voc-mcp` 的完整使用流程，看真实社媒数据流过整条链。

## 这演示的是什么

真实链路是三跳：

```
AI 客户端 → MCP(本仓) → Pangolinfo 后端(/api/v1/social/*) → 上游数据供应商
```

本目录用 `demo-client.mjs` 扮演 **AI 客户端**（走真实 MCP 协议），用 `mock-backend.mjs`
扮演中间的 **后端那一跳**（仅做最小转发，看数据流）。

> ⚠️ `mock-backend.mjs` **不是生产代码**。真实后端还会做：校验 Pangolinfo API Key、
> 从已认证会话取 userId、扣费（受理即扣、按操作差异化定价）、错误码映射。
> mock 只注入上游 token + 一个演示用 externalUserId 后透传。

## 演示覆盖的流程

```
握手 → ①自省(social_capabilities) → ②列品牌(list_brands) → ③指标(get_brand_metrics)
     → ④语义检索(find_posts_about) → ⑤竞品(compare_competitors)
     → ⑥深度分析(report_follow_up_analysis,💰同步出报告) → ⑦发起采集(refresh_brand,💰异步返jobId)
     → ⑧轮询进度(get_refresh_progress)
```

## 前置

1. 已 `npm install && npm run build`（生成 `dist/server.mjs`）。
2. 有一套上游数据供应商凭证（staging 或生产）。

## 怎么跑

**第 1 步：设置上游凭证（从环境变量读，不写进文件）**

```bash
export UPSTREAM_TOKEN_ENDPOINT="https://<upstream-provider>/oauth/token"
export UPSTREAM_API_BASE="https://<upstream-provider>/partner/v1"
export UPSTREAM_CLIENT_ID="<你的 client_id>"
export UPSTREAM_CLIENT_SECRET="<你的 client_secret>"
# 可选
export DEMO_EXTERNAL_USER_ID="u_demo"   # 演示用的终端用户 ID
export MOCK_PORT=8787                    # mock 后端端口
```

PowerShell：

```powershell
$env:UPSTREAM_TOKEN_ENDPOINT="https://<upstream-provider>/oauth/token"
$env:UPSTREAM_API_BASE="https://<upstream-provider>/partner/v1"
$env:UPSTREAM_CLIENT_ID="<你的 client_id>"
$env:UPSTREAM_CLIENT_SECRET="<你的 client_secret>"
```

**第 2 步：启动 mock 后端（一个终端）**

```bash
node examples/mock-backend.mjs
# 看到: [mock-java] listening :8787 ...
```

**第 3 步：跑演示客户端（另一个终端）**

```bash
node examples/demo-client.mjs
# 默认中文输出;英文用 DEMO_LANG=en node examples/demo-client.mjs
```

## 预期输出（节选）

```
✅ 握手成功。Server: pangolinfo-voc-mcp v0.1.0
✅ 发现 17 个工具

━━━ ② 列出我的品牌(数据隔离) ━━━
   品牌: Anker (id=...) dataReady=true

━━━ ⑥ 深度分析(💰扣费,同步返回报告) ━━━
   📊 报告(前 240 字):
   ## Key Findings
   过去30天...75%正面...用户最喜爱便携性/快充/性价比...
```

mock 后端那一侧会打印每跳，并标出真实 Java 会扣费的位置：

```
[mock-java] POST /brands/<id>/analyze -> 200 34000ms  [真实 Java 在此扣费]
[mock-java] POST /brands/<id>/refresh -> 200 500ms    [真实 Java 在此扣费]
```

## 注意

- **不要把凭证写进任何文件**。本仓是 public，凭证只走环境变量。
- analyze 是**同步**的，会阻塞几十秒返回完整报告（不是 jobId）。
- refresh 是**异步**的，返回 jobId，用 `get_refresh_progress` 轮询。
- 演示需要账上已有品牌；没有就先用 `setup_brand` 接入一个（会扣费 + 触发首采）。
