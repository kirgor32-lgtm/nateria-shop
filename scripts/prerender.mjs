// Собирает отдельный HTML на каждую страницу + sitemap.xml, robots.txt, manifest
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = path.resolve('dist')
const SITE = 'https://kirgor32-lgtm.github.io/nateria-shop'
const tpl = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const { render, routes, products } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href)

const page = (p) => {
  const r = render(p)
  const key = r.type === '404' ? '__404__' : p
  return tpl.replace('<!--head-->', r.head).replace('<div id="root"><!--app-->', `<div id="root" data-path="${key}">${r.html}`)
}
const list = routes()
for (const r of list) {
  const dir = path.join(dist, r.path)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), page(r.path))
}
fs.writeFileSync(path.join(dist, '404.html'), page('__not-found__/'))

const today = new Date().toISOString().slice(0, 10)
const indexable = list.filter((r) => r.type !== 'thanks' && !['privacy', 'consent'].includes(r.page))
const prio = (r) => (r.type === 'home' ? '1.0' : r.type === 'kind' ? '0.9' : r.type === 'product' ? '0.8' : '0.5')
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  indexable.map((r) => `  <url><loc>${SITE}/${r.path}</loc><lastmod>${today}</lastmod><priority>${prio(r)}</priority></url>`).join('\n') +
  '\n</urlset>\n')
fs.writeFileSync(path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid\n\nSitemap: ${SITE}/sitemap.xml\n`)
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: 'Nateria — корма для кошек и собак', short_name: 'Nateria', lang: 'ru', start_url: '/nateria-shop/', scope: '/nateria-shop/',
  display: 'standalone', background_color: '#ffffff', theme_color: "#ffffff",
  icons: [
    { src: '/nateria-shop/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/nateria-shop/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2))
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
// Прайс для CRM: по нему она проверяет цены в заказах (браузеру покупателя не доверяет)
fs.writeFileSync(path.join(dist, 'prices.json'), JSON.stringify(products.flatMap((p) => p.weights.map((w) => ({ id: p.id, w: w.w, price: w.price, name: `${p.line} — ${p.name}` }))), null, 1))
fs.rmSync(path.resolve('dist-ssr'), { recursive: true, force: true })
console.log(`prerendered ${list.length} pages + 404, sitemap ${indexable.length} urls`)
