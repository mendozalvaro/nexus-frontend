<script setup lang="ts">
import type { LandingFeatureItem } from "../../composables/useLanding"

const props = defineProps<{
  items: readonly LandingFeatureItem[]
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
    id="features"
    ref="sectionRef"
    class="landing-section"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="landing-section-heading">
        <p class="landing-section-kicker">Todo conectado</p>
        <h2 class="landing-section-title">
          Todo lo que necesitas para gestionar tu negocio
        </h2>
        <p class="landing-section-copy">
          Disenado para operaciones hibridas que venden, atienden, coordinan equipos y necesitan una vista clara para crecer sin perder control.
        </p>
      </div>

      <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="(item, index) in props.items"
          :key="item.title"
          class="landing-card landing-reveal p-6"
          :class="isVisible ? 'landing-reveal-visible' : ''"
          :style="{ transitionDelay: `${index * 70}ms` }"
        >
          <div class="landing-feature-icon">
            <UIcon :name="item.icon" class="h-6 w-6" />
          </div>
          <h3 class="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
            {{ item.title }}
          </h3>
          <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            {{ item.description }}
          </p>
        </UCard>
      </div>
    </div>
  </section>
</template>
