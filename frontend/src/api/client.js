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

/**
 * Generate a reminder for a customer, streaming progress via SSE.
 * Calls onEvent(eventName, data) for each of: generating_message,
 * synthesising_audio, ready, error.
 */
export async function generateReminder(customerId, onEvent) {
  const res = await fetch(`${API_BASE}/reminders/generate/${customerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok || !res.body) {
    throw new Error(`Reminder request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // Parse the text/event-stream chunk by chunk.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() || '' // keep the trailing partial frame
    for (const frame of frames) {
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data))
        } catch {
          /* ignore keep-alive / non-JSON frames */
        }
      }
    }
  }
}

export default client
