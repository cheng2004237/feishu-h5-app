<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { path: '/', icon: '📝', label: '记录' },
  { path: '/history', icon: '📅', label: '历史' },
  { path: '/stats', icon: '📊', label: '统计' },
]
</script>

<template>
  <router-view />

  <nav class="tab-bar">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab-item"
      :class="{ active: route.path === tab.path }"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>
