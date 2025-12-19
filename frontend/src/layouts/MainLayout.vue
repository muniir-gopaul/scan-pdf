<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> SCAN PDF APPLICATION </q-toolbar-title>

        <div class="row items-center q-gutter-md">
          <!-- 🔐 Logout button (only when authenticated + protected route) -->
          <q-btn
            v-if="showLogout"
            icon-right="logout"
            size="md"
            dense
            icon-size="10px"
            label="Logout"
            @click="onLogout"
            class="rounded-borders q-mr-md"
            color="white"
            text-color="grey-8"
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
