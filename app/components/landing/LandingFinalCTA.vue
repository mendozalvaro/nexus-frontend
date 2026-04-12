<script setup lang="ts">
const { navigateToAuth } = useLanding()
</script>

<template>
  <section class="landing-section pt-0">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="landing-final-cta">
        <div class="landing-final-cta-orb" aria-hidden="true" />
        <div class="relative z-10 mx-auto max-w-3xl text-center">
          <p class="landing-final-kicker">Prueba gratuita</p>
          <h2 class="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            ¿Listo para transformar tu negocio?
          </h2>
          <p class="mt-5 text-base leading-8 text-primary-100 sm:text-lg">
            Únete a cientos de empresas que ya gestionan agenda, ventas, inventario y operación desde una sola plataforma.
          </p>
          <div class="mt-8">
            <UButton
              color="neutral"
              size="xl"
              class="rounded-full bg-white px-7 text-slate-950 hover:bg-slate-100"
              trailing-icon="i-lucide-arrow-right"
              @click="navigateToAuth('/auth/register')"
            >
              Comenzar Gratis Ahora
            </UButton>
          </div>
          <p class="mt-4 text-sm font-medium text-primary-100/90">
            14 días de prueba · Sin tarjeta · Cancela cuando quieras
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
