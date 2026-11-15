// Перед сборкой тянем из CRM карточки товаров: цена, фасовки, категория, тексты, состав и фото.
// Фото скачиваются в public/img/crm/ (в git не попадают). Результат — src/prices.generated.json.
// Если CRM недоступна — тихо оставляем прошлый src/prices.generated.json (сборка не падает).
import fs from 'node:fs'
import path from 'node:path'

const CRM_URL = process.env.CRM_CATALOG_URL || 'http://127.0.0.1:4400/api/public/catalog'
const CRM_KEY = process.env.CRM_SITE_KEY || '' // ключ сайта марки в CRM, задаётся через env (.env.server)
const OUT = path.resolve('src/prices.generated.json')
const IMG_DIR = path.resolve('public/img/crm')

try {
  if (!CRM_KEY) throw new Error('ключ сайта CRM_SITE_KEY не задан')
  const r = await fetch(`${CRM_URL}?key=${encodeURIComponent(CRM_KEY)}`, { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`CRM ответила ${r.status}`)
  const { products } = await r.json()
  const origin = new URL(CRM_URL).origin
  fs.mkdirSync(IMG_DIR, { recursive: true })
  const out = {}
  let got = 0
  for (const p of products) {
    if (!p.variants?.length) continue
    const images = []
    for (const u of p.images || []) {
      // берём путь из ссылки и скачиваем с того же адреса, откуда пришёл каталог (на сервере это localhost)
      const pathname = new URL(u, origin).pathname
      const file = path.basename(pathname)
      if (!/^[\w.-]+\.(webp|jpg|png)$/.test(file)) continue
      const dest = path.join(IMG_DIR, file)
      if (!fs.existsSync(dest)) {
        const ir = await fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(20000) })
        if (!ir.ok) { console.warn(`⚠️  фото ${file} не скачалось (${ir.status}) — пропускаю`); continue }
        fs.writeFileSync(dest, Buffer.from(await ir.arrayBuffer()))
        got++
      }
      images.push(file)
    }
    out[p.product_id] = {
      pet_type: p.pet_type || '',
      weights: p.variants.map((v) => ({ w: v.variant, price: v.price, gtin: v.barcodes?.[0] || '' })),
      ...(p.card ? { card: p.card } : {}),
      ...(images.length ? { images } : {}),
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`Каталог из CRM обновлён: ${Object.keys(out).length} товаров, новых фото ${got} → ${OUT}`)
} catch (e) {
  console.warn(`⚠️  Не удалось получить каталог из CRM (${e.message}). Использую прошлые значения из ${fs.existsSync(OUT) ? OUT : 'src/data.js (без изменений)'}.`)
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, '{}')
}
