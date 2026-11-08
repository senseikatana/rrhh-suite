<script setup lang="ts">
onMounted(() => {
  document.documentElement.dataset.hydrated = 'true'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
