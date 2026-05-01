import { setResponseHeader } from "h3";
import type { H3Event } from "h3";

export const setCacheHeaders = (
  event: H3Event,
  options: {
    sMaxAge: number;
    staleWhileRevalidate?: number;
    visibility?: "public" | "private";
  },
) => {
  const visibility = options.visibility ?? "private";
  const swr = options.staleWhileRevalidate ?? 0;
  setResponseHeader(
    event,
    "Cache-Control",
    `${visibility}, s-maxage=${Math.max(0, options.sMaxAge)}, stale-while-revalidate=${Math.max(0, swr)}`,
  );
};
