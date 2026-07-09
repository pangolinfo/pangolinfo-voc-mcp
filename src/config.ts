/**
 * Pangolinfo DataScaler MCP - shared configuration constants.
 *
 * 这是白标"品牌社媒洞察"MCP。它本身不持 DataScaler 凭证、不做扣费 ——
 * 所有调用都打到 Pangolin 自己的后端 `/api/v1/social/*`(部署在 scrapeapi 上),
 * 由后端注入 DataScaler 凭证 + externalUserId + 扣费,再转发给 DataScaler。
 *
 * 鉴权复用 pangolinfo 同一套 API Key(env PANGOLINFO_API_KEY / --api-key / config),
 * 所以 DEFAULT_SCRAPE_BASE 与主 MCP 一致。
 */

import { SERVER_VERSION } from "./version.js";

export const CONFIG = {
  DEFAULT_API_BASE: "https://extapi.pangolinfo.com",
  DEFAULT_SCRAPE_BASE: "https://scrapeapi.pangolinfo.com",
  CONFIG_FILE_PATH: "~/.pangolinfo/config.json",
  USER_AGENT: `pangolinfo-datascaler-mcp/${SERVER_VERSION}`,
  WEBSITE_URL: "https://www.pangolinfo.com",
} as const;
