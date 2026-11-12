// Выбор пункта выдачи на карте (как у крупных зоомагазинов): слева поиск и список, справа карта.
// ДЕМО: на карте магазины «Пятёрочка» и «Перекрёсток» в Петербурге из OpenStreetMap
// (public/pickup-points.json). Не каждый из них — пункт 5Post. После получения ключа партнёра
// 5Post список заменяется на настоящие пункты из API 5Post (метод pickupPoints) или их виджет.
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { Search, LocateFixed, Loader2, MapPin, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const SPB = [59.9386, 30.3141]
const brands = { p: { name: 'Пятёрочка', color: '#d6352a' }, x: { name: 'Перекрёсток', color: '#1f7a3d' } }
const km = (a, b) => {
  const dy = (a[0] - b[0]) * 111.32, dx = (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot(dx, dy)
}
const fmtKm = (d) => (d < 1 ? `${Math.round(d * 100) * 10} м` : `${d.toFixed(1).replace('.', ',')} км`)
export const pointLabel = (p) => `${brands[p.b].name}, ${p.a}`

export default function PickupPicker({ value, onChange }) {
  const box = useRef(null)
  const map = useRef(null)
  const L = useRef(null)
  const layer = useRef(null)
  const [points, setPoints] = useState(null)
  const [center, setCenter] = useState(SPB)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // точки + карта (leaflet грузится только когда открыли этот шаг)
  useEffect(() => {
    let off = false
    Promise.all([import('leaflet'), fetch(`${import.meta.env.BASE_URL}pickup-points.json`).then((r) => r.json())]).then(([mod, pts]) => {
      if (off || !box.current) return
      L.current = mod.default || mod
      const m = L.current.map(box.current, { zoomControl: true, preferCanvas: true }).setView(value ? [value.lat, value.lon] : SPB, value ? 15 : 11)
      L.current.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© участники OpenStreetMap' }).addTo(m)
      m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
      m.on('moveend', () => { const c = m.getCenter(); setCenter([c.lat, c.lng]) })
      map.current = m
      setPoints(pts)
    }).catch(() => setMsg('Не удалось загрузить карту. Проверьте интернет и откройте окно ещё раз.'))
    return () => { off = true; map.current?.remove(); map.current = null }
  }, [])

  // метки: перерисовываем при выборе точки
  useEffect(() => {
    if (!points || !map.current) return
    layer.current?.remove()
    const g = L.current.layerGroup()
    for (const p of points) {
      const sel = value?.id === p.id
      L.current.circleMarker([p.lat, p.lon], { radius: sel ? 10 : 6, color: sel ? '#1d1c22' : '#fff', weight: sel ? 3 : 1.5, fillColor: brands[p.b].color, fillOpacity: 1 })
        .bindTooltip(pointLabel(p)).on('click', () => onChange(p)).addTo(g)
    }
    g.addTo(map.current)
    layer.current = g
  }, [points, value])

  const fly = (lat, lon, z = 15) => map.current?.flyTo([lat, lon], z, { duration: 0.6 })
  const pick = (p) => { onChange(p); fly(p.lat, p.lon, 16) }

  // список: что подходит под текст поиска, ближние к центру карты — выше
  const list = useMemo(() => {
    if (!points) return []
    const t = q.trim().toLowerCase().replace(/ё/g, 'е')
    const local = t ? points.filter((p) => pointLabel(p).toLowerCase().replace(/ё/g, 'е').includes(t)) : points
    return (local.length ? local : points).map((p) => ({ ...p, d: km(center, [p.lat, p.lon]) })).sort((a, b) => a.d - b.d).slice(0, 40)
  }, [points, center, q])

  // поиск адреса (Nominatim / OpenStreetMap, в пределах Петербурга)
  const find = async () => {
    const t = q.trim()
    if (t.length < 3) return
    setBusy(true); setMsg('')
    try {
      const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&countrycodes=ru&viewbox=29.4,60.25,30.8,59.6&bounded=1&q=${encodeURIComponent(t)}`
      const [r] = await (await fetch(u)).json()
      if (r) fly(+r.lat, +r.lon, 15)
      else setMsg('Не нашли такой адрес в Петербурге — попробуйте написать иначе')
    } catch { setMsg('Поиск адреса сейчас недоступен — подвиньте карту вручную') }
    setBusy(false)
  }
  const locate = () => {
    if (!navigator.geolocation) return setMsg('Браузер не умеет определять место')
    setBusy(true); setMsg('')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); fly(pos.coords.latitude, pos.coords.longitude, 15) },
      () => { setBusy(false); setMsg('Не получилось определить, где вы. Введите адрес вручную') },
      { timeout: 8000 },
    )
  }

  return (
    <div className="grid gap-3 md:h-[480px] md:grid-cols-[300px_minmax(0,1fr)]">
      <div ref={box} className="relative z-0 order-1 h-[260px] overflow-hidden rounded-[2px] bg-gray-2 md:order-2 md:h-full">
        {!points && !msg && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-txt-2" /></div>}
      </div>
      <div className="order-2 flex min-h-0 flex-col md:order-1">
        <div className="flex gap-2">{/* не form: шаг сам лежит внутри формы заказа */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-txt-2" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setMsg('') }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find() } }} enterKeyHint="search" placeholder="Улица, дом или метро" aria-label="Адрес"
              className="h-11 w-full rounded-[2px] border border-gray-2 bg-white pl-9 pr-2 text-[16px] outline-none focus:border-ink" />
          </div>
          <button type="button" onClick={locate} aria-label="Найти меня" title="Найти меня" className="flex size-11 shrink-0 items-center justify-center rounded-[2px] border border-gray-2 bg-white hover:border-ink">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          </button>
        </div>
        {msg && <p className="mt-1.5 text-[13px] text-destructive">{msg}</p>}
        <div className="mt-2 flex gap-3 text-xs text-txt-2">
          {Object.values(brands).map((b) => <span key={b.name} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>)}
        </div>
        <ul className="mt-2 max-h-[240px] flex-1 space-y-1.5 overflow-y-auto pr-1 md:max-h-none">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)}
                className={cn('w-full rounded-[2px] border bg-white px-3 py-2 text-left text-sm transition-colors', value?.id === p.id ? 'border-ink ring-1 ring-ink' : 'border-gray-2 hover:border-ink')}>
                <span className="flex items-start justify-between gap-2">
                  <span className="flex items-start gap-1.5 font-semibold"><MapPin className="mt-0.5 size-3.5 shrink-0" style={{ color: brands[p.b].color }} />{brands[p.b].name}</span>
                  <span className="shrink-0 text-xs text-txt-2">{fmtKm(p.d)}</span>
                </span>
                <span className="block pl-5">{p.a}</span>
                {p.h && <span className="flex items-center gap-1 pl-5 text-xs text-txt-2"><Clock className="size-3" />{p.h}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
