import { Notify } from 'quasar'
import { ref } from 'vue'
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
  window.location.replace('/login')
}

export const isLoggedIn = ref(!!localStorage.getItem('sapCookies'))

export function setLoggedIn(value) {
  isLoggedIn.value = value
}
