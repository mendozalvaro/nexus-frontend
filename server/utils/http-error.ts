import { createError } from "h3";

export const throwApiError = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): never => {
  throw createError({
    statusCode,
    statusMessage: message,
    data: {
      code,
      message,
      details: details ?? null,
    },
  });
};
