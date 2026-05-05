<script setup lang="ts">
const props = defineProps<{
  trustBadges: readonly string[]
}>()

const { navigateToAuth, scrollToSection } = useLanding()
</script>

<template>
  <section class="landing-hero-shell relative overflow-hidden pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-20">
    <div class="landing-hero-orb landing-hero-orb-left" aria-hidden="true" />
    <div class="landing-hero-orb landing-hero-orb-right" aria-hidden="true" />

    <div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12 lg:px-8 xl:gap-16">
      <div class="landing-reveal landing-reveal-visible lg:pt-14 xl:pt-18">
        <div class="inline-flex items-center gap-2 rounded-full border border-primary-200/80 bg-primary-50/90 px-4 py-2 text-sm font-medium text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
          <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
          Lanzamiento Abril 2026
        </div>

        <h1 class="mt-6 max-w-[9ch] text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:max-w-[10ch] sm:text-5xl lg:max-w-[8ch] lg:text-[4.35rem] lg:leading-[0.98] xl:max-w-[8.5ch] xl:text-[4.7rem]">
          Unifica tu inventario, domina tu agenda, escala tu negocio
        </h1>

        <p class="mt-6 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
          Gestiona productos, servicios y citas en una sola plataforma disenada para salones, tiendas y negocios hibridos.
        </p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <UButton
            color="primary"
            size="xl"
            trailing-icon="i-lucide-arrow-right"
            class="rounded-full px-6"
            @click="navigateToAuth('/auth/register')"
          >
            Comenzar Gratis
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            icon="i-lucide-play"
            class="rounded-full px-6"
            @click="scrollToSection('product-tour')"
          >
            Ver Demo
          </UButton>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <div
            v-for="badge in props.trustBadges"
            :key="badge"
            class="landing-trust-badge"
          >
            <UIcon name="i-lucide-check" class="h-4 w-4" />
            <span>{{ badge }}</span>
          </div>
        </div>
      </div>

      <div
        id="product-tour"
        class="landing-reveal landing-reveal-visible lg:pl-2 xl:pl-6 [transition-delay:120ms]"
      >
        <UCard class="landing-screenshot-card overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-0 shadow-2xl shadow-slate-900/10 dark:border-slate-800/80 dark:bg-slate-900/90">
          <div class="border-b border-slate-200/80 bg-slate-50/85 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/70">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Beneficios principales
                </p>
                  <p class="mt-1.5 text-xl font-semibold text-slate-950 dark:text-white">
                    Todo lo que necesitas para crecer
                  </p>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <span class="h-3 w-3 rounded-full bg-rose-400" />
                <span class="h-3 w-3 rounded-full bg-amber-400" />
                <span class="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>

          <div class="p-4 xl:p-5">
            <div class="grid gap-4 xl:grid-cols-3">
              <div class="text-center">
                <UIcon name="i-lucide-users" class="mx-auto h-8 w-8 text-primary-500" />
                <p class="mt-2 font-semibold text-slate-950 dark:text-white">Multi-usuario</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Admin, managers y empleados con roles granulares</p>
              </div>
              <div class="text-center">
                <UIcon name="i-lucide-building-2" class="mx-auto h-8 w-8 text-primary-500" />
                <p class="mt-2 font-semibold text-slate-950 dark:text-white">Multi-sucursal</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Gestiona múltiples ubicaciones desde un panel</p>
              </div>
              <div class="text-center">
                <UIcon name="i-lucide-shield-check" class="mx-auto h-8 w-8 text-primary-500" />
                <p class="mt-2 font-semibold text-slate-950 dark:text-white">Seguro</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">Auditoría forense y RLS en base de datos</p>
              </div>
            </div>

            <div class="mt-6 text-center">
              <p class="text-lg font-medium text-slate-950 dark:text-white">
                Únete a miles de negocios que ya confían en NexusPOS
              </p>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Desde salones de belleza hasta talleres automotrices, unifica tu operación
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </section>
</template>
