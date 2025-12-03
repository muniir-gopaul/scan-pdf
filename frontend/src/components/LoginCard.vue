<template>
  <q-card class="q-pa-lg" style="min-width: 350px">
    <q-card-section>
      <div class="text-h6 text-center">Login</div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-form @submit.prevent="onSubmit" class="q-gutter-md">
        <q-input filled v-model="companyDB" label="Company Database" dense autofocus />

        <q-input filled v-model="username" label="Username" dense />

        <q-input filled v-model="password" label="Password" type="password" dense />

        <div v-if="error" class="text-negative text-center q-mb-sm">
          {{ error }}
        </div>

        <div class="row justify-center">
          <q-btn label="Login" type="submit" color="primary" :loading="loading" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

const companyDB = ref('')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const router = useRouter()
const $q = useQuasar()

async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    const res = await axios.post('http://localhost:9000/api/auth/login', {
      CompanyDB: companyDB.value,
      UserName: username.value,
      Password: password.value,
    })

    if (!res.data.success) {
      error.value = res.data.message
      loading.value = false
      return
    }

    // ✅ Store SAP session securely
    localStorage.setItem('sapSession', res.data.sessionId)
    localStorage.setItem('sapCookies', JSON.stringify(res.data.cookies))

    $q.notify({
      type: 'positive',
      message: 'Login Successful',
    })

    router.push('/') // ✅ protected page
  } catch (err) {
    error.value = err.response?.data?.message || 'Connection failed'
  } finally {
    loading.value = false
  }
}
</script>
