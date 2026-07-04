<script setup lang="ts">
interface GalleryItem {
  url: string;
  title: string;
}

const props = defineProps<{
  items: GalleryItem[];
  open: boolean;
  initialIndex?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const currentIndex = ref(props.initialIndex ?? 0);

const currentItem = computed(() => props.items[currentIndex.value] ?? null);

const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.items.length - 1);

const goPrev = () => {
  if (hasPrev.value) currentIndex.value--;
};

const goNext = () => {
  if (hasNext.value) currentIndex.value++;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") emit("close");
  if (e.key === "ArrowLeft") goPrev();
  if (e.key === "ArrowRight") goNext();
};

watch(
  () => props.open,
  (val) => {
    if (val) {
      currentIndex.value = props.initialIndex ?? 0;
      window.addEventListener("keydown", handleKeydown);
    } else {
      window.removeEventListener("keydown", handleKeydown);
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && items.length"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <button
        class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        @click="emit('close')"
      >
        <UIcon name="i-lucide-x" class="h-5 w-5" />
      </button>

      <button
        v-if="hasPrev"
        class="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
        @click="goPrev"
      >
        <UIcon name="i-lucide-chevron-left" class="h-6 w-6" />
      </button>

      <button
        v-if="hasNext"
        class="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
        @click="goNext"
      >
        <UIcon name="i-lucide-chevron-right" class="h-6 w-6" />
      </button>

      <div class="flex max-h-[85vh] max-w-4xl flex-col items-center">
        <img
          v-if="currentItem"
          :src="currentItem.url"
          :alt="currentItem.title"
          class="max-h-[75vh] w-auto rounded-xl object-contain shadow-2xl"
        />
        <p v-if="currentItem" class="mt-4 text-sm text-white/70">{{ currentItem.title }}</p>
        <p v-if="items.length > 1" class="mt-2 text-xs text-white/40">
          {{ currentIndex + 1 }} / {{ items.length }}
        </p>
      </div>

      <div v-if="items.length > 1" class="absolute bottom-6 flex gap-2">
        <button
          v-for="(_, idx) in items"
          :key="idx"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="idx === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'"
          @click="currentIndex = idx"
        />
      </div>
    </div>
  </Teleport>
</template>
