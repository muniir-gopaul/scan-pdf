const routes = [
  // ✅ LOGIN PAGE (PUBLIC)
  {
    path: '/login',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LoginPage.vue') }],
  },

  // ✅ PROTECTED PARSER PAGE (AFTER LOGIN)
  {
    path: '/parser',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true }, // ✅ PROTECTED
    children: [{ path: '', component: () => import('pages/ParserPage.vue') }],
  },

  // ✅ DEFAULT ROOT REDIRECTS TO LOGIN
  {
    path: '/',
    redirect: '/login',
  },

  // ✅ MUST ALWAYS BE LAST
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
