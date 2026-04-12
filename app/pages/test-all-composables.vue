<script setup lang="ts">
definePageMeta({
  layout: false,
  title: "Test Composables",
});

const { user, profile, hasRole } = useAuth()
const { capabilities, isFeatureEnabled, canCreateResource } = useSubscription()
const { logAction, getAuditStats } = useForensic()

const testSubscription = async () => {
    console.log('Plan:', capabilities.value?.planName)
    console.log('Can create branch:', canCreateResource('branch'))
    console.log('Forensic enabled:', isFeatureEnabled('hasForensicExport'))
}

const testForensic = async () => {
    await logAction('test_table', 'CUSTOM', 'test-123', { test: 'data' })
    const stats = await getAuditStats()
    console.log('Audit stats:', stats)
}
</script>

<template>
    <div class="p-8">
        <h1 class="text-2xl font-bold mb-4">Test Todos los Composables</h1>

        <UCard class="mb-4">
            <template #header>Auth</template>
            <p v-if="user">👤 {{ profile?.full_name }} ({{ profile?.role }})</p>
            <p v-else>❌ No autenticado</p>
        </UCard>

        <UCard class="mb-4">
            <template #header>Subscription</template>
            <p>Plan: {{ capabilities?.planName }}</p>
            <UButton @click="testSubscription" class="mt-2">Verificar Plan</UButton>
        </UCard>

        <UCard>
            <template #header>Forensic</template>
            <UButton @click="testForensic" :disabled="!hasRole(['admin'])">
                Test Auditoría (solo admin)
            </UButton>
        </UCard>
    </div>
</template>
