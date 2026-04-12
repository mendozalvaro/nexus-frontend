<script setup lang="ts">
import type { LandingFooterColumn, LandingFooterLink } from "../../composables/useLanding"

const props = defineProps<{
  columns: readonly LandingFooterColumn[]
}>()

const { goToTop, scrollToSection } = useLanding()

const isSectionLink = (link: LandingFooterLink) => typeof link.id === "string"
const isRouteLink = (link: LandingFooterLink) => typeof link.to === "string"
</script>

<template>
  <footer class="border-t border-slate-200/80 bg-white/75 py-14 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/70">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,0.8fr)]">
        <div class="max-w-sm">
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

          <p class="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Plataforma SaaS para negocios que venden productos, ofrecen servicios y gestionan citas desde una sola operación.
          </p>

          <div class="mt-6 flex items-center gap-2">
            <UButton color="neutral" variant="ghost" icon="i-lucide-linkedin" class="rounded-full" aria-label="LinkedIn" />
            <UButton color="neutral" variant="ghost" icon="i-lucide-instagram" class="rounded-full" aria-label="Instagram" />
            <UButton color="neutral" variant="ghost" icon="i-lucide-youtube" class="rounded-full" aria-label="YouTube" />
          </div>
        </div>

        <div
          v-for="column in props.columns"
          :key="column.title"
        >
          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            {{ column.title }}
          </p>
          <ul class="mt-4 space-y-3">
            <li
              v-for="link in column.links"
              :key="link.label"
            >
              <button
                v-if="isSectionLink(link)"
                type="button"
                class="landing-footer-link admin-focus-ring"
                @click="scrollToSection(link.id!)"
              >
                {{ link.label }}
              </button>
              <NuxtLink
                v-else-if="isRouteLink(link)"
                :to="link.to!"
                class="landing-footer-link"
              >
                {{ link.label }}
              </NuxtLink>
              <a
                v-else
                :href="link.href"
                class="landing-footer-link"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-12 flex flex-col gap-4 border-t border-slate-200/80 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 NexusPOS. Todos los derechos reservados.</p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <button type="button" class="landing-footer-link admin-focus-ring">
            ES / EN
          </button>
          <p>Hecho con cariño en Bolivia</p>
        </div>
      </div>
    </div>
  </footer>
</template>
