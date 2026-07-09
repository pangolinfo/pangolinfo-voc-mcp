/**
 * examples/demo-client.mjs
 *
 * 用真实 MCP 协议(JSON-RPC over stdio)跟 ../dist/server.mjs 对话,
 * 走一遍完整使用流程:自省 → 列品牌 → 指标 → 语义检索 → 竞品 → 深度分析 → 采集 → 进度。
 *
 * 前置:先 `npm run build`(生成 dist/server.mjs),再启动 mock-backend.mjs(见 README)。
 * MCP server 通过 --scrape-base 指向 mock 后端(默认 http://localhost:8787)。
 *
 * 环境变量(均可选):
 *   MOCK_PORT     mock 后端端口(默认 8787)
 *   DEMO_LANG     zh | en(默认 zh)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "../dist/server.mjs");
const PORT = Number(process.env.MOCK_PORT || 8787);
const LANG = process.env.DEMO_LANG || "zh";

const srv = spawn(
  "node",
  [
    SERVER,
    "--api-key=demo_key_not_checked_by_mock",
    `--scrape-base=http://localhost:${PORT}`,
    `--lang=${LANG}`,
  ],
  { stdio: ["pipe", "pipe", "inherit"] },
);

let buf = "";
const pending = new Map();
srv.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let idSeq = 0;
function rpc(method, params) {
  const id = ++idSeq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function callTool(name, args) {
  console.log(`\n┌─ 🔧 ${name}(${JSON.stringify(args)})`);
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.result?.isError) {
    console.log(`└─ ❌ ${r.result.content[0].text.split("\n")[0]}`);
    return null;
  }
  const text = r.result.content[0].text;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return data?.data ?? data;
}

(async () => {
  console.log("════════════════════════════════════════════════════════");
  console.log(" Pangolinfo DataScaler MCP — 完整使用流程演示");
  console.log("════════════════════════════════════════════════════════");

  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "demo-ai-client", version: "1.0" },
  });
  console.log(
    `\n✅ 握手成功。Server: ${init.result.serverInfo.name} v${init.result.serverInfo.version}`,
  );
  const list = await rpc("tools/list", {});
  console.log(`✅ 发现 ${list.result.tools.length} 个工具`);

  console.log("\n\n━━━ ① AI 自省:能干什么、哪些扣费 ━━━");
  const cap = await callTool("social_capabilities", {});
  console.log(`   ${cap.product}`);
  console.log(`   扣费工具: ${cap.tools.filter((t) => t.charged).map((t) => t.name).join(", ")}`);

  console.log("\n\n━━━ ② 列出我的品牌(数据隔离) ━━━");
  const brands = await callTool("list_brands", { limit: 5 });
  if (!brands?.brands?.length) {
    console.log("   (没有品牌 —— 先用 setup_brand 接入一个)");
    srv.kill();
    process.exit(0);
  }
  const brand = brands.brands[0];
  const BID = brand.id;
  console.log(`   品牌: ${brand.name} (id=${BID}) dataReady=${brand.dataReady}`);

  console.log("\n\n━━━ ③ 指标概览(免费) ━━━");
  const metrics = await callTool("get_brand_metrics", { brandId: BID });
  if (metrics?.summary) {
    console.log(
      `   近${metrics.days}天: 帖子${metrics.summary.totalPosts} 触达${metrics.summary.totalReach} 互动${metrics.summary.totalEngagement}`,
    );
    const sd = metrics.sentimentDistribution;
    if (sd) console.log(`   情感: 正${sd.positive.percentage}% 中${sd.neutral.percentage}% 负${sd.negative.percentage}%`);
  }

  console.log("\n\n━━━ ④ 语义检索(免费) ━━━");
  const posts = await callTool("find_posts_about", { brandId: BID, query: "charger quality", limit: 3 });
  if (posts) console.log(`   "charger quality" 匹配到 ${posts.count} 条帖子`);

  console.log("\n\n━━━ ⑤ 竞品对比(免费) ━━━");
  const cmp = await callTool("compare_competitors", { brandId: BID });
  if (cmp) console.log(`   返回字段: ${Object.keys(cmp).join(", ")}`);

  console.log("\n\n━━━ ⑥ 深度分析(💰扣费,同步返回报告) ━━━");
  const ana = await callTool("analyze_brand", {
    brandId: BID,
    question: "What do customers like and dislike about this brand?",
    days: 30,
  });
  if (ana?.report) {
    console.log(`   📊 报告(前 240 字):\n   ${String(ana.report).slice(0, 240).replace(/\n/g, "\n   ")}...`);
  }

  console.log("\n\n━━━ ⑦ 发起采集(💰扣费,异步返 jobId) ━━━");
  const refresh = await callTool("refresh_brand", { brandId: BID });
  if (refresh?.jobId) {
    console.log(`   jobId=${refresh.jobId} alreadyRunning=${refresh.alreadyRunning ?? "?"}`);
    console.log("\n━━━ ⑧ 轮询进度(免费,不阻塞) ━━━");
    const prog = await callTool("get_refresh_progress", { jobId: refresh.jobId });
    if (prog) console.log(`   status=${prog.status} progress=${prog.progress ?? "?"}`);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log(" ✅ 演示完成");
  console.log("════════════════════════════════════════════════════════");
  srv.kill();
  process.exit(0);
})();
