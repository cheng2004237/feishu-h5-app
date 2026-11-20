import { createApp } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import './style.css'
import App from './App.vue'
import router from './router'

// 全局统一配置中文 locale 与 ISO 周（周一为一周第一天）
dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const app = createApp(App)
app.use(router)
app.mount('#app')
