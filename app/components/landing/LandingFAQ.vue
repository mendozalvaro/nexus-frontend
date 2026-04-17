<script setup lang="ts">
import type { LandingFAQItem } from "../../composables/useLanding"

const props = defineProps<{
  items: readonly LandingFAQItem[]
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

const accordionItems = computed(() => props.items.map(item => ({
  label: item.label,
  content: item.content,
  icon: item.icon,
})))
</script>

<template>
  <section
    id="faq"
    ref="sectionRef"
    class="landing-section"
  >
    <div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
      <div class="landing-section-heading lg:mx-0 lg:max-w-none lg:text-left">
        <p class="landing-section-kicker">Preguntas frecuentes</p>
        <h2 class="landing-section-title">
          Lo que necesitas saber antes de comenzar
        </h2>
        <p class="landing-section-copy">
          Respuestas claras sobre prueba gratuita, seguridad, facturacion y escalabilidad para que tomes la decision con contexto completo.
        </p>
      </div>

      <UCard
        class="landing-card landing-reveal overflow-hidden p-2 sm:p-3"
        :class="isVisible ? 'landing-reveal-visible' : ''"
      >
        <UAccordion
          :items="accordionItems"
          color="neutral"
          variant="ghost"
          size="lg"
        />
      </UCard>
    </div>
  </section>
</template>
