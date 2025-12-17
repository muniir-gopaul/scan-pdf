import { Notify } from 'quasar'
import router from 'src/router'

export function isAuthenticated() {
  return !!localStorage.getItem('sapCookies')
}

export function logout(reason = 'manual') {
  console.warn('🔐 Logging out:', reason)

  // 🔥 Clear ALL auth state
  localStorage.removeItem('sapCookies')
  localStorage.removeItem('sapSession')
  localStorage.removeItem('username')

  // Optional: clear everything if you want hard reset
  // localStorage.clear()

  // UX feedback
  if (reason !== 'manual') {
    Notify.create({
      type: 'warning',
      message: 'Session expired. Please login again.',
    })
  }

  // 🔁 HARD redirect (prevents back navigation)
  router.replace('/login')
}
