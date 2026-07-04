import { PENDING_ALLOWED_PATH_PREFIXES } from "@/config/navigation";

export default defineNuxtRouteMiddleware(async (to) => {
  const safePublicPrefixes = ["/auth"];
  const safePublicPaths = ["/", "/terms", "/privacy"];
  const paymentOnlyPath = "/onboarding/payment";
  const isPublicStorefront = to.meta.publicStorefront === true;

  if (
    isPublicStorefront ||
    safePublicPrefixes.some((prefix) => to.path.startsWith(prefix)) ||
    safePublicPaths.includes(to.path)
  ) {
    return;
  }
  const { accountStatus, paymentRequired, contextBootstrapState } = useUserContext();

  if (contextBootstrapState.value === "resolving") {
    return;
  }

  const safePendingPrefixes = [
    paymentOnlyPath,
    "/onboarding/success",
    ...PENDING_ALLOWED_PATH_PREFIXES,
  ];
  const isSafePendingPath =
    safePendingPrefixes.some((prefix) => to.path.startsWith(prefix));

  if (isSafePendingPath) {
    return;
  }

  if (paymentRequired) {
    return navigateTo(paymentOnlyPath);
  }

  if (accountStatus.value === "pending") {
    return navigateTo("/dashboard");
  }
});
