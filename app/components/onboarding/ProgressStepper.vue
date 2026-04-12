<script setup lang="ts">

const props = defineProps<{
  currentStep: OnboardingStep;
}>();

const items = [
  { key: "registration", label: "Registro", description: "Crea tu acceso inicial." },
  { key: "verification", label: "Verificacion", description: "Confirma tu email." },
  { key: "organization", label: "Organizacion", description: "Configura tu empresa." },
  { key: "payment", label: "Pago", description: "Sube tu comprobante." },
] as const;

const currentIndex = computed(() => items.findIndex((item) => item.key === props.currentStep));
</script>

<template>
  <nav aria-label="Progreso del onboarding"
    class="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/65">
    <ol class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <li v-for="(item, index) in items" :key="item.key" class="rounded-[1.5rem] border p-3 transition-colors"
        :class="index <= currentIndex ? 'border-primary-200 bg-primary-50/90 dark:border-primary-900/70 dark:bg-primary-950/30' : 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/65'">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold"
            :class="index < currentIndex ? 'bg-emerald-500 text-white' : index === currentIndex ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'">
            <UIcon v-if="index < currentIndex" name="i-lucide-check" class="h-4 w-4" />
            <span v-else>{{ index + 1 }}</span>
          </div>

          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-950 dark:text-white">{{ item.label }}</p>
            <p class="text-sm leading-5 text-slate-600 dark:text-slate-300">{{ item.description }}</p>
          </div>
        </div>
      </li>
    </ol>
  </nav>
</template>
