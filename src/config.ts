/**
 * Pangolinfo VOC MCP - shared configuration constants.
 *
 * 这是白标"品牌社媒洞察"MCP。它本身不持上游凭证、不做扣费 ——
 * 所有调用都打到 Pangolinfo 自己的后端 `/api/v1/social/*`(部署在 scrapeapi 上),
 * 由后端注入上游凭证 + externalUserId + 扣费,再转发给上游数据供应商。
 *
 * 鉴权复用 pangolinfo 同一套 API Key(env PANGOLINFO_API_KEY / --api-key / config),
 * 所以 DEFAULT_SCRAPE_BASE 与主 MCP 一致。
 */

import { SERVER_VERSION } from "./version.js";

export const CONFIG = {
  DEFAULT_API_BASE: "https://extapi.pangolinfo.com",
  DEFAULT_SCRAPE_BASE: "https://scrapeapi.pangolinfo.com",
  CONFIG_FILE_PATH: "~/.pangolinfo/config.json",
  USER_AGENT: `pangolinfo-voc-mcp/${SERVER_VERSION}`,
  WEBSITE_URL: "https://www.pangolinfo.com",
} as const;
