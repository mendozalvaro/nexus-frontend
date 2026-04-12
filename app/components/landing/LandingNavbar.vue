<script setup lang="ts">
import type { LandingNavigationItem } from "../../composables/useLanding"

const props = defineProps<{
  isScrolled: boolean
  navigation: readonly LandingNavigationItem[]
}>()

const { colorMode, toggleTheme, scrollToSection, goToTop, navigateToAuth } = useLanding()
const isMobileMenuOpen = ref(false)

const themeIcon = computed(() => colorMode.value === "dark" ? "i-lucide-sun-medium" : "i-lucide-moon-star")

const handleNavigation = (id: string) => {
  scrollToSection(id)
  isMobileMenuOpen.value = false
}

watch(isMobileMenuOpen, (isOpen) => {
  if (!import.meta.client) {
    return
  }

  document.body.classList.toggle("overflow-hidden", isOpen)
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }

  document.body.classList.remove("overflow-hidden")
})
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b transition-all duration-300"
    :class="props.isScrolled
      ? 'border-white/60 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/78'
      : 'border-transparent bg-transparent'"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
      <button
        type="button"
        class="landing-logo-group admin-focus-ring"
        aria-label="Volver al inicio"
        @click="goToTop"
      >
        <span class="nexus-logo-shell flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg shadow-primary-500/20">
          NP
        </span>
        <span class="min-w-0 text-left">
          <span class="block text-sm font-semibold text-slate-950 dark:text-white">NexusPOS</span>
          <span class="block text-xs text-slate-600 dark:text-slate-300">Gestion unificada para negocios hibridos</span>
        </span>
      </button>

      <nav class="hidden items-center gap-2 md:flex">
        <button
          v-for="item in props.navigation"
          :key="item.id"
          type="button"
          class="landing-nav-link admin-focus-ring"
          @click="handleNavigation(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="hidden items-center gap-2 md:flex">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-in"
          class="rounded-full"
          @click="navigateToAuth('/auth/login')"
        >
          Iniciar Sesion
        </UButton>
        <UButton
          color="primary"
          trailing-icon="i-lucide-arrow-right"
          class="rounded-full"
          @click="navigateToAuth('/auth/register')"
        >
          Prueba Gratis
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          :icon="themeIcon"
          class="rounded-full"
          aria-label="Cambiar tema"
          @click="toggleTheme"
        />
      </div>

      <div class="flex items-center gap-2 md:hidden">
        <UButton
          color="neutral"
          variant="ghost"
          :icon="themeIcon"
          class="rounded-full"
          aria-label="Cambiar tema"
          @click="toggleTheme"
        />
        <UButton
          color="neutral"
          variant="ghost"
          :icon="isMobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          class="rounded-full"
          :aria-label="isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="border-t border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/96 md:hidden"
      >
        <div class="space-y-2">
          <button
            v-for="item in props.navigation"
            :key="item.id"
            type="button"
            class="landing-mobile-link admin-focus-ring"
            @click="handleNavigation(item.id)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="mt-4 grid gap-2">
          <UButton
            color="neutral"
            variant="outline"
            block
            class="rounded-full"
            @click="navigateToAuth('/auth/login')"
          >
            Iniciar Sesion
          </UButton>
          <UButton
            color="primary"
            block
            trailing-icon="i-lucide-arrow-right"
            class="rounded-full"
            @click="navigateToAuth('/auth/register')"
          >
            Prueba Gratis
          </UButton>
        </div>
      </div>
    </Transition>
  </header>
</template>
