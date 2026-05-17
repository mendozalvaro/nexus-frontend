<script setup lang="ts">
const props = defineProps<{
  avatarUrl: string | null;
  fullName: string;
  size?: "sm" | "md" | "lg";
}>();

const emit = defineEmits<{
  update: [url: string];
}>();

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
};

const initials = computed(() => {
  if (!props.fullName) return "?";
  return props.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
});

const showUrlInput = ref(false);
const urlInput = ref("");

const applyUrl = () => {
  if (urlInput.value.trim()) {
    emit("update", urlInput.value.trim());
  }
  showUrlInput.value = false;
  urlInput.value = "";
};

const cancelUrlInput = () => {
  showUrlInput.value = false;
  urlInput.value = "";
};
</script>

<template>
  <div class="flex items-center gap-4">
    <div
      :class="[sizeClasses[size ?? 'md'], 'relative flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300']"
    >
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        :alt="fullName"
        class="absolute inset-0 h-full w-full rounded-full object-cover"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <span v-else>{{ initials }}</span>
    </div>

    <div class="flex-1">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ fullName }}</p>
      <UButton
        v-if="!showUrlInput"
        variant="ghost"
        size="xs"
        color="primary"
        class="mt-1"
        @click="showUrlInput = true"
      >
        Cambiar avatar
      </UButton>

      <div v-else class="mt-2 flex gap-2">
        <UInput
          v-model="urlInput"
          type="url"
          placeholder="https://ejemplo.com/avatar.jpg"
          size="sm"
          class="flex-1"
          @keyup.enter="applyUrl"
        />
        <UButton size="sm" color="primary" @click="applyUrl">OK</UButton>
        <UButton size="sm" variant="ghost" @click="cancelUrlInput">Cancelar</UButton>
      </div>
    </div>
  </div>
</template>
