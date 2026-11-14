// Вход и регистрация — по логике «Четырёх лап»:
// «Войдите или зарегистрируйтесь» (телефон или почта) → «Продолжить» →
//   уже есть аккаунт  → «Авторизация»: пароль, «Забыли пароль?» → «Сброс пароля»: новый пароль приходит сообщением;
//   новый покупатель  → «Регистрация»: код из сообщения → «Зарегистрироваться» → анкета с паролем.
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useStore, fmtPhone } from './store'
import { Link } from './router'
import { pages } from './data'
import {
  sendCode, checkCode, callStatus, lookup, loginPassword, setPassword, saveAccount, findAccount, linkEmail, phoneFor,
  linkedChannels, channelNames, maskLogin, isEmail, authLive, authLiveNow, authConfig,
} from './auth'

const inkBtn = 'h-11 rounded-[2px] bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-2'
const R = 'rounded-[2px]'
const inp = `h-12 ${R} bg-white text-[16px]`
const titles = { start: 'Войдите или зарегистрируйтесь', login: 'Авторизация', register: 'Регистрация', profile: 'Расскажите о себе', reset: 'Сброс пароля', newpass: 'Новый пароль' }
const buttons = { start: 'Продолжить', login: 'Войти', register: 'Зарегистрироваться', profile: 'Сохранить и войти', reset: 'Применить', newpass: 'Сохранить и войти' }
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const linkCls = 'text-violet-dark underline underline-offset-2 hover:no-underline'

export function PassInput({ value, onChange, placeholder = 'Пароль', autoComplete = 'current-password', autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} aria-label={placeholder} placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus}
        maxLength={64} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inp, 'pr-12')} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-txt-2 hover:text-ink">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

