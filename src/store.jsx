import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { products } from './data'
import { track, sendOrder, checkPromo, crmEnabled } from './crm'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// Данные из localStorage читаются ПОСЛЕ гидрации — иначе HTML с сервера и первый рендер не совпадут
// clean — проверка сохранённых данных: убираем товары, которых больше нет, и старые цены
function usePersist(key, initial, clean = (x) => x) {
  const [v, setV] = useState(initial)
  const loaded = useRef(false)
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(key)); if (s !== null) setV(clean(s)) } catch { /* пусто */ }
    loaded.current = true
  }, [key])
  useEffect(() => { if (loaded.current) localStorage.setItem(key, JSON.stringify(v)) }, [key, v])
  return [v, setV]
}

// Промокод с листовки: -10% на первый заказ (клиентская проверка — для небольшого магазина достаточно)
export const PROMO = { code: 'ХВОСТИК10', kind: 'pct', value: 10, firstOrder: true } // запасной вариант, если CRM не подключена

const byId = Object.fromEntries(products.map((p) => [p.id, p]))
// В избранном — только существующие товары, без повторов (раньше там оставались id из старой версии сайта)
const cleanFav = (f) => (Array.isArray(f) ? [...new Set(f)].filter((id) => byId[id]) : [])
// В корзине — только существующие фасовки и с актуальной ценой
const cleanCart = (items) => (Array.isArray(items) ? items.flatMap((i) => {
  const v = byId[i.id]?.weights.find((w) => w.w === i.w)
  return v && i.qty > 0 ? [{ ...i, price: v.price }] : []
}) : [])

export function StoreProvider({ children }) {
  const [items, setItems] = usePersist('hv-cart', [], cleanCart)
  const [fav, setFav] = usePersist('hv-fav', [], cleanFav)
  const [user, setUser] = usePersist('hv-user', null)
  const [orders, setOrders] = usePersist('hv-orders', [])
  const [panel, setPanel] = useState(null) // 'cart' | 'fav' | 'profile' | 'menu'
  const [checkout, setCheckout] = useState(false)
  const [compare, setCompare] = useState([]) // id товаров для сравнения состава, в рамках сессии
  const [promo, setPromo] = useState(null) // применённый промокод в этой сессии, например PROMO
  const [promoRedeemed, setPromoRedeemed] = usePersist('hv-promo-redeemed', false) // промокод на первый заказ уже использован

  const api = useMemo(() => {
    const key = (id, w) => `${id}|${w}`
    const add = (p, v) => { track('add_to_cart', { id: p.id, name: p.name, w: v.w, price: v.price }); setItems((s) => {
      const k = key(p.id, v.w)
      return s.some((i) => i.key === k) ? s.map((i) => (i.key === k ? { ...i, qty: i.qty + 1 } : i))
        : [...s, { key: k, id: p.id, line: p.line, name: p.name, w: v.w, price: v.price, qty: 1 }]
    }) }
    const setQty = (k, q) => setItems((s) => (q <= 0 ? s.filter((i) => i.key !== k) : s.map((i) => (i.key === k ? { ...i, qty: q } : i))))
    const qtyOf = (id, w) => items.find((i) => i.key === key(id, w))?.qty || 0
    const count = items.reduce((s, i) => s + i.qty, 0)
    const total = items.reduce((s, i) => s + i.qty * i.price, 0)
    const toggleFav = (id) => setFav((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
    const toggleCompare = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]))
    const firstOrderEligible = orders.length === 0 && !promoRedeemed
    // промокоды заводятся в CRM (раздел «Промокоды»); без CRM работает только PROMO
    const applyPromo = async (raw, phone = user?.phone || '') => {
      const code = (raw || '').trim().toUpperCase()
      if (!code) return { ok: false, msg: 'Введите промокод' }
      const r = await checkPromo(code, phone)
      if (r) {
        if (!r.ok) return { ok: false, msg: r.msg }
        setPromo({ code: r.code, kind: r.kind, value: r.value, firstOrder: r.firstOrder })
        return { ok: true }
      }
      if (!firstOrderEligible) return { ok: false, msg: 'Промокод действует только на первый заказ' }
      if (code !== PROMO.code) return { ok: false, msg: 'Такого промокода нет — проверьте написание' }
      setPromo(PROMO)
      return { ok: true }
    }
    const clearPromo = () => setPromo(null)
    const promoOk = promo && (!promo.firstOrder || firstOrderEligible || crmEnabled)
    const discount = !promoOk ? 0 : promo.kind === 'fixed' ? Math.min(total, promo.value) : Math.round(total * promo.value / 100)
    const totalWithDiscount = total - discount
    const placeOrder = (contact) => {
      const o = { n: String(Date.now()).slice(-6), date: new Date().toLocaleDateString('ru-RU'), items, total: totalWithDiscount, promo: discount ? promo.code : null, contact }
      setOrders((s) => [o, ...s])
      sendOrder({ ...o, discount }) // в CRM (если подключена)
      if (!user) setUser({ name: contact.name, phone: contact.phone })
      if (discount) setPromoRedeemed(true)
      setItems([])
      setPromo(null)
      return o
    }
    return { items, add, setQty, qtyOf, count, total, fav, favCount: fav.length, toggleFav, compare, toggleCompare, clearCompare: () => setCompare([]), user, setUser, orders, placeOrder, panel, setPanel, checkout, setCheckout, promo, applyPromo, clearPromo, discount, totalWithDiscount, firstOrderEligible }
  }, [items, fav, compare, user, orders, panel, checkout, promo, promoRedeemed])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const rub = (n) => n.toLocaleString('ru-RU').replace(/\u202f| /g, '\u00a0') + '\u00a0₽' // неразрывные пробелы: ₽ не уезжает на новую строку

export const fmtPhone = (raw) => {
  let d = raw.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('8')) d = '7' + d.slice(1)
  if (!d.startsWith('7')) d = '7' + d
  const p = d.slice(1, 11)
  let s = '+7'
  if (p.length) s += ' (' + p.slice(0, 3)
  if (p.length >= 3) s += ')'
  if (p.length > 3) s += ' ' + p.slice(3, 6)
  if (p.length > 6) s += '-' + p.slice(6, 8)
  if (p.length > 8) s += '-' + p.slice(8, 10)
  return s
}
