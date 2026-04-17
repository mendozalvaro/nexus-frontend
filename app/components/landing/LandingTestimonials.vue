<script setup lang="ts">
import type { LandingTestimonial } from "../../composables/useLanding"

const props = defineProps<{
  items: readonly LandingTestimonial[]
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
    const entry = entries[0]
    if (entry && entry.isIntersecting) {
      isVisible.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.2 })

  observer.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <section
    id="testimonials"
    ref="sectionRef"
    class="landing-section landing-section-muted"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="landing-section-heading">
        <p class="landing-section-kicker">Prueba social</p>
        <h2 class="landing-section-title">
          Empresas que confian en NexusPOS
        </h2>
        <p class="landing-section-copy">
          Equipos que necesitaban ordenar agenda, ventas, inventario y control operativo en un solo lugar.
        </p>
      </div>

      <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="(item, index) in props.items"
          :key="`${item.name}-${item.company}`"
          class="landing-card landing-reveal p-6"
          :class="isVisible ? 'landing-reveal-visible' : ''"
          :style="{ transitionDelay: `${index * 60}ms` }"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="landing-avatar">
                {{ item.initials }}
              </div>
              <div>
                <p class="font-semibold text-slate-950 dark:text-white">
                  {{ item.name }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ item.role }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1 text-amber-400">
              <UIcon
                v-for="star in 5"
                :key="star"
                name="i-lucide-star"
                class="h-4 w-4 fill-current"
              />
            </div>
          </div>

          <p class="mt-5 text-base leading-8 text-slate-700 dark:text-slate-200">
            "{{ item.quote }}"
          </p>

          <p class="mt-6 text-sm font-medium text-primary-700 dark:text-primary-300">
            {{ item.company }}
          </p>
        </UCard>
      </div>
    </div>
  </section>
</template>
