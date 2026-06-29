# Social-Insights MCP 设计 spec

> 状态：设计已定稿（2026-06-29），等 DataScaler staging 凭证联调
> 上游契约：DataScaler Partner API v0.1（`pangolin-partner-api-接入指南.md`）
> 仓库：`pangolinfo-social-mcp`（本仓，纯转发层）+ `crawler-ext-service`（Java，新增 social 模块，扣费在此）

---

## 0. 一句话

在 DataScaler Partner API（品牌社媒洞察）上自建白标 MCP。终端 AI 用户只看到 Pangolin。
**MCP 纯转发，扣费与 DataScaler 凭证全部留在 Pangolin 的 Java 后端。**

---

## 1. 架构与三层职责

```
┌─ AI 客户端
│   ↓ Authorization: Bearer <Pangolin key>   (复用现有 MCP 鉴权，JWT/pgl_ 都收)
├─ pangolinfo-social-mcp        【本仓 · 纯转发层】
│   · 工具定义 + server instructions + 面向用户话术（全部 Pangolin 写）
│   · 不持 DataScaler 凭证、不知道扣费、不碰额度
│   · 职责：MCP 协议转换 + 异步轮询编排（工具描述引导）+ 错误透传翻译
│   ↓ 调 /extapi/social/*   带 Pangolin key + 从会话取的 userId
├─ crawler-ext-service          【现有 Java 后端 · 新增 social 模块】
│   · DataScaler client：client_credentials 换 token + 缓存复用（<1h）
│   · 注入 X-DataScaler-External-User-Id = Pangolin 自己的 userId
│   · 扣费闸门：refresh/analyze/summary/setup 受理即扣不退；只读放行
│   · DataScaler 错误码 → Pangolin 6 类错误模型映射
│   ↓ Authorization: Bearer <ds_at> + X-DataScaler-External-User-Id
└─ DataScaler Partner API  (https://mcp-api.datascaler.ai/partner/v1)
```

**边界单一职责**：MCP 只懂 MCP 协议和话术；Java 懂凭证 + 扣费 + 错误映射；DataScaler 懂数据。
MCP 可独立替换不影响扣费；Java 换上游不影响 MCP。

**链路定死**：`MCP → crawler-ext-service（扣费在此）→ DataScaler`。
不走 MCP 直连 DataScaler + webhook 事后对账的方案——因为「受理即扣」要求扣费在调 DataScaler 之前那一跳同步发生，只有这条链做得到。

---

## 2. 扣费规则（已拍板）

| 决策 | 结论 |
|---|---|
| 扣费时机 | **受理即扣**：拿到 DataScaler 受理凭证（jobId / 报告 200）即扣 Pangolin 用户额度 |
| 退费 | **A1 一律不退**。DataScaler 成功率有保障，不做 failed 补偿，Java 不需维护 jobId↔流水映射 |
| 只读端点 | **全免费** |
| 扣费工具 | 仅 4 个：`setup_brand` `refresh_brand` `analyze_brand` `get_brand_summary` |
| 双闸门 | Java 扣费闸门先查 Pangolin 用户额度→不足直接返回 QUOTA（你们话术+充值入口），**根本不调 DataScaler**。只有 Pangolin 额度够但上游渠道池耗尽时才撞上游 402（兜底） |

> DataScaler 侧：`refresh` 启动任务即扣它的渠道批发池（它先找 url 再采集，启动即扣），`analyze` 每次扣。
> 这是上游对 Pangolin 渠道的扣费；Pangolin 对终端用户的零售扣费是独立决策，此处选「跟随上游、受理即扣不退」。

---

## 3. 工具 ↔ 端点完整映射（16 工具）

snake_case 命名，沿用现有 `pangolinfo-mcp` 风格。

