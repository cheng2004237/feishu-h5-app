<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 2 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'edit'">
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </template>

    <template v-else-if="name === 'calendar'">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </template>

    <template v-else-if="name === 'chart'">
      <path d="M4 20h16" />
      <rect x="5" y="12" width="3.5" height="8" rx="1" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
      <rect x="15.5" y="4" width="3.5" height="16" rx="1" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>

    <template v-else-if="name === 'minus'">
      <path d="M5 12h14" />
    </template>

    <template v-else-if="name === 'flame'">
      <path d="M12 3c.6 3.8-3 5.5-3 9.2a4.5 4.5 0 0 0 9 0c0-3.3-2.3-5.2-2.5-8.2 0 0-1 2.2-2 2.2S12 3 12 3z" />
    </template>

    <template v-else-if="name === 'spark'">
      <path d="M12 3l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.2 6.8 19l1-5.8-4.3-4.1 5.9-.8L12 3z" />
    </template>

    <template v-else-if="name === 'utensils'">
      <path d="M4 3v7a3 3 0 0 0 3 3v8M7 3v7M10 3v7M17 3v18M17 3a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3" />
    </template>

    <template v-else-if="name === 'bag'">
      <path d="M6 8h12l1 12H5L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </template>

    <template v-else-if="name === 'run'">
      <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" />
    </template>

    <template v-else-if="name === 'timer'">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6M12 2v3" />
    </template>

    <template v-else-if="name === 'route'">
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H13a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h4.5" />
    </template>

    <template v-else-if="name === 'chevron-left'">
      <path d="M15 18l-6-6 6-6" />
    </template>

    <template v-else-if="name === 'chevron-right'">
      <path d="M9 6l6 6-6 6" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </template>

    <template v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </template>

    <template v-else-if="name === 'refresh'">
      <path d="M20 11a8 8 0 1 0 2 5.3" />
      <path d="M20 4v7h-7" />
    </template>

    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </template>

    <template v-else-if="name === 'sunrise'">
      <path d="M12 3v3M5.6 6.6l2.1 2.1M18.4 6.6l-2.1 2.1M3 16h18M7 16a5 5 0 0 1 10 0" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </template>
  </svg>
</template>
