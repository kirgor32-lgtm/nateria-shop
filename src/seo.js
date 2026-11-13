// Маршруты и SEO-данные каждой страницы. Используется и при пререндере, и в браузере.
import { SITE, BASE, products, kinds, pages, posts, faq, contacts, productPath, minPrice, img, declaration, minAll } from './data'

const abs = (p = '') => `${SITE}/${p}`
const cut = (t, n) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1)).replace(/[,.:;—-]+$/, '') + '…')
const OG_IMAGE = abs('og-image.jpg')
const BRAND = 'Nateria'

const org = {
  '@type': 'OnlineStore',
  '@id': abs('#store'),
  name: 'Nateria — магазин кормов для кошек и собак',
  url: abs(),
  logo: abs('icons/icon-512.png'),
  image: OG_IMAGE,
  description: 'Интернет-магазин сухих кормов Nateria для кошек и собак с бесплатной доставкой до пунктов выдачи 5Post в Санкт-Петербурге.',
  areaServed: { '@type': 'City', name: 'Санкт-Петербург' },
  currenciesAccepted: 'RUB',
  sameAs: [contacts.telegram, contacts.max],
  ...(contacts.demo ? {} : { telephone: contacts.phone, email: contacts.email }),
}

// Бесплатная доставка по Санкт-Петербургу и возврат 7 дней — для расширенных сниппетов
const shipping = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'RUB' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'RU', addressRegion: 'Санкт-Петербург' },
}
const returnPolicy = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'RU',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
}

const crumbs = (list) => ({
  '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
})

const productLd = (p) => ({
  '@type': 'Product',
  '@id': abs(productPath(p) + '#product'),
  name: `${p.line} ${p.name}`,
  description: `${p.text} ${p.more}`,
  image: abs(`img/p/${p.id}.webp`),
  brand: { '@type': 'Brand', name: p.line },
  manufacturer: { '@type': 'Organization', name: 'ООО «СКЗ» (Саратовский кормовой завод)' },
  countryOfOrigin: 'RU',
  category: p.kind === 'cat' ? 'Корма для кошек' : 'Корма для собак',
  sku: p.weights[0].gtin,
  gtin13: p.weights[0].gtin,
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Вкус', value: p.taste },
    { '@type': 'PropertyValue', name: 'Для кого', value: p.ageLabel },
    { '@type': 'PropertyValue', name: 'Срок годности', value: '18 месяцев' },
    { '@type': 'PropertyValue', name: 'Декларация соответствия', value: declaration },
  ],
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'RUB',
    lowPrice: minPrice(p),
    highPrice: Math.max(...p.weights.map((w) => w.price)),
    offerCount: p.weights.length,
    offers: p.weights.map((w) => ({
      '@type': 'Offer',
      name: `${p.line} ${p.short}, ${w.w}`,
      sku: w.gtin,
      gtin13: w.gtin,
      price: w.price,
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: abs(productPath(p)),
      seller: { '@id': abs('#store') },
      areaServed: { '@type': 'City', name: 'Санкт-Петербург' },
      shippingDetails: shipping,
      hasMerchantReturnPolicy: returnPolicy,
    })),
  },
})

const listLd = (list, name) => ({
  '@type': 'ItemList',
  name,
  itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(productPath(p)), name: `${p.line} ${p.name}` })),
})

// Все страницы сайта: path (без BASE, со слэшем на конце или '') → описание
export function routes() {
  const r = [
    { path: '', type: 'home' },
    ...Object.keys(kinds).map((k) => ({ path: kinds[k].path, type: 'kind', kind: k })),
    ...products.map((p) => ({ path: productPath(p), type: 'product', id: p.id })),
    { path: pages.blog.path, type: 'blog' },
    ...posts.map((p) => ({ path: `blog/${p.slug}/`, type: 'post', slug: p.slug })),
    ...['delivery', 'returns', 'about', 'contacts', 'faq', 'privacy', 'consent'].map((k) => ({ path: pages[k].path, type: 'page', page: k })),
    { path: 'spasibo/', type: 'thanks' },
  ]
  return r
}

