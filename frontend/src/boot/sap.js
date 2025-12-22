import axios from 'axios'

export const sapApi = axios.create({
  baseURL: import.meta.env.VITE_SAP_CUSTOMER_API_URL, // 🔑 SAP Service Layer
  withCredentials: true, // 🔑 SAP uses cookies
  timeout: 20000,
})
