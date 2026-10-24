/** First value of a search parameter that may repeat (`?a=1&a=2`). */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