| # | MCP 工具 | Java 镜像接口 | DataScaler 端点 | 扣费 | 阶段 |
|---|---|---|---|---|---|
| 1 | `list_brands` | `GET /extapi/social/brands` | `GET /brands` | 免费 | M0 |
| 2 | `get_brand` | `GET /extapi/social/brands/{id}` | `GET /brands/{id}` | 免费 | M1 |
| 3 | `prepare_brand_onboarding` | `POST /extapi/social/brands/onboarding/prepare` | `POST /brands/onboarding/prepare` | 免费 | M1 |
| 4 | `setup_brand` | `POST /extapi/social/brands` | `POST /brands`（含首采） | **扣费** | M1 |
| 5 | `update_brand` | `PATCH /extapi/social/brands/{id}` | `PATCH /brands/{id}` | 免费 | M1 |
| 6 | `refresh_brand` | `POST /extapi/social/brands/{id}/refresh` | `POST /brands/{id}/refresh` | **扣费** | M1 |
| 7 | `get_refresh_progress` | `GET /extapi/social/refresh/{jobId}` | `GET /refresh/{jobId}` | 免费 | M1 |
| 8 | `get_brand_metrics` | `GET /extapi/social/brands/{id}/metrics` | `GET /brands/{id}/metrics` | 免费 | M0 |
| 9 | `search_brand_posts` | `GET /extapi/social/brands/{id}/posts` | `GET /brands/{id}/posts` | 免费 | M1 |
| 10 | `find_posts_about` | `GET /extapi/social/brands/{id}/posts/semantic` | `GET /brands/{id}/posts/semantic` | 免费 | M1 |
| 11 | `get_brand_sentiment` | `GET /extapi/social/brands/{id}/sentiment` | `GET /brands/{id}/sentiment` | 免费 | M1 |
| 12 | `get_voice_share` | `GET /extapi/social/brands/{id}/voice-share` | `GET /brands/{id}/voice-share` | 免费 | M1 |
| 13 | `compare_competitors` | `GET /extapi/social/brands/{id}/competitors/compare` | `GET /brands/{id}/competitors/compare` | 免费 | M1 |
| 14 | `get_risk_alerts` | `GET /extapi/social/brands/{id}/risk-alerts` | `GET /brands/{id}/risk-alerts` | 免费 | M1 |
| 15 | `analyze_brand` | `POST /extapi/social/brands/{id}/analyze` | `POST /brands/{id}/analyze` | **扣费**（每次） | M2 |
| 16 | `get_brand_summary` | `POST /extapi/social/brands/{id}/summary` | `POST /brands/{id}/summary` | **扣费**（每次，合成） | M2 |
| + | `social_capabilities` | （本地，无后端调用） | — | 免费 | M0 |

**不做工具的端点**（已拍板）：
- `whoami` → 仅 Java 内部健康检查/排障用，对终端用户无价值
- `account` / `usage` → 仅 Java 内部对账，暴露给终端 AI 用户违背白标

---

## 4. 异步轮询编排（核心）

契约 §6 硬约束：采集耗时（90% 在 3h 内），**禁止单次工具调用阻塞**。
模式 = 作业句柄 + agent 驱动轮询。**轮询循环放在 AI agent（靠工具描述引导），不放 MCP server 内部。MCP 单次调用必须秒回。**

```
① refresh_brand
   MCP → Java → DataScaler POST /refresh
   DataScaler 启动任务【扣它的渠道池】
   Java 拿到 jobId = 受理成功 → 扣 Pangolin 用户额度（A1 不退）
   ← { jobId, queuePosition, etaMinutes } 立即返回
   工具描述引导 agent：「已开始采集，约 X 分钟，请稍后用 get_refresh_progress 查询，勿干等」

② get_refresh_progress(jobId)（免费，可反复轮询）
   MCP → Java → DataScaler GET /refresh/{jobId}
   ← { status, progress, phase, platform, postsCollected, postsAnalyzed }
   status ∈ processing | completed | partial | failed

③ status=completed/partial 后，agent 再调读类工具 / analyze_brand（此时数据已新）
```

`failed` 处理：**不退**（A1）。

---

## 5. 错误透传与映射

DataScaler 错误码 → Pangolin 6 类错误模型（AUTH / QUOTA / RATE_LIMIT / BAD_INPUT / SERVER / NETWORK，仅后 3 类可重试）。
**映射在 Java 后端做**，MCP 只把结构化错误翻成用户话术。

| DataScaler code | HTTP | → Pangolin | 可重试 | 话术方向 |
|---|---|---|---|---|
| `UNAUTHORIZED`/`TOKEN_EXPIRED` | 401 | SERVER | Java 重换 token 重试 | 对用户透明，不暴露 |
| `INVALID_INPUT` | 400 | BAD_INPUT | 否 | 「参数有误」引导修正 |
| `INSUFFICIENT_SCOPE` | 403 | SERVER | 否 | 渠道凭证权限问题，内部告警 |
| `BRAND_NOT_FOUND` | 404 | BAD_INPUT | 否 | 「品牌不存在」引导用 list_brands |
| `DATA_NOT_READY` | 409 | BAD_INPUT | 否 | 「先 refresh_brand」引导式 |
| `REFRESH_IN_PROGRESS` | 409 | BAD_INPUT | 否 | 「已有采集在跑，用 get_refresh_progress」 |
| `REPORT_QUOTA_EXCEEDED` | 402 | QUOTA | 否 | 上游池耗尽兜底（Java 闸门通常先拦） |
| `AI_QUESTION_QUOTA_EXCEEDED` | 402 | QUOTA | 否 | analyze 渠道额度兜底 |
| `MCP_RATE_LIMIT_EXCEEDED` | 429 | RATE_LIMIT | 稍后 | 「调用过频，稍后再试」 |
| `INTERNAL_ERROR`/`BACKEND_ERROR` | 5xx | SERVER | 稍后 | 「系统繁忙」带 requestId |

