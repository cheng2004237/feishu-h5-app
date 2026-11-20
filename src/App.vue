<script setup>
import { useRoute } from 'vue-router'
import AppIcon from './components/AppIcon.vue'

const route = useRoute()

const tabs = [
  { path: '/', icon: 'edit', label: '今日记录' },
  { path: '/history', icon: 'calendar', label: '成长日历' },
  { path: '/stats', icon: 'chart', label: '数据复盘' },
]
</script>

<template>
  <router-view />

  <nav class="tab-bar" aria-label="主导航">
    <div class="tab-bar-inner">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab-item"
        :class="{ active: route.path === tab.path }"
        :aria-current="route.path === tab.path ? 'page' : undefined"
      >
        <AppIcon :name="tab.icon" :size="22" :stroke-width="route.path === tab.path ? 2.3 : 1.9" />
        <span class="tab-label">{{ tab.label }}</span>
      </router-link>
    </div>
  </nav>
</template>
