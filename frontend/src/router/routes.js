const routes = [
  // ✅ ROOT ROUTE (FIXES YOUR 404)
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/LoginPage.vue'), // default landing page
      },
    ],
  },

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

  // ✅ MUST ALWAYS BE LAST
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
