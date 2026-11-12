// Вход в личный кабинет по коду: защита от ботов и выбор канала доставки кода.
//
// Куда уходит код — по приоритету: Telegram → Max → смс.
// Как это будет работать с настоящим сервисом:
// 1. Браузер получает токен Яндекс SmartCaptcha (невидимая проверка, российский сервис)
//    и отправляет его на сервер вместе с номером: POST /api/auth/send-code { phone, captcha, via? }.
// 2. Сервер проверяет капчу и лимиты, затем ищет мессенджер:
//    - Telegram: Telegram Gateway API, метод checkSendAbility — по одному номеру видно, есть ли
//      у человека Telegram; если есть, код уходит официальным сообщением Telegram
//      (sendVerificationMessage, ~$0.01 за доставленный код; если Telegram нет — проверка бесплатна).
//    - Max: открытого способа «найти человека по номеру» у Max нет. Код можно отправить, только если
//      покупатель один раз поделился контактом с нашим ботом в Max — тогда номер есть в нашей базе.
//    - Ничего не нашли (или via: 'sms') — смс через подключённый смс-сервис.
// 3. Ответ сервера: { channel: 'telegram' | 'max' | 'sms', resendIn: 60 }.
// Пока сервера нет, всё ниже работает в демо-режиме прямо в браузере.
// Важно: проверки в браузере — первый барьер, обойти их можно. Настоящие лимиты
// и проверка капчи обязательно должны дублироваться на сервере.

import { crmConfig, crmEnabled } from './crm'

/* ---- связь с CRM: если она доступна, коды шлёт она (бот Telegram/Max или смс) ---- */
const AUTH = crmEnabled ? crmConfig.api.replace(/\/$/, '') + '/api/public/auth/' : ''
let live = null // null — ещё не проверяли; false — CRM недоступна, работает демо
async function post(path, body) {
  const r = await fetch(AUTH + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: crmConfig.key, ...body }) })
  return { ok: r.ok, body: await r.json().catch(() => ({})) }
}
export async function authLive() {
  if (!AUTH) return false
  if (live === null) live = await post('me', {}).then(() => true, () => false)
  return live
}
export const authLiveNow = () => live === true
const getSession = () => read('hv-session', null)
let lastCheck = null // { phone, account } — ответ CRM после верного кода

export const authConfig = {
  api: '', // адрес сервера, например 'https://api.nateria-spb.ru'; пусто — демо-режим
  smartCaptchaKey: '', // ключ клиента Яндекс SmartCaptcha; пусто — капча не загружается
  resendSeconds: 60, // пауза перед повторной отправкой кода
  maxSendsPerHour: 3, // сколько раз за час можно запросить код на один номер
  maxWrongCodes: 5, // после стольких неверных кодов вход блокируется
  lockMinutes: 15,
  minFillMs: 1500, // форму, заполненную быстрее, считаем заполненной ботом
}

export const channelNames = { telegram: 'Telegram', max: 'Max', sms: 'смс' }

const digits = (phone) => phone.replace(/\D/g, '')
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* пусто */ } }

/* ---- привязка мессенджеров (демо: хранится в браузере, на сервере — в базе) ---- */
export function linkedChannels(phone) {
  return read('hv-linked', {})[digits(phone)] || []
}
export function setLinked(phone, channel, on) {
  const all = read('hv-linked', {})
  const cur = new Set(all[digits(phone)] || [])
  on ? cur.add(channel) : cur.delete(channel)
  all[digits(phone)] = [...cur]
  write('hv-linked', all)
  return all[digits(phone)]
}
// Куда отправлять код: сначала Telegram, потом Max, иначе смс
export const pickChannel = (linked) => (linked.includes('telegram') ? 'telegram' : linked.includes('max') ? 'max' : 'sms')

/* ---- лимиты ---- */
function limits(phone) {
  const all = read('hv-auth', {})
  return { all, l: all[digits(phone)] || { sends: [], wrong: 0, lockUntil: 0 } }
}
const save = (phone, all, l) => { all[digits(phone)] = l; write('hv-auth', all) }

export function lockLeft(phone) {
  const { l } = limits(phone)
  return Math.max(0, Math.ceil((l.lockUntil - Date.now()) / 1000))
}

/* ---- Яндекс SmartCaptcha: загружается только если указан ключ ---- */
let captchaReady
function loadCaptcha() {
  if (!authConfig.smartCaptchaKey) return Promise.resolve(null)
  captchaReady ||= new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload'
    s.async = true
    s.onload = () => ok(window.smartCaptcha)
    s.onerror = fail
    document.head.appendChild(s)
  })
  return captchaReady
}
async function captchaToken() {
  const sc = await loadCaptcha()
  if (!sc) return null
  const box = document.createElement('div')
  document.body.appendChild(box)
  return new Promise((ok) => {
    const id = sc.render(box, { sitekey: authConfig.smartCaptchaKey, invisible: true, hideShield: true, callback: (t) => { box.remove(); ok(t) } })
    sc.execute(id)
  })
}

