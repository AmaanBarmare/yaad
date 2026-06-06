import axios from 'axios'

// Single Axios instance for all backend calls.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

export const getCustomers = () => client.get('/customers').then((r) => r.data)

export const getCustomer = (id) =>
  client.get(`/customers/${id}`).then((r) => r.data)

export const simulatePayment = () =>
  client.post('/billing/simulate-payment').then((r) => r.data)

export const detectItems = (imageBase64, txnId) =>
  client
    .post('/billing/detect-items', { image_base64: imageBase64, txn_id: txnId })
    .then((r) => r.data)

export const confirmTransaction = (payload) =>
  client.post('/billing/confirm', payload).then((r) => r.data)

export const getDueReminders = () =>
  client.get('/reminders/due').then((r) => r.data)

export const getReminderHistory = () =>
  client.get('/reminders/history').then((r) => r.data)

export default client
