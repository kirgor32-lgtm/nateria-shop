import { useEffect, useMemo, useRef, useState, Fragment, lazy, Suspense } from 'react'
const PickupPicker = lazy(() => import('./PickupPicker'))
import {
  Search, ShoppingBag, Heart, User, Menu, X, Minus, Plus, ChevronRight, Phone, Clock, LogOut, Package, Pencil,
  Drumstick, Scale, HeartPulse, ShieldCheck, Factory, BadgeCheck, Check, Trash2, Loader2, Send, Truck, Sparkles, Sprout, Cookie,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { StoreProvider, useStore, rub, fmtPhone } from './store'
import { RouterProvider, useRoute, Link } from './router'
import { sendCode, checkCode, linkedChannels, setLinked, channelNames, findAccount, saveAccount, authLive, authLiveNow, messengerInfo, botLink } from './auth'
import { track, sendLead, crmEnabled, fetchOrderStatus } from './crm'
import {
  BASE, contacts, seller, products, kinds, searchHints, benefits, stats, checks, posts, contactTopics, faq, pages,
  productPath, minPrice, img, declaration, manufacturer, minAll,
} from './data'

const icons = { Drumstick, Scale, HeartPulse, ShieldCheck, Factory, BadgeCheck }
const inkBtn = 'h-11 rounded-[2px] bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-2'
const ALL = { kind: 'all', age: 'all', q: '' }
const byId = (id) => products.find((p) => p.id === id)
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const kg = (w) => parseFloat(w.replace(',', '.')) / (w.includes('кг') ? 1 : 1000)
const perKg = (v) => Math.round(v.price / kg(v.w))
const IMG = { width: 240, height: 528 } // размеры фото упаковок (против сдвига вёрстки)

export default function App({ path = '' }) {
  return (
    <RouterProvider initialPath={path}>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </RouterProvider>
  )
}

function Shell() {
  const { route, navigate } = useRoute()
  const [filter, setFilter] = useState(ALL)
  const [topic, setTopic] = useState('pick')
  const nav = useMemo(() => ({
    show: (f) => { setFilter({ ...ALL, ...f }); navigate('', { hash: 'catalog' }) },
    contact: (t) => { if (t) setTopic(t); navigate(pages.contacts.path, { hash: 'form' }) },
  }), [navigate])
  let page
  switch (route.type) {
    case 'home': page = <Home filter={filter} setFilter={setFilter} nav={nav} topic={topic} setTopic={setTopic} />; break
    case 'kind': page = <KindPage kind={route.kind} />; break
    case 'product': page = <ProductPage p={byId(route.id)} />; break
    case 'blog': page = <BlogPage />; break
    case 'post': page = <PostPage post={posts.find((x) => x.slug === route.slug)} />; break
    case 'page': page = <TextPage id={route.page} topic={topic} setTopic={setTopic} />; break
    default: page = <NotFound />
  }
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">К содержимому</a>
      <Header filter={filter} nav={nav} />
      <main id="main">{page}</main>
      <Footer nav={nav} />
      <Panels nav={nav} />
      <Messengers />
      <CookieBanner />
    </>
  )
}

/* ---------------- значки мессенджеров ---------------- */
function TgIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#27a6e5" />
      <path d="M5.4 11.7l11.1-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.2-4.7c.2-.2 0-.3-.3-.1L8.3 13.6l-2.8-.9c-.6-.2-.6-.6.1-.9z" fill="#fff" />
    </svg>
  )
}
function MaxIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs><linearGradient id="mx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4cc3ff" /><stop offset=".55" stopColor="#5b5cf6" /><stop offset="1" stopColor="#a93cf0" /></linearGradient></defs>
      <rect width="24" height="24" rx="7" fill="url(#mx)" />
      <path d="M12 5.5a6.5 6.5 0 0 0-5.6 9.8L5.6 18.4l3.2-.8A6.5 6.5 0 1 0 12 5.5z" fill="#fff" />
    </svg>
  )
}
function MessengerButtons({ className, stack }) {
  // кнопки всегда одной ширины: на телефоне — во всю ширину одна под другой, на компьютере — две равные колонки
  const c = 'flex h-11 w-full items-center gap-2 rounded-[2px] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-gray-1'
  return (
    <div className={cn('grid gap-2', !stack && 'sm:w-fit sm:grid-cols-2', className)}>
      <a href={contacts.telegram} target="_blank" rel="noopener nofollow" className={c}><TgIcon className="size-5" /> Написать в Telegram</a>
      <a href={contacts.max} target="_blank" rel="noopener nofollow" className={c}><MaxIcon className="size-5" /> Написать в Max</a>
    </div>
  )
}

/* ---------------- логотип: тот же значок, что и иконка вкладки ---------------- */
function Logo({ light, onClick }) {
  return (
    <Link to="" onClick={onClick} className="flex shrink-0 items-center gap-2.5" aria-label="Nateria — на главную">
      <Sprout className={cn('size-5 min-[400px]:size-6 sm:size-7', light ? 'text-white' : 'text-red')} strokeWidth={2.2} />
      <span className={cn('text-[15px] font-extrabold uppercase leading-none tracking-[0.14em] min-[400px]:text-[17px] sm:text-[19px] sm:tracking-[0.22em]', light && 'text-white')}>Nateria</span>
    </Link>
  )
}

/* ---------------- шапка ---------------- */
const mainNav = [
  ['Кошкам', kinds.cat.path],
  ['Собакам', kinds.dog.path],
  ['Доставка и оплата', pages.delivery.path],
  ['О бренде', pages.about.path],
  ['Блог', pages.blog.path],
  ['Вопросы', pages.faq.path],
  ['Контакты', pages.contacts.path],
]

function Header({ filter, nav }) {
  const st = useStore()
  return (
    <header className="sticky top-0 z-40 border-b border-gray-2 bg-white">
      <div className="wrap flex h-[64px] items-center gap-3 lg:h-[72px] lg:gap-6">
        {/* бургер — только на телефонах и планшетах */}
        <button className="-ml-2 flex size-11 items-center justify-center lg:hidden" onClick={() => st.setPanel('menu')} aria-label="Открыть меню"><Menu /></button>
        <Logo />
        <div className="hidden flex-1 lg:block"><SearchBox filter={filter} nav={nav} /></div>
        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <a href={contacts.phoneHref} className="mr-3 hidden text-right xl:block">
            <div className="whitespace-nowrap text-[15px] font-semibold">{contacts.phone}</div>
            <div className="text-xs text-txt-2">{contacts.hours}</div>
          </a>
          <IconBtn label="Избранное" n={st.fav.length} onClick={() => st.setPanel('fav')}><Heart /></IconBtn>
          <IconBtn label="Личный кабинет" dot={!!st.user} onClick={() => st.setPanel('profile')}><User /></IconBtn>
          <IconBtn label="Корзина" n={st.count} onClick={() => st.setPanel('cart')}><ShoppingBag /></IconBtn>
        </div>
      </div>
      <div className="wrap pb-3 lg:hidden"><SearchBox filter={filter} nav={nav} /></div>
      {/* меню разделов — только на компьютере */}
      <nav aria-label="Разделы" className="wrap hidden gap-8 pb-3 text-[15px] lg:flex">
        {mainNav.map(([l, to]) => <Link key={to} to={to} className="hover:text-violet-dark">{l}</Link>)}
      </nav>
    </header>
  )
}

const matches = (p, f) => {
  const q = (f.q || '').trim().toLowerCase()
  const hay = `${p.line} ${p.name} ${p.taste} ${p.ageLabel} ${p.weights.map((w) => w.w).join(' ')}`.toLowerCase()
  const age = !f.age || f.age === 'all' || (f.age === 'kitten' ? p.kind === 'cat' && p.age === 'young' : f.age === 'puppy' ? p.kind === 'dog' && p.age === 'young' : p.age === f.age)
  return (!f.kind || f.kind === 'all' || p.kind === f.kind) && age && (!q || q.split(/\s+/).every((w) => hay.includes(w)))
}

