<template>
  <q-card class="q-pa-lg" style="min-width: 350px">
    <q-card-section>
      <div class="text-h6 text-center">Login</div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-form @submit.prevent="onSubmit" class="q-gutter-md">
        <!-- COMPANY DATABASE -->
        <q-select
          filled
          v-model="companyDB"
          :options="companyOptions"
          label="Company Database"
          dense
          emit-value
          map-options
          :loading="loadingCompanies"
          :disable="loadingCompanies"
          autofocus
        />

        <!-- USERNAME -->
        <q-input filled v-model="username" label="Username" dense />

        <!-- PASSWORD -->
        <q-input filled v-model="password" label="Password" type="password" dense />

        <!-- ERROR -->
        <div v-if="error" class="text-negative text-center q-mb-sm">
          {{ error }}
        </div>

        <!-- SUBMIT -->
        <div class="row justify-center">
          <q-btn label="Login" type="submit" color="primary" :loading="loading" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'
import { setLoggedIn } from 'src/services/auth'

const companyDB = ref('')
const companyOptions = ref([])
const loadingCompanies = ref(false)

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const router = useRouter()
const $q = useQuasar()

/* ================== LOAD COMPANY LIST (PUBLIC) ================== */
onMounted(async () => {
  loadingCompanies.value = true

  try {
    const res = await api.get('/api/company/company-dbs')

    companyOptions.value = (res.data.rows || []).map((c) => ({
      label: c.Company,
      value: c.CompanyDB,
    }))

    if (companyOptions.value.length === 1) {
      companyDB.value = companyOptions.value[0].value
    }
  } catch (err) {
    console.error('❌ Failed loading company DB list:', err)

    $q.notify({
      type: 'negative',
      message: 'Unable to load company list',
    })
  } finally {
    loadingCompanies.value = false
  }
})

/* ================== LOGIN (PUBLIC) ================== */
async function onSubmit() {
  error.value = ''
  loading.value = true

  try {
    const res = await api.post('/api/auth/login', {
      CompanyDB: companyDB.value,
      UserName: username.value,
      Password: password.value,
    })

    if (!res.data.success) {
      error.value = res.data.message || 'Login failed'
      return
    }

    const { cookies, sessionId } = res.data

    if (!cookies?.B1SESSION || !cookies?.ROUTEID) {
      throw new Error('Invalid SAP login response (missing cookies)')
    }

    // 🔑 THIS IS THE AUTH SOURCE OF TRUTH
    const sapCookieString = `${cookies.B1SESSION}; ${cookies.ROUTEID}`

    // 🔐 STORE AUTH
    localStorage.setItem('sapCookies', sapCookieString)
    localStorage.setItem('sapSession', sessionId)
    localStorage.setItem('username', username.value)

    // 🔄 SYNC AUTH STATE
    setLoggedIn(true)

    $q.notify({
      type: 'positive',
      message: 'Login Successful',
    })

    // 🚀 ROUTE
    router.push('/parser')
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err)
    error.value = err.response?.data?.message || err.message || 'Unable to login'
  } finally {
    loading.value = false
  }
}
</script>
