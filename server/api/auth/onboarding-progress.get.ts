import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";

export default defineEventHandler(async (event) => {
  const { adminClient, userId } = await requireAuthServerContext(event);

  const { data, error } = await adminClient
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwApiError(
      500,
      "AUTH_ONBOARDING_PROGRESS_FETCH_ERROR",
      error.message,
      { userId },
    );
  }

  return {
    progress: data ?? null,
  };
});