**三个关键点：**
- **(a) 双闸门**：Java 扣费闸门先拦 Pangolin 额度不足（返回自己的 QUOTA + 充值入口，不调上游）；只有额度够但上游池耗尽才撞上游 402。用户永远只看 Pangolin 话术。
- **(b) requestId 全链透传**：DataScaler 每次返回 requestId（契约 §11），Java 记日志 + 塞进错误响应，MCP 透传。排障对线 DataScaler 的唯一凭证。Java 另生成自己的 traceId 一并记。
- **(c) token 过期对用户透明**：上游 401 是 Java↔DataScaler 的 token 过期，**不是终端用户鉴权问题**。Java 捕获 → 重换 token → 重试一次，用户无感。**绝不能透传成用户的 AUTH 错误**（会误导用户以为自己 key 错）。

---

## 6. 幂等键（idempotencyKey）

契约 §4：扣费写操作必须带 `idempotencyKey`，重试同 key 不重复扣费。

- 4 个扣费工具（setup/refresh/analyze/summary）支持可选 `idempotencyKey`；**agent 不传时由 Java 自动生成**（userId+brandId+操作+时间窗哈希）。
- **双侧幂等**：上游幂等防 DataScaler 重复采集；**Java 自身幂等防 Pangolin 重复扣费**（同 key 扣费动作只执行一次）。

---

## 7. 提示词覆盖边界（analyze_brand / get_brand_summary）

契约 §9.2：`systemPromptOverride` 只能改「怎么说」（分析框架/报告结构/输出口吻/角色/侧重点），
**改不了「数据怎么来/指标怎么算」**（数据检索口径、指标定义、RAG 装配、底层取数）。
DataScaler 服务端把数据口径段固定在前并声明不可覆盖，再拼接 Pangolin 的覆盖段。
→ 写进 `analyze_brand` 工具描述，避免 agent 误以为能操控取数。

---

## 8. 分阶段交付（对齐 DataScaler P0/P1/P2）

| 阶段 | MCP 工具 | 依赖 DataScaler |
|---|---|---|
| **M0** | `list_brands` `get_brand_metrics` `social_capabilities` | P0 已交付 |
| **M1** | + 建/改品牌、refresh/进度、posts/语义/情感/声量/竞品/风险 | P1 数据管道+采集 |
| **M2** | + `analyze_brand` `get_brand_summary`（提示词覆盖） | P2 深度分析 |

MCP 仓库可先把 M0 + 工具骨架 + 错误映射 + 异步编排框架搭好，Java mock 上游，等 DataScaler 分阶段交付逐个接真。

---

## 9. Open Questions（联调前必须问 DataScaler / W）

契约是 v0.1 草案，以下未定死、会卡实现：

1. **`setup_brand`（POST /brands）扣费语义**：返回 jobId（异步如 refresh）还是同步返回 brandId？建品牌 + 首采**扣几次费**（一次还是两次）？
2. **`get_brand_summary`（POST /summary）扣不扣费**：契约 §5 未标。本 spec 先按**扣费**设计，待确认。
3. **token 缓存实际 TTL**：契约写 `expires_in:3600`，确认是否有提前轮换。Java 缓存留 10% 安全边际（提前 ~5min 重换）。
4. **`analyze` 是否异步**：契约标 [P2] 未说同步/异步。本 spec 先按**同步**设计；若报告生成耗时长需 jobId 化。
5. **只读端点分页/字段**：posts/semantic 分页游标、metrics 字段全集，契约只给示例。M1 交付时以实测响应为准，spec 标「字段以实测为准」。
6. **Staging 环境 + 凭证**：契约 §3 写「联调时提供」，目前无。**实现可先 mock DataScaler 响应，拿到 staging 凭证后联调。**

---

## 10. 安全清单（契约 §10）

- `client_secret` / access token 仅存 Java 服务端，不下发 MCP/客户端。
- `X-DataScaler-External-User-Id` 由 Java 从已认证会话注入，**禁止前端/MCP 客户端传入**（防越权）。
- 对外只返回聚合/合成结果；不暴露 DataScaler 底层社媒原始抓取接口。
- requestId / traceId 双记，排障留痕。