// 74951234567 → +7 (495) 123-45-67
const fmtCall = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length === 11 ? `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : n }

// Подтверждение номера звонком («Плюсофон», обратный Flash Call): показываем номер, раз в 2 секунды
// спрашиваем CRM, был ли звонок. Позвонил — onDone(). Используется во входе и при смене номера в кабинете.
export function CallBox({ login, sent, move = false, onDone, onRetry, onChangePhone, consent = null }) {
  const [left, setLeft] = useState(sent.expiresIn || 300)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const leftRef = useRef(left)
  leftRef.current = left
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => { setLeft(sent.expiresIn || 300); setErr('') }, [sent])
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  useEffect(() => {
    if (sent.demo) return
    let stop = false
    let timer
    const tick = async () => {
      if (stop || leftRef.current <= 0) return
      const r = await callStatus(login, sent.callId, { move })
      if (stop) return
      if (r.confirmed) return done.current()
      if (r.error) return setErr(r.error)
      timer = setTimeout(tick, 2000)
    }
    timer = setTimeout(tick, 2000)
    return () => { stop = true; clearTimeout(timer) }
  }, [sent, login, move])
  const demoCall = async () => {
    setBusy(true)
    const r = await callStatus(login, sent.callId, { move, demo: true })
    setBusy(false)
    if (r.confirmed) return done.current()
    setErr(r.error || 'Звонок пока не пришёл')
  }
  return (
    <div className="space-y-3">
      <p className="text-[15px]">Позвоните с номера {maskLogin(login)} на номер ниже. Звонок сбросится сам, и вход продолжится автоматически.</p>
      {sent.demo ? (
        <div className={cn(R, 'space-y-2 border border-dashed border-gray-3 p-3 text-xs text-txt-2')}>
          <div>Демо: звонки пока не подключены. Здесь появится номер для звонка.</div>
          <button type="button" disabled={busy || left <= 0} onClick={demoCall} className={cn(inkBtn, 'h-10 w-full')}>{busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Я позвонил'}</button>
        </div>
      ) : (
        <a href={'tel:+' + String(sent.callTo).replace(/\D/g, '')} className={cn(R, 'flex h-14 items-center justify-center gap-2 border border-ink bg-white text-xl font-extrabold tracking-wide text-ink')}>
          <Phone className="size-5" />{fmtCall(sent.callTo)}
        </a>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        {left > 0
          ? <span className="flex items-center gap-2 text-txt-2">{!sent.demo && <Loader2 className="size-4 animate-spin" />}Ждём звонок · ещё {mmss(left)}</span>
          : <span className="text-txt-2">Время вышло. <button type="button" onClick={onRetry} className={linkCls}>Получить новый номер</button></span>}
        {onChangePhone && <button type="button" onClick={onChangePhone} className={linkCls}>Изменить номер</button>}
      </div>
      {consent}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </div>
  )
}

export default function AuthFlow({ note }) {
  const st = useStore()
  const [mode, setMode] = useState('phone') // phone | email
  const [f, setF] = useState({ phone: '', email: '', code: '', pass: '', trap: '', name: '', surname: '', birth: '', newPass: '', ownPhone: '' })
  const [step, setStep] = useState('start') // start | login | register | profile | reset
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null) // { channel, demoCode, kind, login, via, firstPass }
  const [wait, setWait] = useState(0)
  const [help, setHelp] = useState(false)
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
  const login = mode === 'phone' ? f.phone : f.email.trim()
  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setErr('') }
  const go = (s) => { setStep(s); setErr(''); setHelp(false) }
  const enter = (phone, acc) => st.setUser({ ...acc, phone: fmtPhone(String(phone)) })

  // kind: 'code' — код для регистрации, 'reset' — новый пароль; via: 'call' — попросили звонок вместо мессенджера
  const request = async (kind, via = '', extra = {}) => {
    setBusy(true)
    const res = await sendCode(login, { trap: f.trap, startedAt: started.current, via, kind, demoLinked: live ? null : [...new Set([...demo, ...linkedChannels(f.phone)])] })
    setBusy(false)
    if (res.resendIn) setWait(res.resendIn)
    // код уже отправлен на этот же номер минуту назад — просто возвращаемся к вводу
    if (res.error && res.resendIn && sent?.login === login && sent?.kind === kind) return true
    if (res.error) { setErr(res.error); return false }
    setErr(''); setHelp(false); setSent({ ...res, kind, login, via, ...extra }); setF((x) => ({ ...x, code: '', pass: '' }))
    return true
  }

  // звонок подтверждён: регистрация → анкета (или вход, если аккаунт уже есть); сброс → придумать пароль
  const called = async () => {
    if (step === 'reset') return go('newpass')
    const acc = mode === 'phone' && (await findAccount(f.phone))
    if (acc) return enter(f.phone, acc)
    go('profile')
  }

  const next = async (e) => {
    e.preventDefault()
    if (busy) return
    if (step === 'newpass') {
      if (f.newPass.length < authConfig.minPassword) return setErr(`Пароль — не короче ${authConfig.minPassword} символов`)
      setBusy(true)
      const phone = phoneFor(login)
      const p = await setPassword(phone, f.newPass)
      if (p.error) { setBusy(false); return setErr(p.error) }
      const acc = await findAccount(phone)
      setBusy(false)
      return enter(phone, acc || {})
    }
    if (step === 'start') {
      if (mode === 'phone' && f.phone.replace(/\D/g, '').length !== 11) return setErr('Введите номер телефона полностью')
      if (mode === 'email' && !isEmail(f.email)) return setErr('Проверьте адрес почты')
      setBusy(true)
      const r = await lookup(login)
      setBusy(false)
      if (r.error) return setErr(r.error)
      if (r.exists && r.password) return go('login')
      if (r.exists) return (await request('reset', '', { firstPass: true })) && go('reset') // пароля ещё нет — пришлём его
      return (await request('code')) && go('register')
    }
    if (step === 'login') {
      if (!f.pass) return setErr('Введите пароль')
      setBusy(true)
      const r = await loginPassword(login, f.pass)
      setBusy(false)
      if (r.error) return setErr(r.error)
      return enter(r.phone, r.account || {})
    }
    if (step === 'register') {
      if (f.code.length !== 4) return setErr('Введите 4 цифры из сообщения')
      setBusy(true)
      const r = await checkCode(login, f.code)
      if (r.error) { setBusy(false); return setErr(r.error) }
      const acc = mode === 'phone' && (await findAccount(f.phone)) // зарегистрировался с другого устройства, пока вводил код
      setBusy(false)
      if (acc) return enter(f.phone, acc)
      return go('profile')
    }
    if (step === 'reset') {
      if (!f.pass) return setErr('Введите пароль из сообщения')
      setBusy(true)
      const r = await checkCode(login, f.pass)
      if (r.error) { setBusy(false); return setErr(r.error.replace('Код', 'Пароль').replace('код', 'пароль')) }
      const phone = phoneFor(login)
      await setPassword(phone, f.pass) // пароль из сообщения становится паролем для входа
      const acc = await findAccount(phone)
      setBusy(false)
      return enter(phone, acc || {})
    }
    // profile
    if (f.name.trim().length < 2) return setErr('Введите имя')
    if (!f.birth || f.birth > today || f.birth < '1900-01-01') return setErr('Укажите дату рождения')
    if (mode === 'email' && f.ownPhone.replace(/\D/g, '').length !== 11) return setErr('Введите номер телефона — на него придёт смс о заказе')
    if (f.newPass.length < authConfig.minPassword) return setErr(`Пароль — не короче ${authConfig.minPassword} символов`)
    const phone = mode === 'phone' ? f.phone : f.ownPhone
    setBusy(true)
    if (mode === 'email') {
      const r = await lookup(phone)
      if (r.exists) { setBusy(false); return setErr('Этот номер уже зарегистрирован — войдите по номеру телефона') }
    }
    const acc = { name: f.name.trim(), surname: f.surname.trim(), birth: f.birth }
    await saveAccount(phone, acc)
    const p = await setPassword(phone, f.newPass)
    if (p.error) { setBusy(false); return setErr(p.error) }
    if (mode === 'email') linkEmail(f.email, phone)
    setBusy(false)
    enter(phone, acc)
  }

  const kind = step === 'reset' ? 'reset' : 'code'
  const what = kind === 'reset' ? 'пароль' : 'код'
  const where = !sent ? '' : sent.channel === 'email' ? `на почту ${maskLogin(login)}` : `в ${channelNames[sent.channel]} — на аккаунт с номером ${maskLogin(login)}`
  const byCall = sent?.channel === 'call' && (step === 'register' || step === 'reset')
  const callBox = (consent) => <CallBox login={login} sent={sent} onDone={called} onRetry={() => request(kind, 'call')} onChangePhone={() => go('start')} consent={consent} />
  const sentCopy = (
    <>
      {sent?.demoCode && <p className="text-xs text-txt-2">Демо: {sent.channel === 'email' ? 'письма' : 'сообщения'} пока не отправляются, ваш {what} — <b className="text-ink">{sent.demoCode}</b></p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        {wait > 0
          ? <span className="text-txt-2">Отправить повторно через {mmss(wait)}</span>
          : <button type="button" disabled={busy} onClick={() => request(kind, sent?.via)} className={linkCls}>Отправить повторно</button>}
        <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} className={linkCls}>{sent?.channel === 'email' ? 'Не приходит письмо' : `Не приходит ${what}`}</button>
      </div>
      {help && (
        <div className={cn(R, 'bg-white p-3 text-sm text-txt-2')}>
          {sent?.channel === 'email' ? (
            <>Загляните в папку «Спам». Если в адресе ошибка — <button type="button" onClick={() => go('start')} className={linkCls}>измените почту</button>.</>
          ) : (
            <>Сообщение ушло в чат с нашим ботом в {channelNames[sent?.channel]}. Нет его —{' '}
              {wait > 0 ? <span>подтвердить номер звонком можно через {mmss(wait)}</span> : <button type="button" disabled={busy} onClick={() => request(kind, 'call')} className={linkCls}>подтвердите номер звонком</button>}.</>
          )}
        </div>
      )}
    </>
  )

  return (
    <form onSubmit={next} noValidate className="space-y-3">
      <div className="flex items-center gap-2">
        {step !== 'start' && (
          <button type="button" onClick={() => go(step === 'profile' ? 'register' : 'start')} aria-label="Назад" className="-ml-2 flex size-9 shrink-0 items-center justify-center text-ink hover:text-txt-2">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <h3 className="text-xl font-extrabold leading-tight">{titles[step]}</h3>
      </div>

      {step === 'start' && (
        <>
          {note && <p className="text-sm text-txt-2">{note}</p>}
          <div role="tablist" aria-label="Способ входа" className={cn(R, 'grid grid-cols-2 gap-1 bg-gray-2 p-1')}>
            {[['phone', 'По номеру телефона'], ['email', 'Через эл. почту']].map(([m, l]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr('') }}
                className={cn(R, 'min-h-10 px-2 py-1.5 text-[13px] font-semibold leading-tight transition', mode === m ? 'bg-white text-ink shadow-sm' : 'text-txt-2 hover:text-ink')}>{l}</button>
            ))}
          </div>
          {mode === 'phone'
            ? <Input key="phone" aria-label="Номер телефона" type="tel" autoComplete="tel" inputMode="tel" placeholder="Номер телефона" value={f.phone} onChange={(e) => set('phone')(fmtPhone(e.target.value))} className={inp} />
            : <Input key="email" aria-label="Электронная почта" type="email" autoComplete="email" inputMode="email" placeholder="Электронная почта" maxLength={120} value={f.email} onChange={(e) => set('email')(e.target.value)} className={inp} />}
          {/* поле-ловушка для ботов: людям не видно */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={(e) => set('trap')(e.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />
          {!live && mode === 'phone' && (
            <div className={cn(R, 'border border-dashed border-gray-3 p-3 text-xs text-txt-2')}>
              <div className="mb-2">Демо — что есть у этого номера (на сайте с сервером это проверится само):</div>
              <div className="flex flex-wrap gap-1.5">
                {[['Telegram', ['telegram']], ['Max', ['max']], ['Оба', ['telegram', 'max']], ['Ничего', []]].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => setDemo(v)} aria-pressed={demo.join() === v.join()}
                    className={cn('rounded-full px-3 py-1 font-semibold', demo.join() === v.join() ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-gray-2')}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {step === 'login' && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-txt-2">{mode === 'phone' ? 'Телефон' : 'Почта'}</span>
            <div className="relative">
              <Input readOnly autoComplete="username" value={login} className={cn(inp, 'pr-24')} />
              <button type="button" onClick={() => go('start')} className={cn(linkCls, 'absolute inset-y-0 right-3 text-sm')}>Изменить</button>
            </div>
          </label>
          <PassInput value={f.pass} onChange={set('pass')} autoFocus />
          <button type="button" disabled={busy} onClick={async () => { if (await request('reset')) go('reset') }} className={cn(linkCls, 'text-sm')}>Забыли пароль?</button>
        </>
      )}

      {step === 'register' && byCall && callBox(
        <p className="text-xs text-txt-2">
          Позвонив, вы даёте <Link to={pages.consent.path} className="underline hover:text-ink">согласие на обработку персональных данных</Link> и принимаете{' '}
          <Link to={pages.privacy.path} className="underline hover:text-ink">политику конфиденциальности</Link>
        </p>,
      )}

      {step === 'register' && !byCall && (
        <>
          <p className="text-[15px]">Мы отправили код {where}</p>
          <Input aria-label="Код из сообщения" autoFocus placeholder="Код" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={f.code} onChange={(e) => set('code')(e.target.value.replace(/\D/g, ''))} className={cn(inp, 'text-center text-xl tracking-[.5em]')} />
          {sentCopy}
          <p className="text-xs text-txt-2">
            Нажимая «Зарегистрироваться», вы даёте <Link to={pages.consent.path} className="underline hover:text-ink">согласие на обработку персональных данных</Link> и принимаете{' '}
            <Link to={pages.privacy.path} className="underline hover:text-ink">политику конфиденциальности</Link>
          </p>
        </>
      )}

      {step === 'reset' && byCall && (
        <>
          <p className="text-[15px] font-semibold">{sent?.firstPass ? 'Пароль для входа ещё не задан. Подтвердите номер звонком и придумайте пароль.' : 'Подтвердите номер звонком и придумайте новый пароль.'}</p>
          {callBox(null)}
        </>
      )}

      {step === 'newpass' && (
        <>
          <p className="text-[15px]">Номер подтверждён. Придумайте пароль для входа.</p>
          <input type="text" readOnly hidden autoComplete="username" value={login} />
          <label className="block">
            <span className="mb-1 block text-xs text-txt-2">Пароль — не короче {authConfig.minPassword} символов</span>
            <PassInput value={f.newPass} onChange={set('newPass')} placeholder="Придумайте пароль" autoComplete="new-password" autoFocus />
          </label>
        </>
      )}

      {step === 'reset' && !byCall && (
        <>
          <p className="text-[15px]">{sent?.firstPass ? 'Пароль для входа ещё не задан — мы отправили его' : 'Мы отправили новый пароль'} {where}</p>
          <input type="text" readOnly hidden autoComplete="username" value={login} />
          <PassInput value={f.pass} onChange={(v) => set('pass')(v.trim())} autoComplete="new-password" autoFocus />
          {sentCopy}
        </>
      )}

      {step === 'profile' && (
        <>
          <p className="text-[15px]">Почти готово — осталось познакомиться и придумать пароль для входа.</p>
          <Input aria-label="Имя" autoFocus autoComplete="given-name" placeholder="Имя" maxLength={60} value={f.name} onChange={(e) => set('name')(e.target.value)} className={inp} />
          <Input aria-label="Фамилия (необязательно)" autoComplete="family-name" placeholder="Фамилия (необязательно)" maxLength={60} value={f.surname} onChange={(e) => set('surname')(e.target.value)} className={inp} />
          <label className="block">
            <span className="mb-1 block text-xs text-txt-2">Дата рождения</span>
            <Input type="date" autoComplete="bday" min="1900-01-01" max={today} value={f.birth} onChange={(e) => set('birth')(e.target.value)} className={inp} />
          </label>
          {mode === 'email' && (
            <label className="block">
              <span className="mb-1 block text-xs text-txt-2">Телефон — для смс о заказе</span>
              <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="Номер телефона" value={f.ownPhone} onChange={(e) => set('ownPhone')(fmtPhone(e.target.value))} className={inp} />
            </label>
          )}
          <input type="text" readOnly hidden autoComplete="username" value={login} />
          <label className="block">
            <span className="mb-1 block text-xs text-txt-2">Пароль — не короче {authConfig.minPassword} символов</span>
            <PassInput value={f.newPass} onChange={set('newPass')} placeholder="Придумайте пароль" autoComplete="new-password" />
          </label>
        </>
      )}

      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {!byCall && (
        <Button type="submit" disabled={busy} className={cn(inkBtn, 'h-12 w-full gap-2 text-base')}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <>{buttons[step]}<ArrowRight className="size-5" /></>}
        </Button>
      )}
    </form>
  )
}
