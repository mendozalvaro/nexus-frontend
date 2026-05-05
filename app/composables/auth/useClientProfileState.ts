import type { Ref } from "vue";

import type { User } from "@supabase/supabase-js";

import type { ClientProfileState } from "@/types/client";
import { isValidUuid, PROFILE_CACHE_TTL_MS, sanitizeNullableString } from "@/utils/auth";

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export const useClientProfileState = (
  userRef: Ref<User | null>,
  activeOrganizationIdRef: Ref<string | null>,
  resolveUser: (options?: { force?: boolean }) => Promise<User | null>,
) => {
  const clientProfile = useState<ClientProfileState | null>("auth:client-profile", () => null);
  const clientProfileFetchedForUserId = useState<string | null>("auth:client-profile:fetched-user-id", () => null);
  const clientProfileFetchedForOrgId = useState<string | null>("auth:client-profile:fetched-org-id", () => null);
  const clientProfileFetchedAt = useState<number>("auth:client-profile:fetched-at", () => 0);
  const clientProfileLoading = useState<boolean>("auth:client-profile:is-loading", () => false);
  const clientProfileLoadingKey = useState<string | null>("auth:client-profile:loading-key", () => null);

  const clearClientProfileState = () => {
    clientProfile.value = null;
    clientProfileFetchedForUserId.value = null;
    clientProfileFetchedForOrgId.value = null;
    clientProfileFetchedAt.value = 0;
    clientProfileLoading.value = false;
    clientProfileLoadingKey.value = null;
  };

  const fetchClientProfile = async (
    options: { force?: boolean; organizationId?: string | null } = {},
  ): Promise<ClientProfileState | null> => {
    const currentUser = userRef.value ?? await resolveUser();
    const nextOrganizationId = sanitizeNullableString(options.organizationId) ?? activeOrganizationIdRef.value;

    if (!currentUser || !isValidUuid(currentUser.id) || !isValidUuid(nextOrganizationId)) {
      clearClientProfileState();
      return null;
    }

    const forceRefresh = options.force === true;
    const requestKey = `${currentUser.id}:${nextOrganizationId}`;
    const cacheIsFresh =
      clientProfileFetchedForUserId.value === currentUser.id
      && clientProfileFetchedForOrgId.value === nextOrganizationId
      && Date.now() - clientProfileFetchedAt.value < PROFILE_CACHE_TTL_MS;

    if (!forceRefresh && cacheIsFresh) {
      return clientProfile.value;
    }

    if (!forceRefresh && clientProfileLoading.value && clientProfileLoadingKey.value === requestKey) {
      let attempts = 0;
      while (clientProfileLoading.value && attempts < 40) {
        await wait(25);
        attempts += 1;
      }

      const cacheAfterWait =
        clientProfileFetchedForUserId.value === currentUser.id
        && clientProfileFetchedForOrgId.value === nextOrganizationId
        && Date.now() - clientProfileFetchedAt.value < PROFILE_CACHE_TTL_MS;

      if (cacheAfterWait) {
        return clientProfile.value;
      }
    }

    clientProfileLoading.value = true;
    clientProfileLoadingKey.value = requestKey;

    try {
      const response = await $fetch<{
        profile: ClientProfileState | null;
      }>("/api/clients/profile", {
        query: {
          organizationId: nextOrganizationId,
        },
      });

      clientProfile.value = response.profile ?? null;
      clientProfileFetchedForUserId.value = currentUser.id;
      clientProfileFetchedForOrgId.value = nextOrganizationId;
      clientProfileFetchedAt.value = Date.now();
      return clientProfile.value;
    } catch {
      clearClientProfileState();
      return null;
    } finally {
      if (clientProfileLoadingKey.value === requestKey) {
        clientProfileLoading.value = false;
        clientProfileLoadingKey.value = null;
      }
    }
  };

  return {
    clientProfile,
    clientProfileFetchedForOrgId,
    fetchClientProfile,
    clearClientProfileState,
  };
};
