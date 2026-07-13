/**
 * Single source of truth for the MCP server version.
 *
 * Keep release version in package.json only. esbuild bundles this JSON import
 * into dist/server.mjs, so runtime deployments do not need package.json beside
 * the built file.
 */
import pkg from "../package.json" with { type: "json" };

export const SERVER_VERSION = pkg.version;
