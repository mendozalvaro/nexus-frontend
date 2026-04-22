import { createError } from "h3";

export const assertValidDevAdminKey = (
  providedKey: string | undefined,
  expectedKey: string | undefined,
) => {
  if (!expectedKey || providedKey !== expectedKey) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
    });
  }
};