function SearchBox({ filter, nav }) {
  const { navigate } = useRoute()
  const [text, setText] = useState(filter.q)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const box = useRef(null)
  useEffect(() => setText(filter.q), [filter.q])
  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const q = text.trim().toLowerCase()
  const found = q ? products.filter((p) => matches(p, { q })).slice(0, 5) : []
  const hints = searchHints.filter((h) => !q || (h.includes(q) && h !== q)).slice(0, q ? 4 : 8)
  const options = [...found.map((p) => ({ t: 'p', p })), ...hints.map((h) => ({ t: 'h', h }))]
  const run = (value) => { nav.show({ q: value }); setOpen(false); setHi(-1) }
  const pick = (o) => { setOpen(false); setHi(-1); o.t === 'p' ? navigate(productPath(o.p)) : run(o.h) }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(options.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(-1, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); hi >= 0 && options[hi] ? pick(options[hi]) : run(text) }
    else if (e.key === 'Escape') setOpen(false)
  }
  return (
    <div ref={box} role="search" className="relative">
      <label className="flex h-12 items-center gap-3 rounded-[2px] border-2 border-gray-3 px-4 focus-within:border-violet lg:h-[50px]">
        <Search className="size-5 shrink-0 text-txt-2" />
        <input value={text} onChange={(e) => { setText(e.target.value); setOpen(true); setHi(-1) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          type="search" role="combobox" aria-expanded={open} aria-controls="search-list" aria-autocomplete="list" aria-label="Поиск корма"
          placeholder="Поиск: котята, щенки, говядина…" className="w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-txt-2 sm:text-[15px] [&::-webkit-search-cancel-button]:hidden" />
        {text && <button type="button" onClick={() => setText('')} aria-label="Очистить"><X className="size-4 text-txt-2" /></button>}
      </label>
      {open && (
        <div id="search-list" role="listbox" className="absolute inset-x-0 top-[56px] z-50 overflow-hidden rounded-[2px] bg-white py-2 shadow-[0_12px_40px_rgba(46,44,56,.18)]">
          {q && !found.length && <div className="px-4 py-3 text-sm text-txt-2">Ничего не нашли по «{text}»</div>}
          {found.map((p, i) => (
            <button key={p.id} role="option" aria-selected={hi === i} onMouseEnter={() => setHi(i)} onClick={() => pick(options[i])}
              className={cn('flex w-full items-center gap-3 px-4 py-2 text-left', hi === i && 'bg-gray-1')}>
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[2px]', p.bg)}><img src={img(p.id)} alt="" className="h-10 w-auto" /></span>
              <span className="min-w-0 flex-1 text-sm leading-snug"><b>{p.line}</b> <Mark text={p.name} q={q} /></span>
              <span className="shrink-0 text-sm font-bold">от {rub(minPrice(p))}</span>
            </button>
          ))}
          {!!hints.length && (
            <div className="px-4 pb-2 pt-3">
              <div className="mb-2 text-xs text-txt-2">{q ? 'Уточнить запрос' : 'Часто ищут'}</div>
              <div className="flex flex-wrap gap-2">
                {hints.map((h, j) => {
                  const i = found.length + j
                  return (
                    <button key={h} role="option" aria-selected={hi === i} onMouseEnter={() => setHi(i)} onClick={() => run(h)}
                      className={cn('rounded-full px-3 py-1.5 text-sm', hi === i ? 'bg-ink text-white' : 'bg-gray-1')}>
                      <Search className="mr-1 inline size-3.5" />{h}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Mark({ text, q }) {
  const w = q.split(/\s+/)[0]
  const i = w ? text.toLowerCase().indexOf(w) : -1
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark className="bg-violet-soft">{text.slice(i, i + w.length)}</mark>{text.slice(i + w.length)}</>
}

function IconBtn({ children, label, n, dot, onClick }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="relative flex size-11 items-center justify-center rounded-[2px] hover:bg-gray-1 [&_svg]:size-6">
      {children}
      {!!n && <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-dark px-1 text-[11px] font-bold text-white">{n}</span>}
      {dot && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-white bg-[#22c55e]" />}
    </button>
  )
}

/* ---------------- общие куски ---------------- */
function SectionTitle({ children, sub, as: H = 'h2' }) {
  return (
    <div>
      <H className="text-balance text-[28px] font-extrabold leading-[1.05] tracking-tight md:text-[40px]">{children}</H>
      {sub && <p className="mt-3 max-w-[680px] text-[17px] text-txt-2">{sub}</p>}
    </div>
  )
}

function Crumbs({ items }) {
  return (
    <nav aria-label="Навигационная цепочка" className="wrap pt-5 text-sm text-txt-2">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link to="" className="inline-block py-1 hover:text-ink">Главная</Link></li>
        {items.map(([l, to], i) => (
          <li key={l} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            {i === items.length - 1 ? <span aria-current="page" className="text-ink">{l}</span> : <Link to={to} className="inline-block py-1 hover:text-ink">{l}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ---------------- главная ---------------- */
function Home({ filter, setFilter, nav, topic, setTopic }) {
  return (
    <>
      <Hero nav={nav} />
      <Benefits />
      <Catalog filter={filter} setFilter={setFilter} title="Ассортимент" />
      <Mission />
      <Checks />
      <BlogStrip />
      <Contacts topic={topic} setTopic={setTopic} />
      <FaqList limit={4} />
      <SeoText />
    </>
  )
}

function Hero({ nav }) {
  return (
    <section className="wrap pt-5">
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 overflow-hidden border border-ink bg-white px-4 py-5 sm:block sm:min-h-[300px] sm:px-6 sm:py-10 md:min-h-[360px] md:px-14 md:py-14 xl:min-h-[440px]">
        <div className="contents sm:relative sm:z-10 sm:block sm:max-w-[380px] xl:max-w-[560px]">
          <span className="kicker hidden text-red sm:inline-block">Бесплатная доставка по СПб</span>
          <h1 className="col-span-2 text-balance text-[22px] font-extrabold leading-[1.15] tracking-tight [overflow-wrap:anywhere] sm:mt-5 sm:text-[32px] sm:leading-[1.1] xl:text-[54px]">Корма Nateria для кошек и собак в Санкт-Петербурге</h1>
          <p className="col-start-1 mt-2 self-end text-[13px] leading-snug text-txt-2 sm:hidden">15 рецептов · от {minAll} ₽ · бесплатная доставка</p>
          <p className="mt-5 hidden max-w-[470px] text-lg leading-snug sm:block xl:text-xl">
            Nateria для кошек и Nateria для собак. Есть рецепты для взрослых, котят, щенков, стерилизованных кошек, мелких пород и лечебно-профилактические линейки.
          </p>
          <div className="col-start-1 mt-3 flex min-w-0 flex-col gap-2 self-start sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link to={kinds.cat.path} className={cn(inkBtn, 'flex h-10 items-center justify-center px-3 text-[14px] sm:h-[52px] sm:px-7 sm:text-base')}>Корм для кошек</Link>
            <Link to={kinds.dog.path} className="flex h-10 items-center justify-center rounded-[2px] border border-ink bg-white px-3 text-[14px] font-semibold hover:bg-gray-1 sm:h-[52px] sm:px-7 sm:text-base">Корм для собак</Link>
          </div>
        </div>
        <div className="pointer-events-none col-start-2 row-span-2 row-start-2 mt-2 flex shrink-0 sm:hidden md:flex items-end justify-center sm:absolute sm:mt-0 sm:inset-x-0 sm:bottom-0 sm:top-0 sm:items-end sm:justify-end sm:pb-0 sm:pr-4 md:pr-6">
          <img src={img('cat-sterile-turkey-lamb')} {...IMG} alt="Упаковка корма Nateria для стерилизованных кошек" fetchPriority="high" className="relative z-10 h-auto w-[110px] drop-shadow-lg sm:w-[200px] md:w-[240px] xl:w-[320px]" />
          <img src={img('dog-small-beef-lamb')} {...IMG} alt="Упаковка корма Nateria для собак мелких пород" fetchPriority="high" className="relative z-10 ml-1 h-auto w-[110px] drop-shadow-lg sm:ml-2 sm:w-[200px] md:w-[240px] xl:w-[320px]" />
                  </div>
      </div>
      <div className="no-scrollbar mt-3 grid grid-flow-col gap-3 overflow-x-auto md:grid-cols-4">
        {[
          ['Бесплатная доставка', 'до пунктов 5Post', Truck, pages.delivery.path],
          ['Подбор корма', 'по возрасту и весу', Sparkles, null, 'pick'],
          ['Заводчикам', 'фасовки до 12 кг', Package, null, 'breeders'],
          ['Напишите нам', 'в Telegram и Max', Send, pages.contacts.path],
        ].map(([a, b, I, to, t]) => {
          const inner = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink bg-white text-red"><I className="size-5" /></span>
              <span className="flex-1"><span className="block text-[15px] font-semibold">{a}</span><span className="text-sm text-txt-2">{b}</span></span>
              <ChevronRight className="size-5 text-txt-2" />
            </>
          )
          const cls = 'flex min-w-[220px] items-center gap-3 rounded-[2px] bg-gray-1 px-3 py-3 text-left sm:min-w-[240px] sm:px-4 sm:py-4 transition-colors hover:bg-gray-2'
          return to ? <Link key={a} to={to} className={cls}>{inner}</Link> : <button key={a} onClick={() => nav.contact(t)} className={cls}>{inner}</button>
        })}
      </div>
    </section>
  )
}

function Benefits() {
  return (
    <section className="wrap py-16">
      <SectionTitle>Почему Nateria</SectionTitle>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {benefits.map((b) => {
          const I = icons[b.icon]
          return (
            <div key={b.title} className="flex gap-4 border-t border-ink py-6 pr-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[2px] border border-ink bg-white text-red"><I className="size-7" /></span>
              <div>
                <h3 className="text-lg font-bold">{b.title}</h3>
                <p className="mt-1 text-[15px] text-txt-2">{b.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Catalog({ filter, setFilter, title, fixedKind, as }) {
  const list = useMemo(() => products.filter((p) => matches(p, { ...filter, kind: fixedKind || filter.kind })), [filter, fixedKind])
  const kind = fixedKind || filter.kind
  // «котятам» и «щенкам» — отдельные кнопки; показываем только подходящие к выбранному виду
  const ages = [['all', 'Любой возраст'], ['adult', 'Взрослым'], ...(kind !== 'dog' ? [['kitten', 'Котятам']] : []), ...(kind !== 'cat' ? [['puppy', 'Щенкам']] : [])]
  const setKind = (v) => setFilter((f) => ({ ...f, kind: v, age: (v === 'cat' && f.age === 'puppy') || (v === 'dog' && f.age === 'kitten') ? 'all' : f.age }))
  return (
    <section id="catalog" className="scroll-mt-44 py-14">
      <div className="wrap">
        {title && <SectionTitle as={as}>{title}</SectionTitle>}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {!fixedKind && <Pills label="Для кого" value={filter.kind} onChange={setKind} items={[['all', 'Все корма'], ['cat', 'Кошкам'], ['dog', 'Собакам']]} />}
          <Pills label="Возраст" small value={filter.age} onChange={(v) => setFilter((f) => ({ ...f, age: v }))} items={ages} />
        </div>
        {filter.q && (
          <p className="mt-4 text-[15px]">
            По запросу «{filter.q}»: найдено {list.length}{' '}
            <button className="text-violet-dark underline" onClick={() => setFilter((f) => ({ ...f, q: '' }))}>сбросить</button>
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
          {!list.length && (
            <div className="col-span-2 rounded-[2px] bg-white p-8 text-txt-2">
              Ничего не нашли. <button className="text-violet-dark underline" onClick={() => setFilter(ALL)}>показать все корма</button>
            </div>
          )}
        </div>
        <p className="mt-6 text-xs text-txt-2">Цены указаны в рублях с НДС. Доставка до пунктов выдачи 5Post в Санкт-Петербурге — бесплатно.</p>
      </div>
    </section>
  )
}

// Фильтры — простые кнопки-переключатели (вкладки здесь не нужны: под ними нет отдельных панелей)
function Pills({ label, items, value, onChange, small }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}
          className={cn('rounded-full transition-colors', small ? 'h-9 px-4 text-sm' : 'h-10 px-5 text-[15px]',
            value === v ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-2')}>{l}</button>
      ))}
    </div>
  )
}

function ProductCard({ p }) {
  const st = useStore()
  const [vi, setVi] = useState(p.weights.length > 2 ? 1 : 0)
  const v = p.weights[vi]
  const qty = st.qtyOf(p.id, v.w)
  const faved = st.fav.includes(p.id)
  const compared = st.compare.includes(p.id)
  return (
    <article className="flex flex-col rounded-[2px] bg-white p-3 shadow-card sm:p-4">
      <div className={cn('relative flex h-[190px] items-center justify-center overflow-hidden rounded-[2px] sm:h-[250px]', p.bg)}>
        <Link to={productPath(p)} className="flex h-full w-full items-center justify-center p-3 sm:p-4" tabIndex={-1} aria-hidden>
          <img src={img(p.id)} {...IMG} loading="lazy" alt={`${p.line} — ${p.short}, ${p.taste}`} className="h-full w-auto object-contain transition hover:scale-105" />
        </Link>
        <span className="absolute left-2 top-2 rounded-[2px] border border-ink bg-white/90 px-2 py-1 text-xs font-bold sm:left-3 sm:top-3">{p.kind === 'cat' ? 'Кошкам' : 'Собакам'}</span>
        <FavBtn faved={faved} onClick={() => st.toggleFav(p.id)} />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[19px] font-extrabold sm:text-[22px]">{rub(v.price)}</span>
        <span className="text-xs text-txt-2">{rub(perKg(v))}/кг</span>
      </div>
      <h3 className="mt-1 text-sm leading-snug sm:text-[15px]">
        <Link to={productPath(p)} className="hover:text-violet-dark"><b>{p.line}</b> {p.name}</Link>
      </h3>
      {p.composition && (
        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-xs text-txt-2">{p.composition.top}</p>
          <button type="button" onClick={() => st.toggleCompare(p.id)} aria-pressed={compared} className={cn('flex-none rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', compared ? 'bg-violet-dark text-white' : 'bg-gray-1 text-txt-2 hover:bg-gray-2')}>{compared ? '✓ в сравнении' : 'сравнить состав'}</button>
        </div>
      )}
      <div className="mt-auto flex gap-1.5 pt-3" role="group" aria-label="Фасовка">
        {p.weights.map((w, i) => (
          <button key={w.w} onClick={() => setVi(i)} aria-pressed={i === vi} className={cn('h-9 min-w-0 flex-1 whitespace-nowrap rounded-[2px] border px-1 text-sm sm:flex-none sm:px-3', i === vi ? 'border-ink bg-ink text-white' : 'border-gray-3 hover:border-ink')}>{w.w}</button>
        ))}
      </div>
      <div className="pt-3">
        <Buy p={p} v={v} qty={qty} />
      </div>
    </article>
  )
}

function Buy({ p, v, qty, big }) {
  const st = useStore()
  return qty ? (
    <div className={cn('flex items-center justify-between rounded-[2px] bg-gray-1', big ? 'h-[52px]' : 'h-11')}>
      <button className="flex size-11 items-center justify-center" onClick={() => st.setQty(`${p.id}|${v.w}`, qty - 1)} aria-label="Меньше"><Minus className="size-4" /></button>
      <span className="text-sm font-semibold">{qty} в корзине</span>
      <button className="flex size-11 items-center justify-center" onClick={() => st.setQty(`${p.id}|${v.w}`, qty + 1)} aria-label="Больше"><Plus className="size-4" /></button>
    </div>
  ) : (
    <Button onClick={() => st.add(p, v)} className={cn(inkBtn, 'w-full gap-2', big ? 'h-[52px] text-base' : 'h-11')}><ShoppingBag className="size-4" /> В корзину</Button>
  )
}

function FavBtn({ faved, onClick, className }) {
  return (
    <button onClick={onClick} aria-label={faved ? 'Убрать из избранного' : 'В избранное'} aria-pressed={faved}
      className={cn('absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-white/90 hover:bg-white sm:right-3 sm:top-3', className)}>
      <Heart className={cn('size-5', faved && 'fill-tang text-tang')} />
    </button>
  )
}

function Mission() {
  return (
    <section className="wrap py-16">
      <div className="grid overflow-hidden border border-ink bg-white text-ink md:grid-cols-[1.2fr_1fr]">
        <div className="p-8 md:p-14">
          <span className="kicker text-red">О бренде</span>
          <h2 className="mt-4 text-[28px] font-extrabold leading-[1.08] md:text-[42px]">Сухие корма Саратовского кормового завода</h2>
          <p className="mt-6 max-w-[520px] text-lg text-txt-2">
            Полнорационные рецепты с мясом для кошек и собак разного возраста. Мы продаём их в Петербурге и бесплатно привозим в пункты 5Post.
          </p>
          <Link to={pages.about.path} className="mt-6 inline-flex items-center gap-1 font-semibold text-red hover:text-ink">О бренде и производителе <ChevronRight className="size-4" /></Link>
        </div>
        <div className="flex min-h-[260px] items-center justify-center border-t border-ink md:border-l md:border-t-0">
          <div className="grid w-full max-w-[420px] grid-cols-2 gap-3 p-5 text-center sm:p-8">
            {stats.map(([n, l]) => (
              <div key={l} className="stat min-w-0 px-2 py-5 [container-type:inline-size]">
                <div className="contour whitespace-nowrap text-[min(21cqw,44px)]">{n}</div>
                <div className="mt-2 text-sm lowercase text-txt-2">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Checks() {
  return (
    <section className="py-16">
      <div className="wrap">
        <SectionTitle>Как проверяют корм</SectionTitle>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map((c) => (
            <div key={c.n} className="rounded-[2px] bg-gray-1 p-6">
              <div className="contour text-[52px]">{c.n}</div>
              <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
              <p className="mt-1 text-[15px] text-txt-2">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PostCard({ p, H = 'h3' }) {
  return (
    <Link to={`blog/${p.slug}/`} className="group flex min-w-[260px] flex-col overflow-hidden lg:min-w-0 rounded-[2px] border border-gray-2 bg-white text-left transition hover:shadow-card">
      <div className={cn('flex h-[150px] items-end justify-center overflow-hidden', p.tone)}>
        <img src={img(p.img)} {...IMG} loading="lazy" alt="" className="h-[130px] w-auto translate-y-3 transition group-hover:translate-y-0" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="w-fit rounded-full bg-gray-1 px-2.5 py-0.5 text-xs lowercase">{p.tag}</span>
        <H className="mt-3 text-lg font-bold leading-snug">{p.title}</H>
        <p className="mt-2 text-sm text-txt-2">{p.text}</p>
        
      </div>
    </Link>
  )
}

// Кнопка «Все статьи»: пока ведёт на страницу блога, когда появится канал в Дзене — укажите contacts.dzen
function AllPosts({ className }) {
  const cls = cn('inline-flex h-11 shrink-0 items-center gap-1 rounded-[2px] bg-gray-1 px-5 text-sm font-semibold transition-colors hover:bg-gray-2', className)
  const inner = <>Все статьи <ChevronRight className="size-4" /></>
  return contacts.dzen ? <a href={contacts.dzen} target="_blank" rel="noopener" className={cls}>{inner}</a> : <Link to={pages.blog.path} className={cls}>{inner}</Link>
}

function BlogStrip() {
  return (
    <section className="wrap py-16">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle>Блог о питании</SectionTitle>
        <AllPosts className="hidden sm:inline-flex" />
      </div>
      <div className="no-scrollbar mt-8 grid grid-flow-col gap-4 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-4">
        {posts.map((p) => <PostCard key={p.slug} p={p} />)}
      </div>
      <AllPosts className="mt-4 w-full justify-center sm:hidden" />
    </section>
  )
}

/* ---------------- формы ---------------- */
function Consent({ checked, onChange, err }) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-txt-2">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5 data-[state=checked]:border-ink data-[state=checked]:bg-ink" />
      <span>
        Даю <Link to={pages.consent.path} className="underline hover:text-ink">согласие на обработку персональных данных</Link> и принимаю{' '}
        <Link to={pages.privacy.path} className="underline hover:text-ink">политику конфиденциальности</Link>
        {err && <b className="text-destructive"> — {err}</b>}
      </span>
    </label>
  )
}

function LeadForm({ topic, compact, onSubmit, cta = 'Отправить', doneText }) {
  const st = useStore()
  // галочка согласия НЕ стоит заранее — согласие должно быть активным действием (152-ФЗ)
  const [f, setF] = useState({ name: st.user?.name || '', phone: st.user?.phone || '', msg: '', ok: false })
  const [err, setErr] = useState({})
  const [state, setState] = useState('form')
  const sending = useRef(false) // защита от двойного нажатия: второй заказ не уйдёт
  const submit = (e) => {
    e.preventDefault()
    if (sending.current) return
    const er = {}
    if (f.name.trim().length < 2) er.name = 'Введите имя'
    if (f.phone.replace(/\D/g, '').length !== 11) er.phone = 'Введите телефон полностью'
    if (!f.ok) er.ok = 'нужно согласие'
    setErr(er)
    if (Object.keys(er).length) return
    sending.current = true
    setState('send')
    setTimeout(() => {
      if (onSubmit) onSubmit({ name: f.name.trim(), phone: f.phone })
      else sendLead({ name: f.name.trim(), phone: f.phone, topic, msg: f.msg.trim() }) // заявка → CRM
      setState('done')
    }, 700)
  }
  if (state === 'done')
    return (
      <div className="rounded-[2px] bg-white p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-violet-dark text-white"><Check className="size-7" /></div>
        <h3 className="mt-4 text-2xl font-extrabold">Спасибо, {f.name.trim()}!</h3>
        <p className="mt-2 text-txt-2">{doneText || 'Спасибо, скоро ответим.'}{crmEnabled ? '' : ' Это демо — заявка никуда не ушла.'}</p>
      </div>
    )
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field err={err.name} label="Имя"><Input autoComplete="name" placeholder="Имя" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!err.name} className="h-12 rounded-[2px] bg-white text-[16px]" /></Field>
        <Field err={err.phone} label="Телефон"><Input type="tel" autoComplete="tel" placeholder="Телефон" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: fmtPhone(e.target.value) })} aria-invalid={!!err.phone} className="h-12 rounded-[2px] bg-white text-[16px]" /></Field>
      </div>
      {!compact && <Textarea aria-label="Сообщение" placeholder={topic === 'order' ? 'Номер заказа и что случилось' : 'Сообщение (необязательно)'} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} className="min-h-24 rounded-[2px] bg-white text-[16px]" />}
      <Consent checked={f.ok} onChange={(ok) => setF({ ...f, ok })} err={err.ok} />
      <Button type="submit" disabled={state === 'send'} className={cn(inkBtn, 'h-12 w-full sm:w-auto sm:px-10')}>
        {state === 'send' ? <Loader2 className="animate-spin" /> : <><Send className="size-4" />{cta}</>}
      </Button>
    </form>
  )
}

function Field({ err, label, children }) {
  return <label className="block"><span className="sr-only">{label}</span>{children}{err && <span className="mt-1 block text-xs text-destructive">{err}</span>}</label>
}

function Contacts({ topic, setTopic, as = 'h2', title = 'Связаться с нами' }) {
  return (
    <section id="form" className="scroll-mt-44 py-16">
      <div className="wrap">
        <SectionTitle as={as}>{title}</SectionTitle>
        <Tabs value={topic} onValueChange={setTopic} className="mt-6 gap-6">
          <TabsList className="no-scrollbar h-10 w-full touch-pan-x justify-start gap-2 overflow-x-auto overflow-y-hidden bg-transparent p-0 group-data-horizontal/tabs:h-10">
            {contactTopics.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-10 flex-none rounded-full border-0 bg-white px-5 text-[15px] text-ink shadow-none data-[state=active]:bg-violet-dark data-[state=active]:text-white">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {/* все вкладки лежат друг на друге: блок всегда высотой с самую большую, при переключении ничего не прыгает */}
          <div className="grid">
          {contactTopics.map((t) => (
            <TabsContent key={t.id} value={t.id} forceMount inert={t.id !== topic} className={cn('[grid-area:1/1] mt-0', t.id !== topic && 'invisible')}>
              <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] md:gap-10">
                <div>
                  <h3 className="text-2xl font-extrabold">{cap(t.label)}</h3>
                  <p className="mt-3 text-[17px] leading-relaxed text-txt-2">{t.text}</p>
                  <p className="mt-4 text-[15px]">Заполните форму или напишите нам — <b>ответим в течение дня</b>.</p>
                  <MessengerButtons className="mt-5" />
                  <div className="mt-6 space-y-2 text-[15px]">
                    <a href={contacts.phoneHref} className="flex items-center gap-2 font-semibold"><Phone className="size-4" />{contacts.phone}</a>
                    <div className="flex items-center gap-2 text-txt-2"><Clock className="size-4" />{contacts.hours}</div>
                  </div>
                </div>
                <LeadForm topic={t.id} doneText={t.done} />
              </div>
            </TabsContent>
          ))}
          </div>
        </Tabs>
      </div>
    </section>
  )
}

// Вопросы — нативный <details>: ответы есть в HTML, поисковик их видит
function FaqList({ limit, as = 'h2', title = 'Частые вопросы' }) {
  const list = limit ? faq.slice(0, limit) : faq
  return (
    <section className="wrap py-16">
      <SectionTitle as={as}>{title}</SectionTitle>
      <div className="mt-6 max-w-[900px] divide-y divide-gray-2 border-y border-gray-2">
        {list.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}<Plus className="size-5 shrink-0 transition group-open:rotate-45" />
            </summary>
            <p className="pb-5 text-[15px] leading-relaxed text-txt-2">{f.a}</p>
          </details>
        ))}
      </div>
      {limit && <Link to={pages.faq.path} className="mt-5 inline-flex items-center gap-1 font-semibold text-violet-dark">Все вопросы <ChevronRight className="size-4" /></Link>}
    </section>
  )
}

function SeoText() {
  return (
    <section className="wrap pb-16">
      <div className="max-w-[900px] text-[15px] leading-relaxed text-txt-2">
        <h2 className="mb-3 text-xl font-bold text-ink">Купить корм Nateria в Санкт-Петербурге</h2>
        <p>
          В нашем магазине — вся линейка сухих кормов Nateria от Саратовского кормового завода: восемь рецептов для кошек и семь рецептов для собак, включая гипоаллергенные
          рационы, корма для чувствительного пищеварения и профилактики МКБ. Корма для кошек продаются в пакетах 400 г, 1,5 кг и 10 кг, для собак — 0,5–2 кг и 5–12 кг.
          Доставка бесплатная: привезём заказ в пункт выдачи 5Post в Санкт-Петербурге — постамат или кассу «Пятёрочки» и «Перекрёстка».
        </p>
      </div>
    </section>
  )
}

/* ---------------- категория ---------------- */
/* Блок занимает высоту большего из двух текстов (кошки/собаки), чтобы при переключении страница не прыгала.
   Второй текст — только в CSS (::after, невидимый), его не читают ни поисковики, ни экранные дикторы. */
function Steady({ as: Tag = 'span', className, text, other }) {
  return <Tag className={cn('steady', className)} data-other={other}><span>{text}</span></Tag>
}

function KindPage({ kind }) {
  const k = kinds[kind]
  const other = kinds[kind === 'cat' ? 'dog' : 'cat'] || k
  const [filter, setFilter] = useState(ALL)
  useEffect(() => setFilter(ALL), [kind])
  return (
    <>
      <Crumbs items={[[k.menu, k.path]]} />
      <div className="wrap pb-8 pt-4">
        <Steady as="h1" className="text-[30px] font-extrabold leading-tight tracking-tight md:text-[44px]" text={k.h1} other={other.h1} />
        <Steady as="p" className="mt-3 max-w-[760px] text-[17px] text-txt-2" text={k.intro} other={other.intro} />
      </div>
      <Catalog filter={filter} setFilter={setFilter} fixedKind={kind} title={<Steady text={`Все рецепты ${k.h1.split(' ').pop()}`} other={`Все рецепты ${other.h1.split(' ').pop()}`} />} />
      <section className="wrap py-14">
        <h2 className="text-2xl font-extrabold">Другие корма</h2>
        <Link to={kinds[kind === 'cat' ? 'dog' : 'cat'].path} className="mt-3 inline-flex items-center gap-1 font-semibold text-violet-dark">
          {kinds[kind === 'cat' ? 'dog' : 'cat'].h1} <ChevronRight className="size-4" />
        </Link>
      </section>
    </>
  )
}

/* ---------------- карточка товара ---------------- */
function ProductPage({ p }) {
  const st = useStore()
  const k = kinds[p.kind]
  const [vi, setVi] = useState(p.weights.length > 2 ? 1 : 0)
  useEffect(() => setVi(p.weights.length > 2 ? 1 : 0), [p])
  useEffect(() => track('view_product', { id: p.id }), [p.id])
  const v = p.weights[vi]
  const related = products.filter((x) => x.kind === p.kind && x.id !== p.id)
  const specs = [
    ['Вкус', p.taste],
    ['Для кого', p.ageLabel],
    ['Тип корма', 'сухой полнорационный'],
    ['Фасовки', p.weights.map((w) => w.w).join(', ')],
    ['Штрихкод', v.gtin],
    ['Срок годности', '18 месяцев'],
    ['Производитель', manufacturer],
    ['Декларация', declaration],
    ['Маркировка', '«Честный знак»'],
  ]
  return (
    <>
      <Crumbs items={[[k.menu, k.path], [cap(p.short), productPath(p)]]} />
      <article className="wrap grid gap-8 pb-14 pt-5 md:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className={cn('relative flex h-[360px] items-center justify-center rounded-[2px] p-6 md:h-[520px]', p.bg)}>
          <img src={img(p.id)} {...IMG} fetchPriority="high" alt={`Упаковка ${p.line} — ${p.short}, ${p.taste}`} className="h-full w-auto object-contain drop-shadow-xl" />
          <FavBtn faved={st.fav.includes(p.id)} onClick={() => st.toggleFav(p.id)} className="right-4 top-4 sm:right-4 sm:top-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-violet-dark">{p.line}</span>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.1] tracking-tight md:text-[36px]">{p.name}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-txt-2">{p.text}</p>
          <div className="mt-6 text-sm text-txt-2">Фасовка</div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Фасовка">
            {p.weights.map((w, i) => (
              <button key={w.w} onClick={() => setVi(i)} aria-pressed={i === vi} className={cn('flex h-14 flex-col items-start justify-center rounded-[2px] border px-4 text-left', i === vi ? 'border-ink bg-ink text-white' : 'border-gray-3 hover:border-ink')}>
                <span className="text-[15px] font-semibold">{w.w}</span>
                <span className={cn('text-xs', i === vi ? 'text-white/75' : 'text-txt-2')}>{rub(w.price)}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-[34px] font-extrabold leading-none">{rub(v.price)}</span>
            <span className="text-sm text-txt-2">{rub(perKg(v))}/кг</span>
          </div>
          <div className="mt-5 max-w-[420px]"><Buy p={p} v={v} qty={st.qtyOf(p.id, v.w)} big /></div>
          <div className="mt-5 flex items-start gap-3 rounded-[2px] bg-gray-1 p-4 text-sm">
            <Truck className="mt-0.5 size-5 shrink-0 text-violet-dark" />
            <div>Бесплатная доставка до пунктов выдачи 5Post в Санкт-Петербурге. <Link to={pages.delivery.path} className="text-violet-dark underline">Условия доставки</Link></div>
          </div>
          <h2 className="mt-8 text-xl font-extrabold">Характеристики</h2>
          <dl className="mt-3 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2 text-[15px]">
            {specs.map(([a, b]) => <div key={a} className="contents"><dt className="text-txt-2">{a}</dt><dd>{b}</dd></div>)}
          </dl>
          <h2 className="mt-8 text-xl font-extrabold">Описание</h2>
          <p className="mt-3 text-[15px] leading-relaxed">{p.more}</p>
          {p.composition ? (
            <>
              <h2 className="mt-8 text-xl font-extrabold">Состав</h2>
              <p className="mt-3 text-[15px] leading-relaxed">{p.composition.full}</p>
              <h2 className="mt-8 text-xl font-extrabold">Гарантированный анализ, на 100 г</h2>
              <dl className="mt-3 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-2 text-[15px]">
                <div className="contents"><dt className="text-txt-2">Белки</dt><dd>{p.composition.analysis.protein}</dd></div>
                <div className="contents"><dt className="text-txt-2">Жиры</dt><dd>{p.composition.analysis.fat}</dd></div>
                <div className="contents"><dt className="text-txt-2">Клетчатка</dt><dd>{p.composition.analysis.fiber}</dd></div>
                <div className="contents"><dt className="text-txt-2">Зола</dt><dd>{p.composition.analysis.ash}</dd></div>
                <div className="contents"><dt className="text-txt-2">Кальций</dt><dd>{p.composition.analysis.calcium}</dd></div>
                <div className="contents"><dt className="text-txt-2">Фосфор</dt><dd>{p.composition.analysis.phosphorus}</dd></div>
                <div className="contents"><dt className="text-txt-2">Энергетическая ценность</dt><dd>{p.composition.analysis.kcal} ккал/100 г</dd></div>
              </dl>
              <p className="mt-3 text-sm text-txt-2">Таблица суточной нормы — на упаковке. Свежая вода должна быть в доступе всегда.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-txt-2">Состав, гарантированный анализ и таблица суточной нормы указаны на упаковке. Свежая вода должна быть в доступе всегда.</p>
          )}
        </div>
      </article>
      <section className="py-14">
        <div className="wrap">
          <h2 className="text-[26px] font-extrabold md:text-[32px]">Другие корма {p.line}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{related.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </div>
      </section>
    </>
  )
}

/* ---------------- блог ---------------- */
function BlogPage() {
  return (
    <>
      <Crumbs items={[['Блог', pages.blog.path]]} />
      <section className="wrap pb-16 pt-4">
        <SectionTitle as="h1" sub={pages.blog.desc}>{pages.blog.h1}</SectionTitle>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{posts.map((p) => <PostCard key={p.slug} p={p} H="h2" />)}</div>
      </section>
    </>
  )
}

function PostPage({ post }) {
  const rel = post.rel.map(byId)
  return (
    <>
      <Crumbs items={[['Блог', pages.blog.path], [post.title, `blog/${post.slug}/`]]} />
      <article className="wrap max-w-[820px] pb-12 pt-4">
        <span className="rounded-full bg-gray-1 px-2.5 py-0.5 text-xs lowercase">{post.tag}</span>
        <h1 className="mt-4 text-[30px] font-extrabold leading-tight tracking-tight md:text-[42px]">{post.title}</h1>
        <p className="mt-4 text-lg text-txt-2">{post.text}</p>
        <div className="mt-6 space-y-4 text-[17px] leading-relaxed">{post.body.map((t) => <p key={t}>{t}</p>)}</div>
      </article>
      <section className="py-14">
        <div className="wrap">
          <h2 className="text-2xl font-extrabold">Корма по теме</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{rel.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </div>
      </section>
    </>
  )
}

/* ---------------- текстовые страницы ---------------- */
function TextPage({ id, topic, setTopic }) {
  const pg = pages[id]
  if (id === 'faq') return <><Crumbs items={[[pg.h1, pg.path]]} /><FaqList as="h1" title={pg.h1} /></>
  if (id === 'contacts')
    return (
      <>
        <Crumbs items={[[pg.h1, pg.path]]} />
        <section className="wrap pb-10 pt-4">
          <SectionTitle as="h1" sub="Интернет-магазин кормов Nateria в Санкт-Петербурге. Отвечаем на вопросы о корме, заказе и доставке.">{pg.h1}</SectionTitle>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[2px] bg-gray-1 p-6">
              <div className="text-sm text-txt-2">Телефон</div>
              <a href={contacts.phoneHref} className="mt-1 block text-xl font-bold">{contacts.phone}</a>
              <div className="mt-1 text-sm text-txt-2">{contacts.hours}</div>
            </div>
            <div className="rounded-[2px] bg-gray-1 p-6">
              <div className="text-sm text-txt-2">Мессенджеры</div>
              <MessengerButtons className="mt-3" stack />
            </div>
            <div className="rounded-[2px] bg-gray-1 p-6">
              <div className="text-sm text-txt-2">Продавец</div>
              <div className="mt-1 text-[15px]">{seller.name}<br />ОГРН {seller.ogrn}, ИНН {seller.inn}<br />{seller.address}</div>
              <div className="mt-2 text-sm"><a href={`mailto:${contacts.email}`} className="underline">{contacts.email}</a></div>
            </div>
          </div>
        </section>
        <Contacts topic={topic} setTopic={setTopic} title="Написать нам" />
      </>
    )
  return (
    <>
      <Crumbs items={[[pg.h1, pg.path]]} />
      <section className="wrap max-w-[860px] pb-16 pt-4">
        <SectionTitle as="h1">{pg.h1}</SectionTitle>
        <div className="mt-8 space-y-6">
          {pg.body.map(([h, t]) => (
            <div key={h}>
              <h2 className="text-xl font-bold">{h}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-txt-2">{t}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function NotFound() {
  return (
    <section className="wrap py-24 text-center">
      <h1 className="text-[40px] font-extrabold">Страница не найдена</h1>
      <p className="mt-3 text-lg text-txt-2">Такой страницы нет. Возможно, адрес изменился.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={kinds.cat.path} className={cn(inkBtn, 'flex items-center')}>Корм для кошек</Link>
        <Link to={kinds.dog.path} className={cn(inkBtn, 'flex items-center')}>Корм для собак</Link>
      </div>
    </section>
  )
}

/* ---------------- подвал ---------------- */
function Footer({ nav }) {
  const cols = [
    ['Покупателям', [['Доставка и оплата', pages.delivery.path], ['Возврат и обмен', pages.returns.path], ['Частые вопросы', pages.faq.path], ['Контакты', pages.contacts.path]]],
    ['О бренде', [['О бренде и заводе', pages.about.path], ['Блог о питании', pages.blog.path], ['Заводчикам', null, 'breeders'], ['Оптовым покупателям', null, 'sales']]],
    ['Каталог', [['Корм для кошек', kinds.cat.path], ['Корм для собак', kinds.dog.path], ['Корм для котят', productPath(byId('cat-kitten-turkey-rosemary'))], ['Корм для щенков', productPath(byId('dog-puppy-turkey'))]]],
  ]
  return (
    <footer className="bg-ink pb-24 pt-14 text-white md:pb-10">
      <div className="wrap grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm text-white/70">Сухие корма Nateria для кошек и собак с бесплатной доставкой до пунктов 5Post в Санкт-Петербурге.</p>
        </div>
        {cols.map(([h, ls]) => (
          <div key={h}>
            <div className="mb-3 font-semibold">{h}</div>
            <ul className="space-y-1 text-sm text-white/70">
              {ls.map(([l, to, t]) => (
                <li key={l}>{to ? <Link to={to} className="inline-block py-1.5 hover:text-white">{l}</Link> : <button onClick={() => nav.contact(t)} className="py-1.5 text-left hover:text-white">{l}</button>}</li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <div className="mb-3 font-semibold">Поговорим про питомцев</div>
          <a href={contacts.phoneHref} className="whitespace-nowrap text-[15px] font-bold min-[380px]:text-lg sm:text-2xl">{contacts.phone}</a>
          <p className="mt-1 text-sm text-white/70">{contacts.hours}</p>
          <div className="mt-4 flex gap-3">
            <a href={contacts.telegram} target="_blank" rel="noopener nofollow" aria-label="Telegram" className="transition hover:scale-110 hover:opacity-90"><TgIcon className="size-11" /></a>
            <a href={contacts.max} target="_blank" rel="noopener nofollow" aria-label="Max" className="transition hover:scale-110 hover:opacity-90"><MaxIcon className="size-11" /></a>
          </div>
        </div>
      </div>
      <div className="wrap mt-10 space-y-2 border-t border-white/10 pt-6 text-xs text-white/55">
        <p>Продавец: {seller.name}, ОГРН {seller.ogrn}, ИНН {seller.inn}, {seller.address}. Производитель кормов — {manufacturer}.</p>
        <p>
          Цены указаны в рублях с НДС. Сайт носит информационный характер и не является публичной офертой.{' '}
          <Link to={pages.privacy.path} className="underline hover:text-white">Политика конфиденциальности</Link> ·{' '}
          <Link to={pages.consent.path} className="underline hover:text-white">Согласие на обработку данных</Link>
        </p>
        <p>© 2026 Nateria, Санкт-Петербург. Демонстрационный сайт.{' '}<button onClick={() => window.dispatchEvent(new Event('hv-cookies'))} className="underline hover:text-white">Настройки cookie</button></p>
      </div>
    </footer>
  )
}

/* ---------------- плавающие мессенджеры ---------------- */
function Messengers() {
  const st = useStore()
  const lifted = !!st.compare.length && st.panel !== 'compare' // на телефоне внизу плашка «Сравнить состав» — встаём над ней
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const out = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  const item = 'flex w-full items-center gap-2 rounded-full bg-white py-2 pl-2 pr-4 text-sm font-semibold shadow-[0_6px_24px_rgba(46,44,56,.2)] hover:bg-gray-1'
  return (
    <div ref={box} className={cn('fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2 transition-[bottom]', lifted && 'max-sm:bottom-[76px]')}>
      {open && (
        <div className="grid w-[156px] gap-2">
          <a href={contacts.telegram} target="_blank" rel="noopener nofollow" onClick={() => setOpen(false)} className={item}><TgIcon className="size-8" />Telegram</a>
          <a href={contacts.max} target="_blank" rel="noopener nofollow" onClick={() => setOpen(false)} className={item}><MaxIcon className="size-8" />Max</a>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label={open ? 'Закрыть' : 'Написать нам'} aria-expanded={open}
        className="flex size-12 items-center justify-center gap-2 rounded-full bg-violet-dark font-semibold text-white hover:bg-ink sm:h-14 sm:w-auto sm:px-5">
        {open ? <X className="size-5" /> : <Send className="size-5" />}<span className="hidden sm:inline">{open ? 'Закрыть' : 'Написать нам'}</span>
      </button>
    </div>
  )
}

/* ---------------- баннер cookie и персональных данных (152-ФЗ) ---------------- */
function CookieBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try { if (!localStorage.getItem('hv-cookies')) setShow(true) } catch { setShow(true) }
    const reopen = () => setShow(true)
    window.addEventListener('hv-cookies', reopen)
    return () => window.removeEventListener('hv-cookies', reopen)
  }, [])
  const save = (v) => { try { localStorage.setItem('hv-cookies', JSON.stringify({ v, at: new Date().toISOString() })) } catch { /* пусто */ } setShow(false); window.dispatchEvent(new Event('hv-consent')) }
  if (!show) return null
  const policy = <Link to={pages.privacy.path} className="text-violet-dark underline">политике конфиденциальности</Link>
  return (
    <div role="region" aria-label="Cookie и персональные данные"
      className="fixed inset-x-2 bottom-2 z-50 rounded-[2px] bg-white p-3 shadow-[0_8px_30px_rgba(46,44,56,.22)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[460px] sm:rounded-[2px] sm:p-5">
      {/* телефон: одна короткая строка и две маленькие кнопки */}
      <div className="flex items-center gap-2 sm:hidden">
        <p className="flex-1 text-[12px] leading-snug text-txt-2">Мы используем cookie и обрабатываем персональные данные. Подробнее — в {policy}.</p>
        <button onClick={() => save('all')} className="h-10 shrink-0 rounded-[2px] bg-ink px-5 text-[14px] font-semibold text-white">Ок</button>
      </div>
      {/* компьютер и планшет */}
      <div className="hidden sm:block">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 size-6 shrink-0 text-violet-dark" aria-hidden />
          <div>
            <div className="font-bold">Мы используем cookie</div>
            <p className="mt-1 text-sm text-txt-2">Используем cookie и обрабатываем персональные данные, чтобы работали корзина и личный кабинет. Подробнее — в {policy}.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => save('all')} className={cn(inkBtn, 'flex-1')}>Принять</Button>
          <Button onClick={() => save('necessary')} variant="ghost" className="h-11 flex-1 rounded-[2px] bg-gray-1 text-sm font-semibold hover:bg-gray-2">Только необходимые</Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- боковые панели ---------------- */
/* Сравнение: корма — столбцами, показатели — строками. Цифры видно сразу рядом, длинный состав — по кнопке. */
const compareRows = [['Белки', 'protein'], ['Жиры', 'fat'], ['Клетчатка', 'fiber'], ['Зола', 'ash'], ['Ккал/100г', 'kcal']]
function CompareTable({ ids, onRemove, onOpen }) {
  const [full, setFull] = useState(false)
  const items = ids.map(byId).filter(Boolean)
  const n = items.length
  // 1–2 корма помещаются на любом телефоне; 3–4 — листаются вбок
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(${n > 2 ? 132 : 0}px, 1fr))` }
  const Label = ({ children }) => <div className="col-span-full mt-2 border-t border-gray-2 pt-1.5 text-xs text-txt-2"><span className="sticky left-0">{children}</span></div>
  const val = (p, k) => p.composition?.analysis?.[k] || '—'
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-1">
      <div className="grid gap-x-3 text-sm [overflow-wrap:anywhere]" style={cols}>
        {items.map((p) => (
          <div key={p.id} className="relative flex min-w-0 flex-col items-start gap-2 rounded-[2px] bg-gray-1 p-3">
            <button onClick={() => onRemove(p.id)} aria-label="Убрать из сравнения" className="absolute right-2 top-2 text-txt-2 hover:text-ink"><X className="size-4" /></button>
            <div className={cn('flex size-10 flex-none items-center justify-center rounded-[2px] p-1', p.bg)}><img src={img(p.id)} alt="" className="max-h-full w-auto" /></div>
            <Link to={productPath(p)} onClick={onOpen} className="min-w-0 leading-snug hover:text-violet-dark"><b>{p.line}</b><br />{p.ageLabel}, {p.taste}</Link>
          </div>
        ))}
        <Label>Главное в составе</Label>
        {items.map((p) => <div key={p.id} className="min-w-0 leading-snug">{p.composition?.top || '—'}</div>)}
        {compareRows.map(([t, k]) => (
          <Fragment key={k}>
            <Label>{t}</Label>
            {items.map((p) => <div key={p.id} className="font-bold">{val(p, k)}</div>)}
          </Fragment>
        ))}
        <div className="col-span-full mt-2 border-t border-gray-2 pt-2">
          <button onClick={() => setFull(!full)} aria-expanded={full} className="sticky left-0 text-sm font-semibold underline hover:text-violet-dark">{full ? 'Скрыть полный состав' : 'Показать полный состав'}</button>
        </div>
        {full && items.map((p) => <p key={p.id} className="mt-2 min-w-0 text-xs leading-relaxed">{p.composition?.full || 'Полный состав запросили у производителя, скоро добавим.'}</p>)}
      </div>
    </div>
  )
}

function Panels({ nav }) {
  const st = useStore()
  const close = () => st.setPanel(null)
  const side = 'flex w-full flex-col gap-0 p-0 sm:max-w-[440px]'
  const head = (t, d) => (
    <SheetHeader className="border-b border-gray-2 p-5">
      <SheetTitle className="text-2xl font-extrabold">{t}</SheetTitle>
      <SheetDescription>{d}</SheetDescription>
    </SheetHeader>
  )
  const favs = products.filter((p) => st.fav.includes(p.id))
  const toCatalog = ['В каталог', () => { close(); nav.show({}) }]
  return (
    <>
      <Sheet open={st.panel === 'cart'} onOpenChange={(o) => !o && close()}>
        <SheetContent className={side}>
          {head('Корзина', st.count ? `${st.count} шт. на ${rub(st.total)}` : 'Здесь пока пусто')}
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {!st.items.length && <Empty icon={ShoppingBag} text="Добавьте корм из каталога" action={toCatalog} />}
            {st.items.map((i) => (
              <div key={i.key} className="flex gap-3 rounded-[2px] bg-gray-1 p-3">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-[2px] bg-white p-1"><img src={img(i.id)} alt="" className="max-h-full w-auto" /></div>
                <div className="flex flex-1 flex-col">
                  <div className="text-sm leading-snug"><b>{i.line}</b> {i.name} · {i.w}</div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-[2px] bg-white">
                      <button className="flex size-8 items-center justify-center" onClick={() => st.setQty(i.key, i.qty - 1)} aria-label="Меньше"><Minus className="size-3.5" /></button>
                      <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                      <button className="flex size-8 items-center justify-center" onClick={() => st.setQty(i.key, i.qty + 1)} aria-label="Больше"><Plus className="size-3.5" /></button>
                    </div>
                    <span className="font-bold">{rub(i.price * i.qty)}</span>
                  </div>
                </div>
                <button onClick={() => st.setQty(i.key, 0)} aria-label="Удалить" className="self-start text-txt-2 hover:text-ink"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          {!!st.items.length && (
            <div className="border-t border-gray-2 p-5">
              <div className="mb-3 flex items-center gap-2 rounded-[2px] bg-violet-soft px-3 py-2 text-sm"><Truck className="size-4 text-violet-dark" />Бесплатная доставка до пункта 5Post</div>
              <PromoBox />
              <div className="mb-4 space-y-1 text-lg">
                {st.discount > 0 && <div className="flex justify-between text-sm text-txt-2"><span>Скидка по промокоду {st.promo.code}</span><span>−{rub(st.discount)}</span></div>}
                <div className="flex justify-between"><span>Итого</span><b>{rub(st.discount ? st.totalWithDiscount : st.total)}</b></div>
              </div>
              <Button onClick={() => { close(); track('checkout_start'); st.setCheckout(true) }} className={cn(inkBtn, 'h-12 w-full text-base')}>Перейти к оформлению</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={st.panel === 'fav'} onOpenChange={(o) => !o && close()}>
        <SheetContent className={side}>
          {head('Избранное', favs.length ? `${favs.length} шт.` : 'Пока пусто')}
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {!favs.length && <Empty icon={Heart} text="Нажмите ♡ на карточке корма, и он появится здесь" action={toCatalog} />}
            {favs.map((p) => {
              const v = p.weights[p.weights.length > 2 ? 1 : 0]
              return (
                <div key={p.id} className="flex gap-3 rounded-[2px] bg-gray-1 p-3">
                  <div className={cn('flex size-20 shrink-0 items-center justify-center rounded-[2px] p-1', p.bg)}><img src={img(p.id)} alt="" className="max-h-full w-auto" /></div>
                  <div className="flex flex-1 flex-col">
                    <Link to={productPath(p)} onClick={close} className="text-sm leading-snug hover:text-violet-dark"><b>{p.line}</b> {p.name}</Link>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="font-bold">{rub(v.price)} <span className="text-xs font-normal text-txt-2">· {v.w}</span></span>
                      <button onClick={() => st.add(p, v)} className="rounded-[2px] bg-ink px-3 py-1.5 text-xs font-semibold text-white">{st.qtyOf(p.id, v.w) ? `В корзине: ${st.qtyOf(p.id, v.w)}` : 'В корзину'}</button>
                    </div>
                  </div>
                  <button onClick={() => st.toggleFav(p.id)} aria-label="Убрать из избранного" className="self-start"><Heart className="size-4 fill-tang text-tang" /></button>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={st.panel === 'profile'} onOpenChange={(o) => !o && close()}>
        <SheetContent className={side}>
          {head('Личный кабинет', st.user ? st.user.phone : 'Вход по номеру телефона')}
          <div className="flex-1 overflow-y-auto p-5">{st.user ? <Profile nav={nav} /> : <Login />}</div>
        </SheetContent>
      </Sheet>

      {/* сравнение составов — выбрали на карточках в каталоге, смотрим рядом без переходов */}
      <Sheet open={st.panel === 'compare'} onOpenChange={(o) => !o && close()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full sm:max-w-[760px] data-[side=right]:sm:max-w-[760px]">
          {head('Сравнение состава', `${st.compare.length} из 4 кормов`)}
          <div className="flex-1 overflow-y-auto p-5">
            {!st.compare.length ? (
              <Empty icon={Scale} text="отметьте «сравнить состав» на карточках кормов в каталоге" action={toCatalog} />
            ) : (
              <CompareTable ids={st.compare} onRemove={st.toggleCompare} onOpen={close} />
            )}
          </div>
          {!!st.compare.length && (
            <div className="border-t border-gray-2 p-5">
              <button onClick={st.clearCompare} className="text-sm text-txt-2 underline hover:text-ink">Очистить сравнение</button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* плавающая плашка сравнения — видна, пока выбран хотя бы 1 корм, не мешает просмотру каталога */}
      {!!st.compare.length && st.panel !== 'compare' && (
        <button onClick={() => st.setPanel('compare')} className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 bg-ink px-5 py-4 text-sm font-semibold text-white shadow-[0_-4px_16px_rgba(0,0,0,0.15)] sm:bottom-5 sm:left-1/2 sm:inset-x-auto sm:w-auto sm:-translate-x-1/2 sm:rounded-full sm:px-6">
          <Scale className="size-4" /> Сравнить состав ({st.compare.length})
        </button>
      )}

      {/* мобильное меню (бургер) */}
      <Sheet open={st.panel === 'menu'} onOpenChange={(o) => !o && close()}>
        <SheetContent side="left" className="flex w-[320px] max-w-[86vw] flex-none touch-pan-y flex-col gap-0 overflow-x-hidden p-0">
          <SheetHeader className="border-b border-gray-2 p-5"><SheetTitle asChild><div><Logo onClick={close} /></div></SheetTitle><SheetDescription className="sr-only">Меню сайта</SheetDescription></SheetHeader>
          <nav aria-label="Меню" className="flex-1 touch-pan-y overflow-x-hidden overflow-y-auto p-5">
            <div className="mb-2 text-lg font-extrabold">Каталог</div>
            <MenuLink to={kinds.cat.path} onClick={close}>Корм для кошек</MenuLink>
            <MenuLink to={kinds.dog.path} onClick={close}>Корм для собак</MenuLink>
            <MenuLink to={productPath(byId('cat-kitten-turkey-rosemary'))} onClick={close}>Для котят</MenuLink>
            <MenuLink to={productPath(byId('dog-puppy-turkey'))} onClick={close}>Для щенков</MenuLink>
            <MenuLink to={productPath(byId('cat-sterile-turkey-lamb'))} onClick={close}>Для стерилизованных кошек</MenuLink>
            <MenuLink to={productPath(byId('dog-small-beef-lamb'))} onClick={close}>Для мелких пород собак</MenuLink>
            <div className="mb-2 mt-5 text-lg font-extrabold">Информация</div>
            <MenuLink to={pages.delivery.path} onClick={close}>Доставка и оплата</MenuLink>
            <MenuLink to={pages.returns.path} onClick={close}>Возврат и обмен</MenuLink>
            <MenuLink to={pages.about.path} onClick={close}>О бренде</MenuLink>
            <MenuLink to={pages.blog.path} onClick={close}>Блог</MenuLink>
            <MenuLink to={pages.faq.path} onClick={close}>Частые вопросы</MenuLink>
            <MenuLink to={pages.contacts.path} onClick={close}>Контакты</MenuLink>
            <a href={contacts.phoneHref} className="mt-5 block text-xl font-bold">{contacts.phone}</a>
            <div className="text-sm text-txt-2">{contacts.hours}</div>
            <MessengerButtons className="mt-4" stack />
          </nav>
        </SheetContent>
      </Sheet>

      <Dialog open={st.checkout} onOpenChange={st.setCheckout}>
        <Checkout />
      </Dialog>
    </>
  )
}

function PromoBox() {
  const st = useStore()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text }
  const [busy, setBusy] = useState(false)
  if (!st.firstOrderEligible && !crmEnabled) return null
  if (st.promo) {
    return (
      <div className="mb-4 flex items-center justify-between gap-2 rounded-[2px] bg-violet-soft px-4 py-3 text-[14px] font-semibold text-violet-dark">
        <span>Промокод {st.promo.code} применён — скидка {st.promo.kind === 'fixed' ? rub(st.promo.value) : st.promo.value + '%'}</span>
        <button type="button" onClick={st.clearPromo} className="shrink-0 text-txt-2 underline">Убрать</button>
      </div>
    )
  }
  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => { setCode(e.target.value); setMsg(null) }} placeholder="Промокод" aria-label="Промокод" className="h-11 rounded-[2px] bg-white text-[16px]" />
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { const r = await st.applyPromo(code); setMsg(r.ok ? { ok: true, text: 'Скидка применена!' } : { ok: false, text: r.msg }) } finally { setBusy(false) } }}
          className="h-11 shrink-0 rounded-[2px] bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Проверяю…' : 'Применить'}</button>
      </div>
      {msg && <p className={cn('mt-1.5 text-[13px]', msg.ok ? 'text-emerald-600' : 'text-red-600')}>{msg.text}</p>}
    </div>
  )
}

function MenuLink({ to, onClick, children }) {
  return <Link to={to} onClick={onClick} className="flex w-full items-center justify-between py-2 text-left text-[15px]">{children}<ChevronRight className="size-4 text-txt-2" /></Link>
}

function Empty({ icon: I, text, action }) {
  return (
    <div className="py-14 text-center text-txt-2">
      <I className="mx-auto mb-3 size-12 text-gray-3" />
      <p>{text}</p>
      {action && <button onClick={action[1]} className={cn(inkBtn, 'mt-5')}>{action[0]}</button>}
    </div>
  )
}

// Оформление как у крупных зоомагазинов: вход по коду → (новый покупатель — короткая анкета) → пункт выдачи
function Checkout() {
  const st = useStore()
  const [done, setDone] = useState(null) // оформленный заказ
  const [point, setPoint] = useState('') // адрес текстом, если не нашли пункт на карте
  const [pt, setPt] = useState(null) // пункт, выбранный на карте
  const [manual, setManual] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false) // защита от двойного нажатия
  const step = done ? 'done' : !st.user ? 'auth' : 'point'
  const fullName = st.user ? [st.user.name, st.user.surname].filter(Boolean).join(' ') : ''
  const submit = (e) => {
    e.preventDefault()
    if (sending.current) return
    const where = manual ? point.trim() : pt ? `${pt.b === 'p' ? 'Пятёрочка' : 'Перекрёсток'}, ${pt.a}` : ''
    if (where.length < 5) return setErr(manual ? 'Укажите адрес пункта выдачи' : 'Выберите пункт на карте или в списке')
    sending.current = true
    setBusy(true)
    setTimeout(() => {
      const o = st.placeOrder({ name: fullName, phone: st.user.phone, delivery: `5Post: ${where}` })
      setDone(o); setBusy(false); sending.current = false
    }, 500)
  }
  const box = (wide, kids) => <DialogContent className={cn('max-h-[94dvh] overflow-y-auto rounded-[2px] bg-gray-1', wide ? 'max-w-[960px] p-5 sm:max-w-[960px] sm:p-7' : 'max-w-[520px] p-7')}>{kids}</DialogContent>
  const sum = st.discount ? `${rub(st.totalWithDiscount)} (со скидкой ${rub(st.discount)})` : rub(st.total)
  if (step === 'done')
    return box(false,
      <>
        <DialogTitle className="sr-only">Заказ оформлен</DialogTitle>
        <DialogDescription className="sr-only">Заказ №{done.n} принят</DialogDescription>
        <div className="rounded-[2px] bg-white p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-violet-dark text-white"><Check className="size-7" /></div>
          <h3 className="mt-4 text-2xl font-extrabold">Спасибо, {st.user?.name}!</h3>
          <p className="mt-2 text-txt-2">Заказ №{done.n} принят и сохранён в личном кабинете. Когда он приедет в пункт выдачи, придёт смс с кодом для получения.{crmEnabled ? '' : ' Это демо — заказ никуда не ушёл.'}</p>
          <Button onClick={() => { st.setCheckout(false); setDone(null) }} className={cn(inkBtn, 'mt-5 h-11 px-8')}>Хорошо</Button>
        </div>
      </>
    )
  if (step === 'auth')
    return box(false,
      <>
        <DialogTitle className="text-2xl font-extrabold">Войдите или зарегистрируйтесь</DialogTitle>
        <DialogDescription className="text-[15px] text-txt-2">Сумма заказа {sum}. Введите номер телефона — пришлём код для входа.</DialogDescription>
        <AuthFlow />
      </>
    )
  return box(!!st.items.length,
    <>
      <DialogTitle className="text-2xl font-extrabold">Где заберёте заказ?</DialogTitle>
      <DialogDescription className="text-[15px] text-txt-2">{st.count} шт. на {sum}. Доставка до пункта 5Post бесплатная.</DialogDescription>
      {!st.items.length ? (
        <Empty icon={ShoppingBag} text="Корзина пуста" action={['В каталог', () => st.setCheckout(false)]} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          {manual ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Адрес пункта 5Post</span>
              <Input value={point} onChange={(e) => { setPoint(e.target.value); setErr('') }} placeholder="Улица, дом — «Пятёрочка», «Перекрёсток» или постамат" maxLength={200} className="h-12 rounded-[2px] bg-white text-[16px]" />
              <span className="mt-1.5 block text-xs text-txt-2">Не знаете точный адрес — напишите улицу или район, подберём ближайший пункт и перезвоним.</span>
            </label>
          ) : (
            <>
              <Suspense fallback={<div className="flex h-[260px] items-center justify-center"><Loader2 className="size-6 animate-spin text-txt-2" /></div>}>
                <PickupPicker value={pt} onChange={(p) => { setPt(p); setErr('') }} />
              </Suspense>
              {/* ДЕМО-пометка: точки — магазины из OpenStreetMap, а не настоящий список 5Post */}
              <p className="text-xs text-txt-2">Демо: на карте магазины «Пятёрочка» и «Перекрёсток» из открытой карты OpenStreetMap, не в каждом из них есть пункт 5Post.</p>
            </>
          )}
          <button type="button" onClick={() => { setManual(!manual); setErr('') }} className="text-sm text-violet-dark underline">{manual ? 'Выбрать на карте' : 'Нет нужного пункта? Напишите адрес'}</button>
          <div className="flex flex-col gap-3 rounded-[2px] bg-white p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              {!manual && (pt ? <div className="font-semibold">{pt.b === 'p' ? 'Пятёрочка' : 'Перекрёсток'}, {pt.a}</div> : <div className="text-txt-2">Пункт не выбран</div>)}
              <div className="text-txt-2"><span className="text-ink">{fullName}</span> · <span className="whitespace-nowrap">{st.user.phone}</span> · <button type="button" onClick={() => st.setUser(null)} className="underline hover:text-ink">Не вы?</button></div>
            </div>
            <Button type="submit" disabled={busy} className={cn(inkBtn, 'h-12 shrink-0 px-8 text-base')}>{busy ? <Loader2 className="size-5 animate-spin" /> : 'Подтвердить заказ'}</Button>
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </form>
      )}
    </>
  )
}

function Login() {
  return (
    <>
      <div className="mb-3 rounded-[2px] bg-violet-soft p-4 text-sm">Войдите, чтобы видеть свои заказы и избранное. Если к номеру привязан Telegram или Max, код придёт туда.</div>
      <AuthFlow />
    </>
  )
}

// Вход по номеру: телефон → код → если покупатель новый, анкета (имя, фамилия по желанию, дата рождения)
function AuthFlow() {
  const st = useStore()
  const [f, setF] = useState({ phone: '', code: '', ok: false, trap: '', name: '', surname: '', birth: '' })
  const [step, setStep] = useState('phone') // phone | code | profile
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null) // { channel, demoCode }
  const [wait, setWait] = useState(0)
  const [demo, setDemo] = useState(['telegram']) // только демо: какие мессенджеры «есть» у номера
  const [live, setLive] = useState(authLiveNow()) // CRM на связи: код шлёт бот или смс
  useEffect(() => { authLive().then(setLive) }, [])
  const started = useRef(Date.now())
  useEffect(() => {
    if (!wait) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  const today = new Date().toISOString().slice(0, 10)
  const request = async (via = '') => {
    setBusy(true)
    const res = await sendCode(f.phone, { trap: f.trap, startedAt: started.current, via, demoLinked: live ? null : [...new Set([...demo, ...linkedChannels(f.phone)])] })
    setBusy(false)
    if (res.resendIn) setWait(res.resendIn)
    if (res.error) return setErr(res.error)
    setErr(''); setSent({ ...res, via }); setF((x) => ({ ...x, code: '' })); setStep('code')
  }
  const next = async (e) => {
    e.preventDefault()
    if (busy) return
    if (step === 'phone') {
      if (f.phone.replace(/\D/g, '').length !== 11) return setErr('Введите телефон полностью')
      if (!f.ok) return setErr('Нужно согласие на обработку данных')
      return request()
    }
    if (step === 'code') {
      if (f.code.length !== 4) return setErr('Введите 4 цифры')
      setBusy(true)
      const res = await checkCode(f.phone, f.code)
      if (res.error) { setBusy(false); return setErr(res.error) }
      const acc = await findAccount(f.phone) // есть ли учётная запись на этот номер
      setBusy(false); setErr('')
      if (acc) return st.setUser({ ...acc, phone: f.phone })
      return setStep('profile')
    }
    if (f.name.trim().length < 2) return setErr('Введите имя')
    if (!f.birth || f.birth > today || f.birth < '1900-01-01') return setErr('Укажите дату рождения')
    const acc = { name: f.name.trim(), surname: f.surname.trim(), birth: f.birth }
    setBusy(true)
    await saveAccount(f.phone, acc)
    setBusy(false)
    st.setUser({ ...acc, phone: f.phone })
  }
  const where = sent?.channel === 'sms' ? `по смс на ${f.phone}` : `в ${channelNames[sent?.channel]} — на аккаунт с номером ${f.phone}`
  const inp = 'h-12 rounded-[2px] bg-white text-[16px]'
  return (
    <form onSubmit={next} noValidate className="space-y-3">
      {step === 'phone' && (
        <>
          <Input aria-label="Телефон" type="tel" autoComplete="tel" placeholder="Телефон" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: fmtPhone(e.target.value) })} className={inp} />
          {/* поле-ловушка для ботов: людям не видно */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={(e) => setF({ ...f, trap: e.target.value })} className="absolute -left-[9999px] h-px w-px opacity-0" />
          {!live && (
            <div className="rounded-[2px] border border-dashed border-gray-3 p-3 text-xs text-txt-2">
              <div className="mb-2">Демо — что есть у этого номера (на сайте с сервером это проверится само):</div>
              <div className="flex flex-wrap gap-1.5">
                {[['Telegram', ['telegram']], ['Max', ['max']], ['Оба', ['telegram', 'max']], ['Ничего', []]].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => setDemo(v)} aria-pressed={demo.join() === v.join()}
                    className={cn('rounded-full px-3 py-1 font-semibold', demo.join() === v.join() ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-gray-2')}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <Consent checked={f.ok} onChange={(ok) => setF({ ...f, ok })} />
        </>
      )}
      {step === 'code' && (
        <>
          <p className="text-[15px]">{sent?.channel === 'sms' && sent?.via !== 'sms' ? 'Telegram и Max у этого номера не нашли, поэтому код отправлен' : 'Код отправлен'} {where}. <button type="button" className="text-violet-dark underline" onClick={() => { setStep('phone'); setErr('') }}>Изменить номер</button></p>
          <Input aria-label="Код" autoFocus placeholder="Код" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '') })} className="h-12 rounded-[2px] bg-white text-center text-xl tracking-[.5em]" />
          {sent?.demoCode && <p className="text-xs text-txt-2">Демо: смс пока не отправляются, ваш код — {sent.demoCode}</p>}
          <button type="button" disabled={wait > 0 || busy} onClick={() => request('sms')} className="block text-sm text-violet-dark underline disabled:text-txt-2 disabled:no-underline">
            {sent?.channel === 'sms' ? (wait > 0 ? `Отправить код повторно через ${wait} с` : 'Отправить код повторно') : `Не пришёл в ${channelNames[sent?.channel]}? Отправить по смс${wait > 0 ? ` через ${wait} с` : ''}`}
          </button>
        </>
      )}
      {step === 'profile' && (
        <>
          <p className="text-[15px]">Номер {f.phone} у нас впервые. Расскажите немного о себе — это займёт полминуты.</p>
          <Input aria-label="Имя" autoFocus autoComplete="given-name" placeholder="Имя" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} />
          <Input aria-label="Фамилия (необязательно)" autoComplete="family-name" placeholder="Фамилия (необязательно)" maxLength={60} value={f.surname} onChange={(e) => setF({ ...f, surname: e.target.value })} className={inp} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Дата рождения</span>
            <Input type="date" autoComplete="bday" min="1900-01-01" max={today} value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} className={inp} />
          </label>
        </>
      )}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className={cn(inkBtn, 'h-12 w-full text-base')}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : step === 'phone' ? 'Получить код' : step === 'code' ? 'Продолжить' : 'Сохранить и продолжить'}
      </Button>
    </form>
  )
}

// Привязка мессенджеров: покупатель открывает нашего бота и делится номером — коды для входа приходят туда, а не по смс
function LinkedMessengers() {
  const st = useStore()
  const [info, setInfo] = useState(null) // данные CRM: какие боты есть и к каким привязан номер
  const [linked, setL] = useState(() => linkedChannels(st.user.phone))
  useEffect(() => { messengerInfo().then(setInfo) }, [])
  const toggle = (c) => setL(setLinked(st.user.phone, c, !linked.includes(c)))
  const btn = 'flex h-11 items-center justify-center gap-2 rounded-[2px] text-sm font-semibold transition-colors'
  const mark = <span className="flex items-center gap-0.5 text-xs font-medium"><Check className="size-3.5" />подключён</span>
  return (
    <div className="rounded-[2px] border border-gray-2 p-4">
      <div className="font-semibold">Коды для входа</div>
      <p className="mt-1 text-sm text-txt-2">Откройте нашего бота и нажмите «Авторизоваться» — коды будут приходить туда, а не по смс.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[['telegram', TgIcon], ['max', MaxIcon]].map(([c, I]) => {
          if (info) {
            const bot = info.bots.find((b) => b.type === c)
            const on = info.linked.includes(c)
            if (!bot) return <div key={c} className={cn(btn, 'bg-gray-1 text-txt-2')}><I className="size-6 opacity-50" />{channelNames[c]} скоро</div>
            return <a key={c} href={botLink(bot)} target="_blank" rel="noreferrer" className={cn(btn, on ? 'bg-violet-soft text-violet-dark' : 'bg-gray-1 hover:bg-gray-2')}><I className="size-6" />{channelNames[c]}{on && mark}</a>
          }
          const on = linked.includes(c) // демо: без CRM привязка хранится в браузере
          return (
            <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on} className={cn(btn, on ? 'bg-violet-soft text-violet-dark' : 'bg-gray-1 hover:bg-gray-2')}>
              <I className="size-6" />{channelNames[c]}{on && mark}
            </button>
          )
        })}
      </div>
      {info && <button type="button" onClick={() => messengerInfo().then(setInfo)} className="mt-2 text-xs text-txt-2 underline hover:text-ink">Я поделился номером — обновить</button>}
    </div>
  )
}

// Личные данные: имя, фамилия, дата рождения сохраняются сразу; новый номер — только после кода
function EditProfile({ onClose }) {
  const st = useStore()
  const u = st.user
  const [f, setF] = useState({ name: u.name || '', surname: u.surname || '', birth: u.birth || '', phone: u.phone, code: '' })
  const [step, setStep] = useState('form') // form | code
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)
  const started = useRef(Date.now() - 5000)
  const today = new Date().toISOString().slice(0, 10)
  const inp = 'h-12 rounded-[2px] bg-white text-[16px]'
  const same = f.phone.replace(/\D/g, '') === u.phone.replace(/\D/g, '')
  const finish = async (phone) => {
    const acc = { name: f.name.trim(), surname: f.surname.trim(), birth: f.birth }
    await saveAccount(phone, acc)
    if (phone !== u.phone) await saveAccount(u.phone, null) // старый номер больше не ведёт в этот аккаунт
    st.setUser({ ...u, ...acc, phone })
    onClose(true)
  }
  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (step === 'code') {
      if (f.code.length !== 4) return setErr('Введите 4 цифры')
      setBusy(true)
      const r = await checkCode(f.phone, f.code, { move: true })
      if (r.error) { setBusy(false); return setErr(r.error) }
      await finish(f.phone)
      return setBusy(false)
    }
    if (f.name.trim().length < 2) return setErr('Введите имя')
    if (f.birth && (f.birth > today || f.birth < '1900-01-01')) return setErr('Проверьте дату рождения')
    if (f.phone.replace(/\D/g, '').length !== 11) return setErr('Введите телефон полностью')
    setBusy(true)
    if (same) { await finish(u.phone); return setBusy(false) }
    if (await findAccount(f.phone)) { setBusy(false); return setErr('Этот номер уже привязан к другому аккаунту') }
    const r = await sendCode(f.phone, { startedAt: started.current, demoLinked: authLiveNow() ? null : ['telegram'] }) // демо: как будто у номера есть Telegram
    setBusy(false)
    if (r.error) return setErr(r.error)
    setErr(''); setSent(r); setStep('code')
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-[2px] bg-gray-1 p-4">
      <div className="flex items-center justify-between"><div className="font-bold">Личные данные</div><button type="button" onClick={() => onClose(false)} className="text-sm text-txt-2 underline hover:text-ink">Отмена</button></div>
      {step === 'form' ? (
        <>
          <label className="block"><span className="mb-1 block text-xs text-txt-2">Имя</span><Input autoComplete="given-name" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs text-txt-2">Фамилия (необязательно)</span><Input autoComplete="family-name" maxLength={60} value={f.surname} onChange={(e) => setF({ ...f, surname: e.target.value })} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs text-txt-2">Дата рождения</span><Input type="date" autoComplete="bday" min="1900-01-01" max={today} value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs text-txt-2">Телефон — для входа и смс о заказах</span><Input type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: fmtPhone(e.target.value) })} className={inp} /></label>
          {!same && <p className="text-xs text-txt-2">Новый номер подтвердим кодом.</p>}
        </>
      ) : (
        <>
          <p className="text-[15px]">Код отправлен {sent?.channel === 'sms' ? `по смс на ${f.phone}` : `в ${channelNames[sent?.channel]}`}. <button type="button" className="text-violet-dark underline" onClick={() => { setStep('form'); setErr('') }}>Изменить номер</button></p>
          <Input aria-label="Код" autoFocus placeholder="Код" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '') })} className="h-12 rounded-[2px] bg-white text-center text-xl tracking-[.5em]" />
          {sent?.demoCode && <p className="text-xs text-txt-2">Демо: смс пока не отправляются, ваш код — {sent.demoCode}</p>}
        </>
      )}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className={cn(inkBtn, 'h-12 w-full text-base')}>{busy ? <Loader2 className="size-5 animate-spin" /> : step === 'code' ? 'Подтвердить номер' : !same ? 'Получить код' : 'Сохранить'}</Button>
    </form>
  )
}

const ORDER_STATUS_BADGE = {
  new: 'bg-violet-soft text-violet-dark',
  confirmed: 'bg-sky-100 text-sky-700',
  packed: 'bg-amber-100 text-amber-700',
  shipped: 'bg-sky-100 text-sky-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

function Profile({ nav }) {
  const st = useStore()
  const [edit, setEdit] = useState(false)
  const [saved, setSaved] = useState(false)
  const [live, setLive] = useState({}) // { [orderNumber]: { status, status_label } }
  const bday = st.user.birth ? new Date(st.user.birth + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  useEffect(() => {
    if (!crmEnabled) return
    let cancelled = false
    Promise.all(st.orders.map((o) => fetchOrderStatus(o.n, o.contact?.phone || st.user.phone).then((r) => [o.n, r]))).then((pairs) => {
      if (cancelled) return
      setLive((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, r]) => r)) }))
    })
    return () => { cancelled = true }
  }, [st.orders.length, st.user.phone])
  return (
    <div className="space-y-5">
      {edit ? <EditProfile onClose={(ok) => { setEdit(false); setSaved(ok === true) }} /> : (
        <div className="rounded-[2px] bg-gray-1 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-dark text-lg font-bold text-white">{st.user.name[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1"><div className="font-bold">{[st.user.name, st.user.surname].filter(Boolean).join(' ')}</div><div className="whitespace-nowrap text-sm text-txt-2">{st.user.phone}</div>{bday && <div className="text-sm text-txt-2">{bday}</div>}</div>
            <button onClick={() => st.setUser(null)} className="flex items-center gap-1 self-start text-sm text-txt-2 hover:text-ink"><LogOut className="size-4" />Выйти</button>
          </div>
          <button onClick={() => { setEdit(true); setSaved(false) }} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-violet-dark hover:underline"><Pencil className="size-3.5" />Изменить личные данные</button>
          {saved && <p className="mt-1 text-xs text-txt-2">Изменения сохранены</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => st.setPanel('fav')} className="rounded-[2px] border border-gray-2 p-4 text-left hover:bg-gray-1"><Heart className="mb-2 size-5" /><div className="font-semibold">Избранное</div><div className="text-sm text-txt-2">{st.fav.length} шт.</div></button>
        <button onClick={() => st.setPanel('cart')} className="rounded-[2px] border border-gray-2 p-4 text-left hover:bg-gray-1"><ShoppingBag className="mb-2 size-5" /><div className="font-semibold">Корзина</div><div className="text-sm text-txt-2">{st.count} шт.</div></button>
      </div>
      <LinkedMessengers />
      <div>
        <div className="mb-3 text-lg font-extrabold">Мои заказы</div>
        {!st.orders.length && <p className="text-sm text-txt-2">Заказов пока нет. <button className="text-violet-dark underline" onClick={() => { st.setPanel(null); nav.show({}) }}>Перейти в каталог</button></p>}
        <div className="space-y-2">
          {st.orders.map((o) => {
            const l = live[o.n]
            return (
            <div key={o.n} className="rounded-[2px] border border-gray-2 p-4">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Package className="size-4" />Заказ №{o.n}</span><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ORDER_STATUS_BADGE[l?.status] || 'bg-violet-soft text-violet-dark')}>{l?.status_label || 'Принят'}</span></div>
              <div className="mt-1 text-sm text-txt-2">{o.date} · {o.items.reduce((s, i) => s + i.qty, 0)} шт. · {rub(o.total)}</div>
              <div className="mt-2 text-xs text-txt-2">{o.items.map((i) => `${i.line} ${i.w} ×${i.qty}`).join(', ')}</div>
              {o.contact?.delivery && <div className="mt-1 text-xs text-txt-2">{o.contact.delivery}</div>}
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}
