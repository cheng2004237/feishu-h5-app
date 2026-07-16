import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '今日记录' },
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { title: '历史记录' },
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('../views/Stats.vue'),
    meta: { title: '积分统计' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '程怿一积分'}`
  next()
})

export default router
