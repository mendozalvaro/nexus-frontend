<script setup lang="ts">
definePageMeta({
  layout: false,
  title: "Test Conexion",
});

const supabase = useSupabaseClient()

const connectionStatus = ref<'checking' | 'connected' | 'error'>('checking')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
    try {
        const { error } = await supabase.from('subscription_plan').select('*')

        if (error) throw error

        connectionStatus.value = 'connected'
    } catch (err: unknown) {
        connectionStatus.value = 'error'
        errorMessage.value = err instanceof Error ? err.message : 'Unknown error'
    }
})
</script>

<template>
    <div class="min-h-screen flex items-center justify-center">
        <UCard class="w-full max-w-md">
            <h1 class="text-2xl font-bold mb-4">Prueba de Conexión Supabase</h1>

            <div v-if="connectionStatus === 'checking'" class="text-yellow-600">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
                Conectando...
            </div>

            <div v-else-if="connectionStatus === 'connected'" class="text-green-600">
                <UIcon name="i-heroicons-check-circle" />
                ✅ Conexión exitosa
                <p class="text-sm mt-2">La DB está respondiendo correctamente</p>
            </div>

            <div v-else class="text-red-600">
                <UIcon name="i-heroicons-x-circle" />
                ❌ Error de conexión
                <p class="text-sm mt-2">{{ errorMessage }}</p>
            </div>

            <UButton to="/" class="mt-4">Volver al inicio</UButton>
        </UCard>
    </div>
</template>
