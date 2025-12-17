import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { Notify } from 'quasar'
import { logout } from 'src/services/auth'

let isLoggingOut = false

// 🔑 EXPORT a shared instance (non-breaking)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
})

export default boot(() => {
  /* ------------------------------------------------------
     REQUEST INTERCEPTOR
  ------------------------------------------------------ */
  api.interceptors.request.use((config) => {
    const sapCookies = localStorage.getItem('sapCookies')

    if (sapCookies) {
      config.headers['sap-cookies'] = sapCookies
    }

    return config
  })

  /* ------------------------------------------------------
     RESPONSE INTERCEPTOR
  ------------------------------------------------------ */
  api.interceptors.response.use(
    (response) => response,

    (error) => {
      const status = error.response?.status
      const data = error.response?.data
      const url = error.config?.url || ''

      // 🚫 Ignore login endpoint
      if (url.includes('/api/auth/login')) {
        return Promise.reject(error)
      }

      const sessionExpired =
        status === 401 ||
        status === 403 ||
        data?.code === 301 ||
        data?.message?.toLowerCase().includes('session')

      if (sessionExpired && !isLoggingOut) {
        isLoggingOut = true

        Notify.create({
          type: 'warning',
          message: 'Session expired. Please login again.',
          timeout: 3000,
        })

        // ⏳ allow notify to render before redirect
        setTimeout(() => {
          logout('session_expired')
          isLoggingOut = false
        }, 500)
      }

      return Promise.reject(error)
    },
  )
})
