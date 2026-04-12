// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  modules: ["@nuxt/ui", "@nuxtjs/color-mode", "@nuxtjs/supabase"],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY ?? "",
    public: {},
  },

  // Configuración del módulo Supabase con redirect automático
  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
    redirect: true,
    redirectOptions: {
      login: "/auth/login",
      callback: "/auth/callback",
      exclude: [
        "/auth/**",
        "/",
        "/pricing",
        "/about",
        "/terms",
        "/privacy",
        "/test-all-composables",
      ],
    },
    cookiePrefix: "nexuspos-auth",
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7,
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },
  nitro: {
    preset: "cloudflare-pages",
  },
});
