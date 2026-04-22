import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import { assertValidDevAdminKey } from "../../utils/dev-security";

export default defineEventHandler(async (event: H3Event) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    throw createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
  }

  const config = useRuntimeConfig(event);
  const devAdminKey = config.devAdminKey;
  const requestKey = getHeader(event, "x-dev-admin-key");
  assertValidDevAdminKey(requestKey ?? undefined, devAdminKey);

  const body = await readBody(event);
  const email = body.email?.toLowerCase();

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email is required",
    });
  }

  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!url || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Supabase configuration incomplete",
    });
  }

  const adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Get the user by email
    const { data: users, error: getUserError } =
      await adminClient.auth.admin.listUsers();

    if (getUserError) {
      throw getUserError;
    }

    const user = users.users.find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found",
      });
    }

    // Update user to mark email as confirmed
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true,
      },
    );

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      userId: user.id,
      email,
      message: "Email confirmed successfully",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm email";
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
