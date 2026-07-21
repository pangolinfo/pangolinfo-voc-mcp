/**
 * Pangolinfo VOC MCP - tool registry (品牌社媒洞察 · v0.3 知识空间版)。
 *
 * 共 26 个 tool = 25 业务工具 + 1 自省(social_capabilities)。
 * social_capabilities 放第一位 —— AI 首次接入建议先调(或 get_context 拿实时计费模式/品牌/平台)。
 *
 * 默认接入走【知识空间】:prepare_space → create_space。setup_brand 是完整品牌(高级)。
 * 扣费工具:create_space / refresh_brand / setup_brand(采集,按 estimatedPoints) + analyze_brand(600 points)。
 * 其余全免费(含 prepare_space / get_brand_summary / get_social_voc_report_kit / 所有只读 / context / diagnose / wait / get_billing_rules)。
 * 注:get_usage 已移除(暴露上游批发账户用量,白标不对外;用户用量到 pangolinfo.com 查)。
 *
 * 加新 tool:实现 <name>.ts → 在此 import → append 到数组。
 */

import type { Tool } from "./_types.js";

import { socialCapabilities } from "./social_capabilities.js";
// 上下文/账户(免费)
import { getContext } from "./get_context.js";
import { suggestNextActions } from "./suggest_next_actions.js";
import { explainError } from "./explain_error.js";
import { getBillingRules } from "./get_billing_rules.js";
// 知识空间(默认接入)
import { prepareSpace } from "./prepare_space.js";
import { createSpace } from "./create_space.js";
// 品牌
import { listBrands } from "./list_brands.js";
import { getBrand } from "./get_brand.js";
import { prepareBrandOnboarding } from "./prepare_brand_onboarding.js";
import { setupBrand } from "./setup_brand.js";
import { updateBrand } from "./update_brand.js";
// 采集
import { diagnoseBrand } from "./diagnose_brand.js";
import { refreshBrand } from "./refresh_brand.js";
import { getRefreshProgress } from "./get_refresh_progress.js";
import { waitForRefresh } from "./wait_for_refresh.js";
// 数据(只读)
import { getBrandMetrics } from "./get_brand_metrics.js";
import { searchBrandPosts } from "./search_brand_posts.js";
import { findPostsAbout } from "./find_posts_about.js";
import { getBrandSentiment } from "./get_brand_sentiment.js";
import { getVoiceShare } from "./get_voice_share.js";
import { compareCompetitors } from "./compare_competitors.js";
import { getRiskAlerts } from "./get_risk_alerts.js";
// 报告 / 分析
import { getSocialVocReportKit } from "./get_social_voc_report_kit.js";
import { analyzeBrand } from "./analyze_brand.js";
import { getBrandSummary } from "./get_brand_summary.js";

export const tools: Tool[] = [
  socialCapabilities,
  // 上下文/账户
  getContext,
  suggestNextActions,
  explainError,
  getBillingRules,
  // 知识空间(默认接入)
  prepareSpace,
  createSpace,
  // 品牌
  listBrands,
  getBrand,
  prepareBrandOnboarding,
  setupBrand,
  updateBrand,
  // 采集
  diagnoseBrand,
  refreshBrand,
  getRefreshProgress,
  waitForRefresh,
  // 数据(只读)
  getBrandMetrics,
  searchBrandPosts,
  findPostsAbout,
  getBrandSentiment,
  getVoiceShare,
  compareCompetitors,
  getRiskAlerts,
  // 报告 / 分析
  getSocialVocReportKit,
  analyzeBrand,
  getBrandSummary,
];
