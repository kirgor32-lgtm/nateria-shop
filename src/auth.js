// Вход и регистрация покупателя — как у «Четырёх лап»:
// 1) телефон или почта → «Продолжить»;
// 2) номер уже зарегистрирован → вход по паролю («Забыли пароль?» — пришлём новый);
//    номер новый → код подтверждения → «Зарегистрироваться» → короткая анкета с паролем.
//
// Куда уходит код или новый пароль — по приоритету: Telegram → Max (на почту — для входа по почте).
// Нет мессенджера — номер подтверждается звонком: покупатель звонит на выданный номер («Плюсофон»,
// обратный Flash Call), CRM получает вебхук, и вход открывается сам — сайт опрашивает callStatus().
// Если сайт собран с адресом CRM (VITE_CRM_API) и CRM на связи, коды, пароли и учётные записи живут в CRM
// (src/siteauth.js в crm-hub). Иначе всё работает в демо-режиме прямо в браузере: код показывается на экране.
// Важно: проверки в браузере — первый барьер, обойти их можно. Настоящие лимиты
// и проверка капчи обязательно должны дублироваться на сервере.

import { crmConfig, crmEnabled } from './crm'

/* ---- связь с CRM: если она доступна, коды шлёт она (бот Telegram/Max) или выдаёт номер для звонка ---- */
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
export const getSession = () => read('nt-session', null)
let lastCheck = null // { phone, account } — ответ CRM после верного кода или пароля

export const authConfig = {
  smartCaptchaKey: '', // ключ клиента Яндекс SmartCaptcha; пусто — капча не загружается
  resendSeconds: 60, // пауза перед повторной отправкой кода
  maxSendsPerHour: 3, // сколько раз за час можно запросить код на один номер
  maxWrongCodes: 5, // после стольких неверных кодов или паролей вход блокируется
  lockMinutes: 15,
  minFillMs: 1500, // форму, заполненную быстрее, считаем заполненной ботом
  minPassword: 6,
}

export const channelNames = { telegram: 'Telegram', max: 'Max', call: 'звонок', email: 'почту' }

const digits = (phone) => String(phone || '').replace(/\D/g, '')
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim())
// ключ учётной записи: номер цифрами или «e:почта»
const idOf = (login) => (isEmail(login) ? 'e:' + login.trim().toLowerCase() : digits(login))
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* пусто */ } }

// +7 (***) ***-42-35 и a***@mail.ru — как в письме «мы отправили код на…»
export function maskLogin(login) {
  if (isEmail(login)) {
    const [u, d] = login.trim().split('@')
    return `${u[0]}***@${d}`
  }
  const d = digits(login)
  return `+7 (***) ***-${d.slice(7, 9)}-${d.slice(9, 11)}`
}

/* ---- привязка мессенджеров (демо: хранится в браузере, на сервере — в базе) ---- */
export function linkedChannels(phone) {
  return read('nt-linked', {})[digits(phone)] || []
}
export function setLinked(phone, channel, on) {
  const all = read('nt-linked', {})
  const cur = new Set(all[digits(phone)] || [])
  on ? cur.add(channel) : cur.delete(channel)
  all[digits(phone)] = [...cur]
  write('nt-linked', all)
  return all[digits(phone)]
}
// Куда отправлять код: сначала Telegram, потом Max, иначе — подтверждение звонком
export const pickChannel = (linked) => (linked.includes('telegram') ? 'telegram' : linked.includes('max') ? 'max' : 'call')

