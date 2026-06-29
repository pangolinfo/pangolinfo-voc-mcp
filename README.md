# pangolinfo-social-mcp

Pangolin 白标 **品牌社媒洞察 MCP** —— 在 DataScaler Partner API 之上自建的 MCP server（纯转发层）。

## 定位

终端 AI 用户只看到 Pangolin。本仓库是 MCP 协议转发层：
**不持 DataScaler 凭证、不做扣费、不碰额度**。凭证缓存、`externalUserId` 注入、扣费、错误映射全部在 Java 后端 `crawler-ext-service` 的 social 模块。

```
AI 客户端 → pangolinfo-social-mcp（本仓，转发）
          → crawler-ext-service /extapi/social/*（Java，扣费在此）
          → DataScaler Partner API
```

## 工具

16 个工具（15 面向 AI + 1 自省）。扣费工具仅 4 个：`setup_brand` `refresh_brand` `analyze_brand` `get_brand_summary`，受理即扣不退；只读全免费。

详见 [设计 spec](docs/specs/2026-06-29-social-insights-mcp-design.md)。

## 状态

设计定稿（2026-06-29），等 DataScaler staging 凭证联调。可先 mock 上游搭骨架。

## 关联仓库

- `crawler-ext-service`（Java 后端，新增 social 模块 + 扣费）
- `pangolinfo-mcp`（现有 Amazon MCP，本仓沿用其鉴权与命名风格）
