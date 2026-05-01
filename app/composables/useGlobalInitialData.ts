import { CACHE_KEYS } from "@/utils/cache-keys";

export interface InitialDataPayload {
  organization: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
  branches: Array<Record<string, unknown>>;
}

const defaultInitialData = (): InitialDataPayload => ({
  organization: null,
  profile: null,
  subscription: null,
  plan: null,
  branches: [],
});

export const useGlobalInitialData = () => {
  return useFetch<InitialDataPayload>("/api/initial-data", {
    key: CACHE_KEYS.initialData,
    lazy: false,
    dedupe: "defer",
    default: defaultInitialData,
  });
};
