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
                  Dashboard NexusPOS
                </p>
                  <p class="mt-1.5 text-xl font-semibold text-slate-950 dark:text-white">
                    Operacion centralizada en una sola vista
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
            <div class="grid gap-3 xl:grid-cols-4">
              <div class="landing-metric-card landing-metric-card-compact">
                  <p class="landing-metric-label">Ventas hoy</p>
                  <p class="landing-metric-value">$4,820</p>
                  <p class="landing-metric-foot text-emerald-600 dark:text-emerald-300">+18% vs ayer</p>
              </div>
              <div class="landing-metric-card landing-metric-card-compact">
                  <p class="landing-metric-label">Citas activas</p>
                  <p class="landing-metric-value">27</p>
                  <p class="landing-metric-foot">3 en espera</p>
              </div>
              <div class="landing-metric-card landing-metric-card-compact">
                  <p class="landing-metric-label">Stock critico</p>
                  <p class="landing-metric-value">5</p>
                  <p class="landing-metric-foot text-amber-600 dark:text-amber-300">Requiere atencion</p>
              </div>
              <div class="landing-metric-card landing-metric-card-compact">
                <p class="landing-metric-label">Agenda del dia</p>
                <p class="landing-metric-value">12</p>
                <p class="landing-metric-foot">Bloques sincronizados</p>
              </div>
            </div>

            <div class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
              <div class="landing-chart-shell landing-chart-shell-compact">
                <div class="flex items-end justify-between gap-3">
                  <div>
                    <p class="landing-metric-label">Ingresos por sucursal</p>
                    <p class="text-lg font-semibold text-slate-950 dark:text-white">Comparativo semanal</p>
                  </div>
                  <span class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                    Actualizado ahora
                  </span>
                </div>
                <div class="mt-4 flex h-32 items-end gap-2.5 xl:h-36">
                  <div class="landing-bar h-[35%] w-1/6" />
                  <div class="landing-bar h-[62%] w-1/6" />
                  <div class="landing-bar h-[54%] w-1/6" />
                  <div class="landing-bar h-[82%] w-1/6" />
                  <div class="landing-bar h-[68%] w-1/6" />
                  <div class="landing-bar h-[92%] w-1/6" />
                </div>
              </div>

              <div class="space-y-3">
                <div class="landing-side-panel landing-side-panel-compact">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="landing-metric-label">Agenda del dia</p>
                    <p class="text-base font-semibold text-slate-950 dark:text-white xl:text-lg">Bloques sincronizados</p>
                  </div>
                  <UIcon name="i-lucide-calendar-clock" class="h-5 w-5 text-primary-500" />
                </div>
                <div class="mt-3 space-y-2.5">
                  <div class="landing-appointment-row landing-appointment-row-compact">
                    <div class="min-w-0">
                      <p class="font-medium text-slate-950 dark:text-white">Color + corte</p>
                      <p class="text-sm text-slate-600 dark:text-slate-300">Ana Lopez - 09:30</p>
                    </div>
                    <span class="landing-chip">Confirmada</span>
                  </div>
                  <div class="landing-appointment-row landing-appointment-row-compact">
                    <div class="min-w-0">
                      <p class="font-medium text-slate-950 dark:text-white">Servicio tecnico</p>
                      <p class="text-sm text-slate-600 dark:text-slate-300">Taller Urbano - 11:00</p>
                    </div>
                    <span class="landing-chip landing-chip-amber">Pendiente</span>
                  </div>
                  <div class="landing-appointment-row landing-appointment-row-compact">
                    <div class="min-w-0">
                      <p class="font-medium text-slate-950 dark:text-white">Banio y grooming</p>
                      <p class="text-sm text-slate-600 dark:text-slate-300">PetLab - 13:15</p>
                    </div>
                    <span class="landing-chip landing-chip-slate">Walk-in</span>
                  </div>
                </div>
                </div>

                <div class="landing-side-panel landing-side-panel-compact">
                  <p class="landing-metric-label">Lo que hace diferente a NexusPOS</p>
                  <ul class="mt-3 space-y-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <li class="flex gap-3">
                      <UIcon name="i-lucide-check-circle-2" class="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                      <span>Inventario, servicios y citas conectados en la misma operacion.</span>
                    </li>
                    <li class="flex gap-3">
                      <UIcon name="i-lucide-check-circle-2" class="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                      <span>Control granular de roles para admin, manager, employee y client.</span>
                    </li>
                    <li class="flex gap-3">
                      <UIcon name="i-lucide-check-circle-2" class="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                      <span>Auditoria forense automatica para decisiones y trazabilidad.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </section>
</template>
