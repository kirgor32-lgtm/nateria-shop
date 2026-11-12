import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { BASE } from './data'
import { match, head, applyHead, stripBase } from './seo'

const RouteCtx = createContext(null)
export const useRoute = () => useContext(RouteCtx)
export const href = (path = '') => BASE + path

export function RouterProvider({ initialPath, children }) {
  const [route, setRoute] = useState(() => match(initialPath))
  const pendingHash = useRef(null)
  const navigate = useCallback((path, opts = {}) => {
    const r = match(path)
    window.history.pushState({}, '', href(r.path) + (opts.hash ? '#' + opts.hash : ''))
    pendingHash.current = opts.hash || null
    setRoute(r)
    applyHead(head(r))
  }, [])
  // Скроллим ПОСЛЕ того, как новая страница отрисовалась — иначе браузер
  // (scroll anchoring) может вернуть скролл вниз, если клик был в подвале
  useEffect(() => {
    if (pendingHash.current) {
      const hash = pendingHash.current
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 40)
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [route])
  useEffect(() => {
    const onPop = () => { pendingHash.current = null; const r = match(stripBase(location.pathname)); setRoute(r); applyHead(head(r)) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return <RouteCtx.Provider value={{ route, navigate }}>{children}</RouteCtx.Provider>
}

// Настоящая ссылка <a href> — поисковики видят адрес, а клики работают без перезагрузки
export function Link({ to, hash, onClick, children, ...rest }) {
  const { navigate } = useRoute()
  return (
    <a
      href={href(to) + (hash ? '#' + hash : '')}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to, { hash })
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
