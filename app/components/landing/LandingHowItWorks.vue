<script setup lang="ts">
import type { LandingStepItem } from "../../composables/useLanding"

const props = defineProps<{
  items: readonly LandingStepItem[]
}>()

const sectionRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!import.meta.client || !sectionRef.value) {
    isVisible.value = true
    return
  }

  observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      isVisible.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.25 })

  observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <section
    ref="sectionRef"
    class="landing-section landing-section-muted"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="landing-section-heading">
        <p class="landing-section-kicker">Como funciona</p>
        <h2 class="landing-section-title">
          Comienza en minutos, escala sin limites
        </h2>
        <p class="landing-section-copy">
          Desde la creacion de tu organizacion hasta la operacion diaria, el flujo esta pensado para que pongas en marcha tu negocio sin friccion.
        </p>
      </div>

      <div class="mt-12 grid gap-6 lg:grid-cols-3">
        <div
          v-for="(item, index) in props.items"
          :key="item.title"
          class="landing-step-card landing-reveal"
          :class="isVisible ? 'landing-reveal-visible' : ''"
          :style="{ transitionDelay: `${index * 110}ms` }"
        >
          <div class="flex items-center gap-4">
            <div class="landing-step-marker">
              <UIcon :name="item.icon" class="h-6 w-6" />
            </div>
            <div class="landing-step-connector" aria-hidden="true" />
          </div>

          <div class="landing-step-content">
            <p class="text-sm font-semibold uppercase tracking-[0.22em] text-primary-700 dark:text-primary-300">
              Paso {{ index + 1 }}
            </p>
            <h3 class="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
              {{ item.title }}
            </h3>
            <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {{ item.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