/* ---- отправка кода ---- */
// trap — скрытое поле-ловушка (человек его не видит и не заполняет), startedAt — когда открыли форму
// via: 'sms' — покупатель сам попросил смс; demoLinked — в демо: какие мессенджеры «есть» у номера
export async function sendCode(phone, { trap = '', startedAt = 0, via = '', demoLinked = null } = {}) {
  if (trap) return { error: 'Не удалось отправить код. Попробуйте ещё раз.' }
  if (Date.now() - startedAt < authConfig.minFillMs) return { error: 'Слишком быстро. Проверьте данные и нажмите ещё раз.' }
  if (await authLive()) {
    // лимиты и выбор канала — на стороне CRM
    try {
      const captcha = await captchaToken()
      const r = await post('send-code', { phone: digits(phone), via, captcha })
      return r.ok ? r.body : { error: r.body.error || 'Не удалось отправить код', resendIn: r.body.resendIn }
    } catch { live = false } // CRM пропала — дальше демо
  }
  const { all, l } = limits(phone)
  const now = Date.now()
  if (l.lockUntil > now) return { error: `Слишком много попыток. Попробуйте через ${Math.ceil((l.lockUntil - now) / 60000)} мин.` }
  l.sends = l.sends.filter((t) => now - t < 3600e3)
  const last = l.sends.at(-1)
  if (last && now - last < authConfig.resendSeconds * 1000) return { error: 'Код уже отправлен, подождите немного.', resendIn: Math.ceil((authConfig.resendSeconds * 1000 - (now - last)) / 1000) }
  if (l.sends.length >= authConfig.maxSendsPerHour) return { error: 'Код можно запросить не больше 3 раз в час. Попробуйте позже.' }
  // демо: код генерируется в браузере и показывается на экране
  const code = String(Math.floor(1000 + Math.random() * 9000))
  sessionStorage.setItem('hv-demo-code', code)
  l.sends.push(now)
  save(phone, all, l)
  return { channel: via === 'sms' ? 'sms' : pickChannel(demoLinked ?? linkedChannels(phone)), resendIn: authConfig.resendSeconds, demoCode: code }
}

/* ---- проверка кода ---- */
// move — покупатель меняет номер в личных данных: CRM перенесёт аккаунт на новый номер
export async function checkCode(phone, code, { move = false } = {}) {
  if (authLiveNow()) {
    try {
      const r = await post('check-code', { phone: digits(phone), code, move, token: getSession()?.token })
      if (!r.ok) return { error: r.body.error || 'Неверный код' }
      write('hv-session', { token: r.body.token, phone: digits(phone) })
      lastCheck = { phone: digits(phone), account: r.body.account }
      return { ok: true }
    } catch { return { error: 'Нет связи с сервером. Попробуйте ещё раз.' } }
  }
  const { all, l } = limits(phone)
  if (l.lockUntil > Date.now()) return { error: 'Вход временно заблокирован. Попробуйте позже.' }
  const ok = code === sessionStorage.getItem('hv-demo-code')
  if (ok) { l.wrong = 0; save(phone, all, l); sessionStorage.removeItem('hv-demo-code'); return { ok: true } }
  l.wrong += 1
  if (l.wrong >= authConfig.maxWrongCodes) { l.lockUntil = Date.now() + authConfig.lockMinutes * 60e3; l.wrong = 0; save(phone, all, l); return { error: `Неверный код. Вход заблокирован на ${authConfig.lockMinutes} минут.` } }
  save(phone, all, l)
  return { error: `Неверный код. Осталось попыток: ${authConfig.maxWrongCodes - l.wrong}` }
}

/* ---- учётные записи покупателей ---- */
// Есть ли аккаунт на этот номер: если да — сразу к выбору пункта выдачи, если нет — короткая анкета.
// На сервере: GET /api/auth/account (после проверки кода). Демо — хранится в браузере.
export async function findAccount(phone) {
  if (authLiveNow()) return lastCheck?.phone === digits(phone) ? lastCheck.account : null // занятость нового номера проверит CRM (move)
  return read('hv-accounts', {})[digits(phone)] || null
}
export async function saveAccount(phone, acc) {
  if (authLiveNow()) {
    if (!acc) return // старый номер CRM отвязала сама при смене
    await post('account', { token: getSession()?.token, account: acc }).catch(() => null)
    return
  }
  const all = read('hv-accounts', {})
  if (acc) all[digits(phone)] = acc
  else delete all[digits(phone)] // null — номер отвязан от аккаунта (сменили телефон)
  write('hv-accounts', all)
}

// Какие боты подключены к номеру (по данным CRM). null — CRM недоступна или вход был в демо
export async function messengerInfo() {
  const s = getSession()
  if (!(await authLive()) || !s) return null
  const r = await post('me', { token: s.token }).catch(() => null)
  return r?.ok ? { linked: r.body.linked || [], bots: r.body.bots || [] } : null
}
export const botLink = (b) => (b.type === 'telegram' ? `https://t.me/${b.username}` : `https://max.ru/${b.username}`)
