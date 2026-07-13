# DataScaler VOC MCP v0.3.1 — 阿里云 ACK 部署手册

> 部署目标: 让 MCP 客户端通过 `https://voc.pangolinfo.com/mcp?api_key=pgl_xxx` 直接连云端 MCP server,无需安装任何东西。
> 架构: AI 客户端 → 本 MCP(纯转发)→ Java scrapeapi(crawler-ext-service, 扣费在此)→ DataScaler Partner API。

---

## 现状速览

| 项 | 值 |
|---|---|
| ACK 集群 | `crawler` @ ap-southeast-1 (新加坡), default namespace |
| 镜像仓库 | `registry-intl.ap-southeast-1.aliyuncs.com/pangolinfo-prod/datascaler-voc` |
| 镜像 tag | `0.3.1`,`latest` |
| 容器端口 | 3000 (HTTP) |
| 探针路径 | `GET /health` |
| MCP 协议端点 | `POST /mcp` |
| 对外方式 | `type: LoadBalancer` Service → ACK 自动建**独立 SLB**(不与 pangolinfo-mcp 共用) |
| 对外域名 | `voc.pangolinfo.com` |
| 证书 | 复用 `*.pangolinfo.com` 自签证书 cert-id(SAN 已含,见 memory / `D:/larkDownload/mcp-cert`) |
| 转发后端 | `PANGOLINFO_SCRAPE_BASE=https://scrapeapi.pangolinfo.com` |

> 参考: pangolinfo-mcp 是同集群同款 LoadBalancer 直挂 SLB(External IP 47.237.210.136);
> datascaler-voc 照同款做,ACK 会自动再建一个**新 SLB**(新公网 IP)。

---

## Step 0: 前置(第一次部署做一次)

```bash
# 在 pangolinfo-datascaler-mcp 根目录:
cp scripts/window/docker-mcp.sh.example scripts/window/docker-mcp.sh
# 编辑 scripts/window/docker-mcp.sh 填真实 ACR 用户名/密码(跟 pangolinfo-mcp / scrapeapi 同一套)
```

---

## Step 1: build + 推镜像(WSL 内,一行命令)

```cmd
cd D:\newCode\pangolinfo-datascaler-mcp
scripts\window\deploy-mcp.cmd 0.3.1
```

脚本会:切到根目录 → 通过 WSL 调 `docker-mcp.sh` → 在 WSL 内 `docker build`(Dockerfile 多阶段自己跑 npm ci + npm run build)→ `docker login` ACR → `docker push :<传入的 tag>` 和 `:latest`。

> ⚠️ 不要用 Git Bash 直接 `docker push` —— 国内→新加坡 ACR 国际版只通过 WSL2 网络栈才连得上,`.cmd` 已包这层。

---

## Step 2: 部署 Deployment + Service + HPA

1. ACK 控制台 → `crawler` 集群 → **工作负载 → 无状态** → **使用 YAML 创建**
2. 把 `deploy/k8s-deployment.yaml` 整个文件贴进去 → **创建**
3. 看到 `datascaler-voc` 2 个 Pod Running

**验证 Pod 日志**(工作负载 → 无状态 → datascaler-voc → 任一 Pod → 日志)应看到:
```
[pangolinfo-datascaler-mcp] locale=en version=0.3.1
[pangolinfo-datascaler-mcp] transport=http
[pangolinfo-datascaler-mcp] http server listening on :3000; endpoint=/mcp health=/health; 25 tool(s) registered
```

**拿新 SLB 的公网 IP**:ACK 控制台 → **网络 → 服务** → 找 `datascaler-voc`(type=LoadBalancer)→ **外部 IP 地址(External IP)** 那一列,记下这个 IP(下一步 DNS 用)。SLB 由 ACK 自动创建管理,几十秒内出 IP。

---

## Step 3: DNS 解析(Cloudflare)

加一条 DNS 记录:

| 类型 | 主机 | 记录值 | 代理 |
|---|---|---|---|
| `A` | `voc` | Step 2 拿到的新 SLB External IP | Proxied(橙云,跟 mcp / scrapeapi 同款) |

> Cloudflare SSL/TLS 模式当前是 **Full**(不校验后端证书 CN),自签证书够用。**绝对不要改 Flexible**(会影响 scrapeapi)。

---

## Step 4: 验证

DNS 生效后(Cloudflare 通常几分钟):

```bash
# 1. health 检查 (无需 API key)
curl https://voc.pangolinfo.com/health
# 期望: {"status":"ok","version":"0.3.1","toolCount":25}

# 2. 列工具 (25 个)
curl -X POST "https://voc.pangolinfo.com/mcp?api_key=pgl_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
# 期望: 25 个 tool

# 3. 真调一次免费工具
curl -X POST "https://voc.pangolinfo.com/mcp?api_key=pgl_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"social_capabilities","arguments":{}}}'
```

客户端配置:
```
MCP server URL: https://voc.pangolinfo.com/mcp?api_key=pgl_xxx
```

---

## 升级镜像(以后改了 MCP 代码怎么发新版)

**Step 1** — build + 推新 tag:
```cmd
cd D:\newCode\pangolinfo-datascaler-mcp
scripts\window\deploy-mcp.cmd 0.2.1
```

**Step 2** — ACK 控制台触发滚动更新:
`crawler` 集群 → 工作负载 → 无状态 → `datascaler-voc` → **升级** → image tag 改成 `0.2.1` → **提交**。
2 副本一个一个滚,零停机。

---

## 排查

| 症状 | 可能原因 | 排查 |
|---|---|---|
| Pod CrashLoopBackOff | 镜像拉不下来 / 配置错 | ACK Pod → 事件 / 日志 |
| Service External IP 一直 `<pending>` | SLB 配额 / annotation 错 | ACK Pod 事件看 SLB 创建报错 |
| 401 但已传 key | URL 编码 / 客户端没透传 ?api_key | curl raw URL 测 |
| 502 / 504 | Cloudflare 524(长请求超时) | analyze 是唯一慢端点,已配 ~100s 内;见 memory 超时链条 |
| 调 tool 返回 SERVICE_UNAVAILABLE | MCP 出网到 scrapeapi 失败 | 看 pod 日志;若 scrapeapi 同集群可换内网地址 |

---

## 已知约束

- **analyze 超时**: 经 Cloudflare(~100s 524)+ Java WebClient(115s),analyze 实际上限 ~100s,MCP deadline 配 110s。别把慢请求设成 180s。详见 memory `reference_datascaler_analyze_timeout_chain`。
- **staging 凭证只在 Java 私有仓**: 本 public MCP 仓不含任何 DataScaler 密钥;扣费/凭证全在 crawler-ext-service 的 application-dev.yml。