/* ---- лимиты ---- */
function limits(login) {
  const all = read('nt-auth', {})
  return { all, l: all[idOf(login)] || { sends: [], wrong: 0, lockUntil: 0 } }
}
const save = (login, all, l) => { all[idOf(login)] = l; write('nt-auth', all) }
function wrongTry(login, all, l, what) {
  l.wrong += 1
  if (l.wrong >= authConfig.maxWrongCodes) {
    l.lockUntil = Date.now() + authConfig.lockMinutes * 60e3; l.wrong = 0; save(login, all, l)
    return { error: `Неверный ${what}. Вход заблокирован на ${authConfig.lockMinutes} минут.` }
  }
  save(login, all, l)
  return { error: `Неверный ${what}. Осталось попыток: ${authConfig.maxWrongCodes - l.wrong}` }
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

/* ---- пароли в демо: соль + SHA-256, в браузере хранится только хеш ---- */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
async function sha(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))) }
async function makeHash(pass) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)))
  return salt + ':' + (await sha(salt + ':' + pass))
}
async function sameHash(stored, pass) {
  const [salt, h] = String(stored || '').split(':')
  return !!h && (await sha(salt + ':' + pass)) === h
}
const emailLinks = () => read('nt-emails', {}) // почта → номер (демо)
const phoneOf = (login) => (isEmail(login) ? emailLinks()[idOf(login).slice(2)] || '' : digits(login))
export const phoneFor = phoneOf // номер аккаунта по номеру или почте

/* ---- шаг 1: есть ли такой покупатель ---- */
// { exists, password } — зарегистрирован ли номер/почта и задан ли пароль
export async function lookup(login) {
  if (await authLive()) {
    if (isEmail(login)) return { error: 'Вход по почте пока не работает — войдите по номеру телефона' }
    try {
      const r = await post('lookup', { phone: digits(login) })
      return r.ok ? { exists: !!r.body.exists, password: !!r.body.password } : { error: r.body.error || 'Не получилось проверить номер' }
    } catch { live = false }
  }
  const phone = phoneOf(login)
  const acc = phone && read('nt-accounts', {})[phone]
  return { exists: !!acc, password: !!(acc && read('nt-pass', {})[phone]) }
}

/* ---- отправка кода или нового пароля ---- */
// trap — скрытое поле-ловушка (человек его не видит и не заполняет), startedAt — когда открыли форму
// via: 'call' — покупатель сам выбрал звонок; demoLinked — в демо: какие мессенджеры «есть» у номера
// Ответ со звонком: { channel: 'call', callId, callTo, expiresIn } — номер, на который надо позвонить
// kind: 'code' — 4 цифры для регистрации/смены номера, 'reset' — новый пароль из 6 цифр («Забыли пароль?»)
export async function sendCode(login, { trap = '', startedAt = 0, via = '', demoLinked = null, kind = 'code' } = {}) {
  if (trap) return { error: 'Не удалось отправить код. Попробуйте ещё раз.' }
  if (Date.now() - startedAt < authConfig.minFillMs) return { error: 'Слишком быстро. Проверьте данные и нажмите ещё раз.' }
  const email = isEmail(login)
  if (await authLive()) {
    if (email) return { error: 'Вход по почте пока не работает — войдите по номеру телефона' }
    // лимиты и выбор канала — на стороне CRM
    try {
      const captcha = await captchaToken()
      const r = await post('send-code', { phone: digits(login), via, captcha, kind })
      return r.ok ? r.body : { error: r.body.error || 'Не удалось отправить код', resendIn: r.body.resendIn }
    } catch { live = false } // CRM пропала — дальше демо
  }
  const { all, l } = limits(login)
  const now = Date.now()
  if (l.lockUntil > now) return { error: `Слишком много попыток. Попробуйте через ${Math.ceil((l.lockUntil - now) / 60000)} мин.` }
  l.sends = l.sends.filter((t) => now - t < 3600e3)
  const last = (l.last || {})[kind] // пауза в минуту — отдельно для кода и для нового пароля
  if (last && now - last < authConfig.resendSeconds * 1000) return { error: 'Код уже отправлен, подождите немного.', resendIn: Math.ceil((authConfig.resendSeconds * 1000 - (now - last)) / 1000) }
  if (l.sends.length >= authConfig.maxSendsPerHour) return { error: 'Код можно запросить не больше 3 раз в час. Попробуйте позже.' }
  const phone = phoneOf(login)
  const channel = email ? 'email' : via === 'call' ? 'call' : pickChannel(demoLinked ?? linkedChannels(phone))
  l.sends.push(now)
  l.last = { ...l.last, [kind]: now }
  save(login, all, l)
  // демо-звонок: номер выдаст «Плюсофон», когда подключим; пока — кнопка «Я позвонил»
  if (channel === 'call') {
    sessionStorage.setItem('nt-demo-call', JSON.stringify({ id: idOf(login), until: now + 300e3 }))
    return { channel, callId: 'demo', callTo: '', expiresIn: 300, resendIn: authConfig.resendSeconds, demo: true }
  }
  // демо: код генерируется в браузере и показывается на экране
  const code = kind === 'reset' ? String(Math.floor(100000 + Math.random() * 900000)) : String(Math.floor(1000 + Math.random() * 9000))
  sessionStorage.setItem('nt-demo-code', JSON.stringify({ id: idOf(login), code }))
  return { channel, resendIn: authConfig.resendSeconds, demoCode: code }
}

