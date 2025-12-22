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

      // 🚫 IGNORE PUBLIC / BACKEND-ONLY ROUTES
      const ignoreLogoutRoutes = [
        '/api/auth/login',
        '/api/extract',
        '/api/pdf',
        '/api/company',
        '/api/customers',
      ]

      if (ignoreLogoutRoutes.some((p) => url.includes(p))) {
        return Promise.reject(error)
      }

      // 🔐 ONLY SAP-RELATED SESSION EXPIRY
      const isSapSessionExpired =
        status === 401 ||
        status === 403 ||
        (data?.code === 301 && url.includes('/api/sap')) ||
        (typeof data?.message === 'string' &&
          data.message.toLowerCase().includes('session') &&
          url.includes('/api/sap'))

      if (isSapSessionExpired && !isLoggingOut) {
        isLoggingOut = true

        Notify.create({
          type: 'warning',
          message: 'Session expired. Please login again.',
          timeout: 3000,
        })

        setTimeout(() => {
          logout('session_expired')
          isLoggingOut = false
        }, 500)
      }

      return Promise.reject(error)
    },
  )
})
