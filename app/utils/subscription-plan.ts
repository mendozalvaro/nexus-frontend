export type PlanLimitScalar = number | boolean;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const normalizePlanKey = (key: string): string => {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
};

const toKeyVariants = (key: string): string[] => {
  const trimmed = key.trim();
  if (!trimmed) {
    return [];
  }

  const parts = trimmed.split(/[.\-_:\s/]+/).filter(Boolean);
  if (parts.length === 0) {
    return [trimmed];
  }

  const lowerParts = parts.map((part) => part.toLowerCase());
  const snake = lowerParts.join("_");
  const kebab = lowerParts.join("-");
  const dotted = lowerParts.join(".");

  return Array.from(new Set([trimmed, snake, kebab, dotted]));
};

const hasBooleanValue = (
  record: Record<string, boolean>,
  key: string,
): boolean | null => {
  const aliases = toKeyVariants(key);
  const normalizedAliases = new Set(aliases.map((alias) => normalizePlanKey(alias)));

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (!normalizedAliases.has(normalizePlanKey(entryKey))) {
      continue;
    }

    return entryValue;
  }

  return null;
};

const hasNumericValue = (
  record: Record<string, PlanLimitScalar>,
  key: string,
): number | null => {
  const aliases = toKeyVariants(key);
  const normalizedAliases = new Set(aliases.map((alias) => normalizePlanKey(alias)));

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (!normalizedAliases.has(normalizePlanKey(entryKey)) || typeof entryValue !== "number") {
      continue;
    }

    if (!Number.isFinite(entryValue)) {
      continue;
    }

    return entryValue;
  }

  return null;
};

const hasScalarBooleanValue = (
  record: Record<string, PlanLimitScalar>,
  key: string,
): boolean | null => {
  const aliases = toKeyVariants(key);
  const normalizedAliases = new Set(aliases.map((alias) => normalizePlanKey(alias)));

  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (!normalizedAliases.has(normalizePlanKey(entryKey)) || typeof entryValue !== "boolean") {
      continue;
    }

    return entryValue;
  }

  return null;
};

export const readBooleanPlanPermissions = (
  value: unknown,
): Record<string, boolean> => {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "boolean") {
      result[key] = raw;
    }
  }
  return result;
};

export const flattenPlanLimits = (
  value: unknown,
): Record<string, PlanLimitScalar> => {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, PlanLimitScalar> = {};

  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [key, raw] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        result[path] = raw;
        continue;
      }
      if (typeof raw === "boolean") {
        result[path] = raw;
        continue;
      }
      if (isRecord(raw)) {
        walk(raw, path);
      }
    }
  };

  walk(value, "");
  return result;
};

export const resolvePlanPermission = (
  permissions: Record<string, boolean> | null | undefined,
  moduleKey: string,
  fallback = true,
): boolean => {
  if (!permissions || Object.keys(permissions).length === 0) {
    return fallback;
  }

  const direct = hasBooleanValue(permissions, moduleKey);
  if (direct !== null) {
    return direct;
  }

  return fallback;
};

export const resolvePlanNumericLimit = (
  limits: Record<string, PlanLimitScalar> | null | undefined,
  candidates: string[],
): number | null => {
  if (!limits || candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const found = hasNumericValue(limits, candidate);
    if (found !== null) {
      return found;
    }
  }

  return null;
};

export const resolvePlanBooleanLimit = (
  limits: Record<string, PlanLimitScalar> | null | undefined,
  candidates: string[],
): boolean | null => {
  if (!limits || candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const found = hasScalarBooleanValue(limits, candidate);
    if (found !== null) {
      return found;
    }
  }

  return null;
};