/* ---- подтверждение звонком: позвонил ли покупатель ---- */
// → { confirmed: false } пока ждём; { ok: true, confirmed: true } — вход открыт (как после верного кода);
// { error } — время вышло. demo: true — кнопка «Я позвонил» (работает только в демо)
export async function callStatus(login, callId, { move = false, demo = false } = {}) {
  if (authLiveNow() && callId !== 'demo') {
    try {
      const r = await post('call-status', { phone: digits(login), id: callId, move, demo, token: getSession()?.token })
      if (!r.ok) return { error: r.body.error || 'Не получилось проверить звонок' }
      if (!r.body.confirmed) return { confirmed: false }
      write('nt-session', { token: r.body.token, phone: digits(login) })
      lastCheck = { phone: digits(login), account: r.body.account }
      return { ok: true, confirmed: true }
    } catch { return { confirmed: false } } // нет связи — спросим ещё раз
  }
  const d = (() => { try { return JSON.parse(sessionStorage.getItem('nt-demo-call')) } catch { return null } })()
  if (!d || d.id !== idOf(login)) return { error: 'Запросите номер для звонка ещё раз' }
  if (d.until < Date.now()) return { error: 'Время на звонок вышло — запросите номер ещё раз' }
  if (!demo) return { confirmed: false }
  sessionStorage.removeItem('nt-demo-call')
  return { ok: true, confirmed: true }
}

/* ---- проверка кода (или пароля из сообщения «Забыли пароль?») ---- */
// move — покупатель меняет номер в личных данных: CRM перенесёт аккаунт на новый номер
export async function checkCode(login, code, { move = false } = {}) {
  code = String(code || '').trim()
  if (authLiveNow()) {
    try {
      const r = await post('check-code', { phone: digits(login), code, move, token: getSession()?.token })
      if (!r.ok) return { error: r.body.error || 'Неверный код' }
      write('nt-session', { token: r.body.token, phone: digits(login) })
      lastCheck = { phone: digits(login), account: r.body.account }
      return { ok: true }
    } catch { return { error: 'Нет связи с сервером. Попробуйте ещё раз.' } }
  }
  const { all, l } = limits(login)
  if (l.lockUntil > Date.now()) return { error: 'Вход временно заблокирован. Попробуйте позже.' }
  const demo = (() => { try { return JSON.parse(sessionStorage.getItem('nt-demo-code')) } catch { return null } })()
  if (demo && demo.id === idOf(login) && demo.code === code) { l.wrong = 0; save(login, all, l); sessionStorage.removeItem('nt-demo-code'); return { ok: true } }
  return wrongTry(login, all, l, code.length > 4 ? 'пароль' : 'код')
}

