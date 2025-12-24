<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="header text-white">
      <q-toolbar class="q-px-lg">
        <q-toolbar-title class="text-weight-bold"
          ><q-icon name="document_scanner" size="28px" /> SCAN PDF APPLICATION
        </q-toolbar-title>

        <div class="row items-center q-gutter-md">
          <!-- 🔐 Logout button (only when authenticated + protected route) -->
          <q-btn
            v-if="showLogout"
            right="logout"
            dense
            icon="logout"
            size="12px"
            label="Logout"
            @click="onLogout"
            class="q-mr-md btn-logout"
            text-color="grey-8"
            color="white"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { logout, isLoggedIn } from 'src/services/auth'

const route = useRoute()

const showLogout = computed(() => {
  return isLoggedIn.value && route.meta?.requiresAuth
})

function onLogout() {
  logout('manual')
}
</script>