export function match(path) {
  const clean = path.replace(/^\/+/, '').replace(/[?#].*$/, '')
  const norm = clean && !clean.endsWith('/') ? clean + '/' : clean
  return routes().find((r) => r.path === norm) || { path: norm, type: '404' }
}

// Путь текущей страницы из location.pathname
export const stripBase = (pathname) => (pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, ''))

export function head(route) {
  const p = route.id && products.find((x) => x.id === route.id)
  const post = route.slug && posts.find((x) => x.slug === route.slug)
  let title, desc, ld = [], image = OG_IMAGE, type = 'website', robots = 'index, follow, max-image-preview:large'
  switch (route.type) {
    case 'home':
      title = 'Корма Nateria для кошек и собак — купить в СПб, доставка бесплатно'
      desc = `Сухие корма Nateria: 15 рецептов для кошек, котят, собак и щенков, включая гипоаллергенные и для профилактики МКБ. Цены от ${minAll} ₽, бесплатная доставка до пунктов 5Post в СПб.`
      ld = [org, { '@type': 'WebSite', '@id': abs('#site'), url: abs(), name: BRAND, inLanguage: 'ru-RU', publisher: { '@id': abs('#store') } }, listLd(products, 'Корма Nateria')]
      break
    case 'kind': {
      const k = kinds[route.kind]
      title = k.title
      desc = k.desc
      ld = [crumbs([['Главная', ''], [k.h1, k.path]]), listLd(products.filter((x) => x.kind === route.kind), k.h1)]
      break
    }
    case 'product': {
      const k = kinds[p.kind]
      const base = `${p.line}: ${p.short}`
      const tasty = p.short.includes(p.taste.split(' ')[0].slice(0, 5)) ? base : `${base}, ${p.taste}`
      title = `${(tasty + ' — купить в СПб').length <= 62 ? tasty : base} — купить в СПб`
      desc = `${p.name} ${p.line}. Цена от ${minPrice(p)} ₽, фасовки ${p.weights.map((w) => w.w).join(', ')}. Бесплатная доставка до пунктов 5Post в Санкт-Петербурге.`
      image = abs(`img/p/${p.id}.webp`)
      type = 'product'
      ld = [crumbs([['Главная', ''], [k.h1, k.path], [`${p.line} ${p.short}`, productPath(p)]]), productLd(p)]
      break
    }
    case 'blog':
      title = pages.blog.title + ' | Nateria'
      desc = pages.blog.desc
      ld = [crumbs([['Главная', ''], ['Блог', pages.blog.path]])]
      break
    case 'post':
      title = `${post.title} | Блог Nateria`
      desc = cut(post.text + ' ' + post.body[0], 160)
      image = abs(`img/p/${post.img}.webp`)
      type = 'article'
      ld = [crumbs([['Главная', ''], ['Блог', pages.blog.path], [post.title, `blog/${post.slug}/`]]),
        { '@type': 'Article', headline: post.title, description: post.text, image, inLanguage: 'ru-RU', author: { '@id': abs('#store') }, publisher: { '@id': abs('#store') }, mainEntityOfPage: abs(`blog/${post.slug}/`) }]
      break
    case 'page': {
      const pg = pages[route.page]
      title = `${pg.title} | Nateria`
      desc = pg.desc
      ld = [crumbs([['Главная', ''], [pg.title, pg.path]])]
      if (route.page === 'faq') ld.push({ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) })
      if (route.page === 'contacts' || route.page === 'about') ld.push(org)
      if (route.page === 'privacy' || route.page === 'consent') robots = 'noindex, follow'
      break
    }
    case 'thanks':
      title = 'Спасибо! | Nateria'
      desc = 'Заказ или заявка приняты.'
      robots = 'noindex, nofollow'
      break
    default:
      title = 'Страница не найдена | Nateria'
      desc = 'Такой страницы нет. Перейдите в каталог кормов Nateria.'
      robots = 'noindex, follow'
  }
  const canonical = route.type === '404' ? null : abs(route.path)
  return { title, desc, canonical, image, type, robots, ld: ld.length ? { '@context': 'https://schema.org', '@graph': ld } : null }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// HTML для <head> при пререндере
export function headHtml(h) {
  return [
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.desc)}" />`,
    `<meta name="robots" content="${h.robots}" />`,
    h.canonical ? `<link rel="canonical" href="${h.canonical}" />` : '',
    `<meta property="og:type" content="${h.type}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:title" content="${esc(h.title)}" />`,
    `<meta property="og:description" content="${esc(h.desc)}" />`,
    h.canonical ? `<meta property="og:url" content="${h.canonical}" />` : '',
    `<meta property="og:image" content="${h.image}" />`,
    h.ld ? `<script type="application/ld+json">${JSON.stringify(h.ld).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ')
}

// Обновление <head> при переходах внутри сайта
export function applyHead(h) {
  document.title = h.title
  const set = (sel, attr, val, make) => {
    let el = document.head.querySelector(sel)
    if (!el) { el = make(); document.head.appendChild(el) }
    el.setAttribute(attr, val)
  }
  const meta = (k, v, prop) => set(`meta[${prop ? 'property' : 'name'}="${k}"]`, 'content', v, () => { const m = document.createElement('meta'); m.setAttribute(prop ? 'property' : 'name', k); return m })
  meta('description', h.desc)
  meta('robots', h.robots)
  meta('og:type', h.type, true)
  meta('og:title', h.title, true)
  meta('og:description', h.desc, true)
  if (h.canonical) meta('og:url', h.canonical, true)
  meta('og:image', h.image, true)
  if (h.canonical) set('link[rel="canonical"]', 'href', h.canonical, () => { const l = document.createElement('link'); l.rel = 'canonical'; return l })
  else document.head.querySelector('link[rel="canonical"]')?.remove()
  let s = document.head.querySelector('script[type="application/ld+json"]')
  if (h.ld) {
    if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; document.head.appendChild(s) }
    s.textContent = JSON.stringify(h.ld)
  } else s?.remove()
}

export { img }
