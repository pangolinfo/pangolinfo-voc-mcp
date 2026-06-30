/**
 * Pangolinfo DataScaler MCP - tool registry (品牌社媒洞察)。
 *
 * 共 17 个 tool = 16 业务工具 + 1 自省工具(social_capabilities)。
 * social_capabilities 放在第一位 —— AI 第一次接入时建议先调的自省接口。
 *
 * 扣费工具仅 3 个:setup_brand / refresh_brand / analyze_brand(异步,受理即扣不退)。
 * 其余全部免费,含 get_brand_summary(DataScaler 确认 summary 不扣费,是免费的快速一段式摘要,
 * 与扣费 + 异步 + 深度的 analyze_brand 区分)。
 *
 * 加新 tool:实现 <name>.ts → 在此 import → append 到数组。
 */

import type { Tool } from "./_types.js";

import { socialCapabilities } from "./social_capabilities.js";
import { listBrands } from "./list_brands.js";
import { getBrand } from "./get_brand.js";
import { prepareBrandOnboarding } from "./prepare_brand_onboarding.js";
import { setupBrand } from "./setup_brand.js";
import { updateBrand } from "./update_brand.js";
import { refreshBrand } from "./refresh_brand.js";
import { getRefreshProgress } from "./get_refresh_progress.js";
import { getBrandMetrics } from "./get_brand_metrics.js";
import { searchBrandPosts } from "./search_brand_posts.js";
import { findPostsAbout } from "./find_posts_about.js";
import { getBrandSentiment } from "./get_brand_sentiment.js";
import { getVoiceShare } from "./get_voice_share.js";
import { compareCompetitors } from "./compare_competitors.js";
import { getRiskAlerts } from "./get_risk_alerts.js";
import { analyzeBrand } from "./analyze_brand.js";
import { getBrandSummary } from "./get_brand_summary.js";

export const tools: Tool[] = [
  socialCapabilities,
  listBrands,
  getBrand,
  prepareBrandOnboarding,
  setupBrand,
  updateBrand,
  refreshBrand,
  getRefreshProgress,
  getBrandMetrics,
  searchBrandPosts,
  findPostsAbout,
  getBrandSentiment,
  getVoiceShare,
  compareCompetitors,
  getRiskAlerts,
  analyzeBrand,
  getBrandSummary,
];
