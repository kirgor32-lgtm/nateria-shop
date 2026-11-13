// Все наши магазины (Хвостик, Nateria, Wonderfur) открываются с одного адреса kirgor32-lgtm.github.io,
// а браузер даёт сайтам с одного адреса ОБЩЕЕ хранилище. Поэтому у каждого магазина свой префикс ключей —
// иначе заказы, корзина и вход одного магазина видны в другом. Сводятся данные только в CRM.
import { products } from './data'

const PX = 'nt-'
const LINE = 'Nateria'
const OLD = 'hv-' // общий префикс до разделения

// Один раз переносим свои заказы и корзину из общих ключей, чужие оставляем на месте
export function migrateStorage() {
  try {
    if (localStorage.getItem(PX + 'migrated')) return
    const get = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
    const mine = (i) => i && i.line === LINE
    const move = (k, own) => {
      const all = get(OLD + k)
      if (!Array.isArray(all)) return
      const take = all.filter(own)
      if (!take.length) return
      localStorage.setItem(PX + k, JSON.stringify([...take, ...(get(PX + k) || [])]))
      localStorage.setItem(OLD + k, JSON.stringify(all.filter((x) => !own(x))))
    }
    move('orders', (o) => Array.isArray(o?.items) && o.items.length > 0 && o.items.every(mine))
    move('cart', mine)
    move('crm-pending', (p) => p?.kind === 'order' && Array.isArray(p.payload?.items) && p.payload.items.length > 0 && p.payload.items.every(mine))
    // в избранном только id товаров — копируем свои, общий список не трогаем (у сайтов есть одинаковые id)
    const ids = new Set(products.map((p) => p.id))
    const fav = get(OLD + 'fav')
    if (Array.isArray(fav) && !get(PX + 'fav')) localStorage.setItem(PX + 'fav', JSON.stringify(fav.filter((id) => ids.has(id))))
    localStorage.setItem(PX + 'migrated', '1')
  } catch { /* хранилище недоступно — ничего не переносим */ }
}
