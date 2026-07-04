<script setup lang="ts">
import type { PublicStorefrontResponse } from "@/types/storefront";
import StorefrontLoginModal from "@/components/client/StorefrontLoginModal.vue";

const props = defineProps<{
  storefront: PublicStorefrontResponse;
  slug: string;
  isClientReady?: boolean;
  customerName?: string;
}>();

const { user, profile, signOut } = useAuth();

const showLoginModal = ref(false);

const isLoggedIn = computed(() => !!user.value);
const canOpenClientArea = computed(() => isLoggedIn.value && props.isClientReady === true);

const userName = computed(() => {
  return props.customerName?.trim() || (profile.value?.full_name ?? user.value?.email ?? "Cliente");
});

const design = computed(() => props.storefront.template.design);

const headerStyle = computed(() => ({
  fontFamily: design.value.bodyFont,
  borderColor: `${props.storefront.settings.primaryColor}20`,
}));

const brandStyle = computed(() => ({
  fontFamily: design.value.headingFont,
}));

const handleLogout = async () => {
  await signOut({ redirectTo: `/${props.slug}` });
};

const handleLoginSuccess = () => {
  showLoginModal.value = false;
};

const handleLoginModalClose = () => {
  showLoginModal.value = false;
};
</script>

<template>
  <header class="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md transition-colors duration-500" :style="headerStyle">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <img
          v-if="storefront.organization.logoUrl"
          :src="storefront.organization.logoUrl"
          :alt="storefront.organization.name"
          class="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
        />
        <div
          v-else
          class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          :style="{ backgroundColor: storefront.settings.primaryColor }"
        >
          {{ storefront.organization.name.charAt(0).toUpperCase() }}
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-900" :style="brandStyle">{{ storefront.organization.name }}</p>
          <p class="text-[10px] leading-none text-slate-500">{{ storefront.template.label }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="canOpenClientArea"
          to="/client/dashboard"
          class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          :style="{ backgroundColor: storefront.settings.primaryColor }"
        >
          <span class="hidden sm:inline">{{ userName }}</span>
          <span class="text-xs opacity-80">Mi cuenta</span>
        </NuxtLink>

        <button
          v-else-if="!isLoggedIn"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          :style="{ backgroundColor: storefront.settings.primaryColor }"
          @click="showLoginModal = true"
        >
          <UIcon name="i-lucide-user" class="h-4 w-4" />
          <span>Ingresar</span>
        </button>

        <button
          v-else
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          :style="{ backgroundColor: storefront.settings.primaryColor }"
          @click="handleLogout"
        >
          <span>Cambiar cuenta</span>
        </button>

        <UButton
          v-if="isLoggedIn"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-log-out"
          class="text-slate-500 hover:text-red-600"
          title="Cerrar sesion"
          @click="handleLogout"
        />
      </div>
    </div>

    <StorefrontLoginModal
      :open="showLoginModal"
      :slug="slug"
      :primary-color="storefront.settings.primaryColor"
      :business-name="storefront.organization.name"
      @close="handleLoginModalClose"
      @login-success="handleLoginSuccess"
    />
  </header>
</template>
