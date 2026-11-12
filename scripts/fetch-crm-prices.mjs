// Перед сборкой тянем цены/фасовки/категорию из CRM (она теперь источник истины для этих полей).
// Текст описаний, составы и прочий контент остаются в src/data.js как и раньше.
// Если CRM не запущена — тихо оставляем прошлый src/prices.generated.json (сборка не падает).
import fs from 'node:fs'
import path from 'node:path'

const CRM_URL = process.env.CRM_CATALOG_URL || 'http://127.0.0.1:4400/api/public/catalog'
const CRM_KEY = process.env.CRM_SITE_KEY || '' // для Nateria своей CRM-марки пока нет — ключ задаётся через env, когда появится
const OUT = path.resolve('src/prices.generated.json')

try {
  const r = await fetch(`${CRM_URL}?key=${encodeURIComponent(CRM_KEY)}`, { signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error(`CRM ответила ${r.status}`)
  const { products } = await r.json()
  const out = {}
  for (const p of products) {
    if (!p.variants?.length) continue
    out[p.product_id] = {
      pet_type: p.pet_type || '',
      weights: p.variants.map((v) => ({ w: v.variant, price: v.price, gtin: v.barcodes?.[0] || '' })),
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`Цены из CRM обновлены: ${Object.keys(out).length} товаров → ${OUT}`)
} catch (e) {
  console.warn(`⚠️  Не удалось получить цены из CRM (${e.message}). Использую прошлые значения из ${fs.existsSync(OUT) ? OUT : 'src/data.js (без изменений)'}.`)
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, '{}')
}
