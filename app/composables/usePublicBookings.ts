import type {
  PublicBookingAvailabilityResponse,
  PublicBookingCatalogResponse,
  PublicBookingClientLinkPayload,
  PublicBookingClientProfile,
  PublicBookingCreatePayload,
  PublicBookingCreateResponse,
} from "@/types/public-booking";

export const usePublicBookings = () => {
  const { resolveStorefrontAccessToken } = useStorefrontAuth();

  const loadCatalogBySlug = async (slug: string): Promise<PublicBookingCatalogResponse> => {
    const normalizedSlug = slug.trim().toLowerCase();
    return await $fetch<PublicBookingCatalogResponse>(`/api/public/bookings/${normalizedSlug}/catalog`);
  };

  const loadAvailabilityBySlug = async (
    slug: string,
    params: {
      branchId: string;
      serviceId: string;
      employeeId: string;
      date: string;
    },
  ): Promise<PublicBookingAvailabilityResponse> => {
    const normalizedSlug = slug.trim().toLowerCase();
    return await $fetch<PublicBookingAvailabilityResponse>(`/api/public/bookings/${normalizedSlug}/availability`, {
      query: params,
    });
  };

  const loadClientProfileBySlug = async (slug: string): Promise<PublicBookingClientProfile | null> => {
    const normalizedSlug = slug.trim().toLowerCase();
    const accessToken = await resolveStorefrontAccessToken();

    return await $fetch<PublicBookingClientProfile | null>(`/api/public/bookings/${normalizedSlug}/me`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  };

  const linkClientProfileBySlug = async (
    slug: string,
    payload: PublicBookingClientLinkPayload,
  ): Promise<PublicBookingClientProfile> => {
    const normalizedSlug = slug.trim().toLowerCase();
    const accessToken = await resolveStorefrontAccessToken();

    return await $fetch<PublicBookingClientProfile>(`/api/public/bookings/${normalizedSlug}/client-link`, {
      method: "POST",
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  };

  const createBookingBySlug = async (
    slug: string,
    payload: PublicBookingCreatePayload,
  ): Promise<PublicBookingCreateResponse> => {
    const normalizedSlug = slug.trim().toLowerCase();
    const accessToken = await resolveStorefrontAccessToken();
    return await $fetch<PublicBookingCreateResponse>(`/api/public/bookings/${normalizedSlug}`, {
      method: "POST",
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  };

  return {
    loadCatalogBySlug,
    loadAvailabilityBySlug,
    loadClientProfileBySlug,
    linkClientProfileBySlug,
    createBookingBySlug,
  };
};
