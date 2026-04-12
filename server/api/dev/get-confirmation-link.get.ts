import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";
import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

export default defineEventHandler(async (event: H3Event) => {
  if (process.env.NODE_ENV === "production") {
    throw createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
  }

  const config = useRuntimeConfig(event);
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
    // Get the email from the query parameter (most recent unconfirmed user)
    const query = getQuery(event);
    const email = query.email as string;

    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: "Email parameter is required",
      });
    }

    // Get the user
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

    if (!user.email) {
      throw createError({
        statusCode: 400,
        statusMessage: "User email not found",
      });
    }

    if (user.email_confirmed_at) {
      return {
        confirmed: true,
        message: "Email already confirmed",
        userId: user.id,
      };
    }

    // Generate a confirmation token by triggering resend_email in Supabase
    // This creates a new confirmation link
    const { error: resendError } = await adminClient.auth.resend({
      type: "signup",
      email: user.email,
      options: {
        emailRedirectTo: `${url.replace(/\/$/, "")}/auth/callback`,
      },
    });

    if (resendError) {
      throw resendError;
    }

    // In development, directly confirm the email for testing purposes
    const { error: confirmError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true,
      },
    );

    if (confirmError) {
      throw confirmError;
    }

    return {
      success: true,
      userId: user.id,
      email,
      confirmed: true,
      message: "Email confirmed in development mode",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get confirmation";
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
