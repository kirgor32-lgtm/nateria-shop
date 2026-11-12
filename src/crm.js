// Связь сайта с CRM: заказы, заявки и события для аналитики.
// Пока api пустой — ничего не отправляется, сайт работает как раньше (демо).
// Когда CRM будет на сервере: впишите её адрес и ключ сайта из «CRM → Настройки → Марки и сайты».
import { contactTopics } from './data.js'

export const crmConfig = {
  api: import.meta.env.VITE_CRM_API || '', // например 'https://crm.nateria-spb.ru'
  key: import.meta.env.VITE_CRM_KEY || '', // ключ сайта вида pk_...
}

export const crmEnabled = !!(crmConfig.api && crmConfig.key)
const PENDING = 'hv-crm-pending' // заказы и заявки, которые не удалось отправить, — повторим при следующем заходе

let ready = null
function load() {
  if (!crmEnabled || typeof window === 'undefined') return Promise.resolve(null)
  if (!ready) {
    ready = new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = crmConfig.api.replace(/\/$/, '') + '/tracker.js'
      s.dataset.key = crmConfig.key
      s.dataset.autotrack = '0' // аналитика — только после согласия в баннере cookie
      s.async = true
      s.onload = () => resolve(window.crm || null)
      s.onerror = () => resolve(null)
      document.head.appendChild(s)
    })
  }
  return ready
}

const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING)) || [] } catch { return [] } }
const writePending = (list) => { try { localStorage.setItem(PENDING, JSON.stringify(list.slice(-20))) } catch { /* пусто */ } }

async function deliver(kind, payload) {
  const crm = await load()
  if (!crm) throw new Error('CRM недоступна')
  return kind === 'order' ? crm.order(payload) : crm.lead(payload)
}
async function sendOrQueue(kind, payload) {
  try { await deliver(kind, payload) } catch (e) {
    // повторяем только если CRM была недоступна; заказ, который CRM отклонила (4xx), повторять бессмысленно
    if (!e?.status || e.status >= 500 || e.status === 429) writePending([...readPending(), { kind, payload }])
  }
}

// Согласие на аналитические cookie: баннер сохраняет { v: 'all' | 'necessary' } в hv-cookies
const analyticsAllowed = () => { try { return JSON.parse(localStorage.getItem('hv-cookies'))?.v === 'all' } catch { return false } }

export function initCrm() {
  if (!crmEnabled) return
  const start = () => { if (analyticsAllowed()) load().then((crm) => crm?.startTracking()) }
  window.addEventListener('hv-consent', start)
  start()
  if (!readPending().length) return
  load().then(async (crm) => {
    if (!crm) return
    const list = readPending()
    if (!list.length) return
    writePending([])
    for (const it of list) await sendOrQueue(it.kind, it.payload)
  })
}

export const track = (type, data) => { if (crmEnabled && analyticsAllowed()) load().then((crm) => crm?.track(type, data)) }

// Проверка промокода в CRM. null — CRM не подключена или недоступна (тогда сайт проверяет сам)
export async function checkPromo(code, phone = '') {
  if (!crmEnabled) return null
  const crm = await load()
  if (!crm?.promo) return null
  try { return await crm.promo(code, phone) } catch { return null }
}

export function sendOrder(o) {
  if (!crmEnabled) return
  sendOrQueue('order', {
    number: o.n,
    paid: !!o.paid, // оплачен онлайн → в CRM сразу «Подтверждён»
    items: o.items.map((i) => ({ id: i.id, name: `${i.line} — ${i.name}`, w: i.w, qty: i.qty, price: i.price })),
    discount: o.discount || 0,
    promo: o.promo || '',
    contact: { name: o.contact.name, phone: o.contact.phone, delivery: o.contact.delivery || '' },
  })
}

export function sendLead(l) {
  if (!crmEnabled) return
  const topic = contactTopics.find((t) => t.id === l.topic)?.label || l.topic || '' // в CRM — «Подобрать корм», а не «pick»
  sendOrQueue('lead', { name: l.name, phone: l.phone, topic, msg: l.msg || '' })
}

// Статус заказа для «Мои заказы» в личном кабинете — подтягивается из CRM,
// меняется автоматически, когда менеджер двигает карточку заказа по этапам
// в канбане CRM. null — CRM не подключена/недоступна (бейдж останется как был).
export async function fetchOrderStatus(number, phone) {
  if (!crmEnabled) return null
  const crm = await load()
  if (!crm?.orderStatus) return null
  try { return await crm.orderStatus(number, phone) } catch { return null }
}
