import { Notify } from 'quasar'
import { ref } from 'vue'

/**
 * 🔑 SINGLE SOURCE OF TRUTH
 * If SAP cookies exist → user is authenticated
 */
export function isAuthenticated() {
  return Boolean(localStorage.getItem('sapCookies'))
}

/**
 * 🔁 Reactive mirror (UI helpers only)
 */
export const isLoggedIn = ref(isAuthenticated())

/**
 * ✅ Called after successful login
 * Keeps state in sync — no side effects
 */
export function setLoggedIn(value) {
  isLoggedIn.value = Boolean(value)
}

/**
 * 🔒 Logout (manual or session-expired)
 */
export function logout(reason = 'manual') {
  console.warn('🔐 Logging out:', reason)

  // 🔥 Clear ALL auth state
  localStorage.removeItem('sapCookies')
  localStorage.removeItem('sapSession')
  localStorage.removeItem('username')

  // Sync reactive state
  isLoggedIn.value = false

  // UX feedback only for forced logout
  if (reason !== 'manual') {
    Notify.create({
      type: 'warning',
      message: 'Session expired. Please login again.',
    })
  }

  // 🔁 HARD redirect (prevents back navigation)
  window.location.replace('/login')
}