/* ---- вход по паролю ---- */
// → { ok, phone, account } — phone нужен, если входили по почте
export async function loginPassword(login, pass) {
  if (authLiveNow()) {
    try {
      const r = await post('login', { phone: digits(login), password: pass })
      if (!r.ok) return { error: r.body.error || 'Неверный пароль' }
      write('nt-session', { token: r.body.token, phone: digits(login) })
      lastCheck = { phone: digits(login), account: r.body.account }
      return { ok: true, phone: digits(login), account: r.body.account }
    } catch { return { error: 'Нет связи с сервером. Попробуйте ещё раз.' } }
  }
  const { all, l } = limits(login)
  if (l.lockUntil > Date.now()) return { error: `Слишком много попыток. Попробуйте через ${Math.ceil((l.lockUntil - Date.now()) / 60000)} мин.` }
  const phone = phoneOf(login)
  const stored = phone && read('nt-pass', {})[phone]
  if (!(await sameHash(stored, pass))) return wrongTry(login, all, l, 'пароль')
  l.wrong = 0; save(login, all, l)
  return { ok: true, phone, account: read('nt-accounts', {})[phone] || null }
}

// Новый пароль — после проверки кода (регистрация, «Забыли пароль?») или в личных данных
export async function setPassword(phone, pass) {
  if (authLiveNow()) {
    const r = await post('password', { token: getSession()?.token, password: pass }).catch(() => null)
    return r?.ok ? { ok: true } : { error: r?.body?.error || 'Не получилось сохранить пароль' }
  }
  const all = read('nt-pass', {})
  all[digits(phone)] = await makeHash(pass)
  write('nt-pass', all)
  return { ok: true }
}

// Почта, по которой можно входить (демо): почта → номер
export function linkEmail(email, phone) {
  const all = emailLinks()
  for (const [e, p] of Object.entries(all)) if (p === digits(phone)) delete all[e] // у аккаунта одна почта
  if (email) all[idOf(email).slice(2)] = digits(phone)
  write('nt-emails', all)
}
export const emailOf = (phone) => Object.entries(emailLinks()).find(([, p]) => p === digits(phone))?.[0] || ''

/* ---- учётные записи покупателей ---- */
// Есть ли аккаунт на этот номер (после проверки кода). Демо — хранится в браузере.
export async function findAccount(phone) {
  if (authLiveNow()) return lastCheck?.phone === digits(phone) ? lastCheck.account : null // занятость нового номера проверит CRM (move)
  return read('nt-accounts', {})[digits(phone)] || null
}
export async function saveAccount(phone, acc) {
  if (authLiveNow()) {
    if (!acc) return // старый номер CRM отвязала сама при смене
    await post('account', { token: getSession()?.token, account: acc }).catch(() => null)
    return
  }
  const all = read('nt-accounts', {})
  const pass = read('nt-pass', {})
  if (acc) all[digits(phone)] = acc
  else { delete all[digits(phone)]; delete pass[digits(phone)] } // null — номер отвязан от аккаунта (сменили телефон)
  write('nt-accounts', all)
  write('nt-pass', pass)
}
// Смена номера в демо: пароль и почта переезжают на новый номер
export function movePassword(from, to) {
  if (authLiveNow()) return
  const pass = read('nt-pass', {})
  if (pass[digits(from)]) { pass[digits(to)] = pass[digits(from)]; delete pass[digits(from)]; write('nt-pass', pass) }
  const e = emailOf(from)
  if (e) linkEmail(e, to)
}

// Какие боты подключены к номеру (по данным CRM). null — CRM недоступна или вход был в демо
export async function messengerInfo() {
  const s = getSession()
  if (!(await authLive()) || !s) return null
  const r = await post('me', { token: s.token }).catch(() => null)
  return r?.ok ? { linked: r.body.linked || [], bots: r.body.bots || [] } : null
}
export const botLink = (b) => (b.type === 'telegram' ? `https://t.me/${b.username}` : `https://max.ru/${b.username}`)
