/**
 * Pangolinfo VOC MCP - 共享 query-string 构造工具。
 *
 * 各只读工具的过滤/分页参数透传给后端时,统一用这里拼 query string,
 * 避免每个工具各写一份 buildQuery(原先 8 处重复)。
 * 只拼非 null/undefined 的值;值用 encodeURIComponent 编码。
 */

export type QueryValue = string | number | boolean | null | undefined;

/**
 * 把一组 (key,value) 拼成 `?k=v&k2=v2`。空对象 / 全空值 → 返回 ""。
 * key 顺序按传入对象的属性顺序(稳定)。
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
