import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { stripBase, match, head, applyHead } from './seo'
import { initCrm } from './crm'

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
initCrm()

const el = document.getElementById('root')
const path = stripBase(location.pathname)
const route = match(path)
const app = <StrictMode><App path={path} /></StrictMode>
// страницы заранее собраны в HTML (для поисковиков) — «оживляем» готовую разметку, если она от этой же страницы
const same = el.dataset.path === (route.type === '404' ? '__404__' : route.path)
if (el.hasChildNodes() && same) hydrateRoot(el, app)
else { el.textContent = ''; applyHead(head(route)); createRoot(el).render(app) }
