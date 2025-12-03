const routes = [
  {
    path: '/login',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LoginPage.vue') }],
  },

  {
    path: '/parser',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true }, // ✅ PROTECTED
    children: [{ path: '', component: () => import('pages/ParserPage.vue') }],
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
