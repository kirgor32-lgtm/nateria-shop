# Архитектура: CRM на отдельном сервере, без Hermes

Решено (11.11.2026): пока не переезжаем физически — только проектируем схему,
чтобы при переезде на реальный VPS всё включилось без переделок.

## Зачем
Текущая схема (CRM запущена вручную на ПК Кирилла, пересборку сайта делает
cron внутри Hermes) ломается, если ПК выключен или Hermes не запущен. Новая
схема не зависит ни от того, ни от другого — работает на серверах GitHub
и на отдельном сервере CRM, 24/7, сама себя поднимает после сбоя.

## Схема
```
[VPS, systemd]                              [GitHub]
  CRM (node server.js)                       main branch сайта
  Restart=always, enable при загрузке
       ▲
       │ https (публичный адрес/домен)
       │
[GitHub Actions, каждые 15 мин, cron на серверах GitHub]
  1. node scripts/fetch-crm-prices.mjs  (дёргает CRM по CRM_CATALOG_URL+ключ)
  2. если цены изменились → vite build + prerender
  3. git commit + push (цены) → main
  4. publish → gh-pages (сайт обновился)
```
Решение (11.11.2026): триггер — **по расписанию, раз в 15 минут** (poll), не
вебхук. Проще, не нужен GitHub-токен внутри CRM. Если позже понадобится
мгновенное обновление — можно добавить вебхук (CRM → `repository_dispatch`),
файл воркфлоу это не меняет кардинально.

## Что уже готово (лежит в репозиториях, ждёт переезда)
- `crm-hub/deploy/crm.service` — systemd юнит: автозапуск при загрузке
  сервера + автоперезапуск при падении (`Restart=always`).
- `hvostik-shop-minimal/.github/workflows/sync-crm-prices.yml` — воркфлоу
  GitHub Actions. Сейчас **выключен** (только ручной запуск,
  `workflow_dispatch`), потому что CRM ещё не имеет публичного адреса —
  раскомментировать `schedule:` после переезда.
- `crm-hub/src/api.js` → `/api/public/catalog?key=pk_...` — уже отдаёт
  каталог, готов для вызова снаружи (если открыть порт/домен наружу).
- `hvostik-shop-minimal/scripts/fetch-crm-prices.mjs` — уже умеет брать
  `CRM_CATALOG_URL`/`CRM_SITE_KEY` из переменных окружения (не хардкод).

## Чек-лист переезда (когда будет сервер)
1. Арендовать VPS (любой, даже самый дешёвый — CRM легковесная, sqlite).
2. Поставить Node.js, скопировать `crm-hub/` туда (без `node_modules`,
   `npm ci --production`), завести `.env` с секретами (сессии, пароли и т.п.).
3. `systemctl enable --now crm` по инструкции в `deploy/crm.service`.
4. Повесить домен + HTTPS (nginx + certbot, или Caddy — сам выпускает
   сертификат).
5. В GitHub репозитория `hvostik-minimal` → Settings → Secrets добавить
   `CRM_CATALOG_URL` (напр. `https://crm.хвостик.рф/api/public/catalog`) и
   `CRM_SITE_KEY` (значение `brand.api_key` из CRM, таблица brands).
6. В `sync-crm-prices.yml` раскомментировать `schedule:`, закоммитить.
7. Проверить: `gh workflow run sync-crm-prices.yml` руками один раз,
   посмотреть лог в Actions.
8. Отключить/удалить cron-задачу Hermes `hvostik-minimal: автопубликация
   цен из CRM` (bd7b2206cfe9) — больше не нужна, её роль берёт на себя
   GitHub Actions.
9. Остановить и забыть про локальный `node server.js` на ПК — CRM теперь
   только на VPS.

## Алерты о сбоях без Hermes
Отложено («разберёмся потом» — решение от 11.11.2026). GitHub Actions по
умолчанию шлёт e-mail владельцу репозитория при упавшем workflow — этого
достаточно как минимум на старте, отдельный Telegram-канал можно добавить
позже без переделки остальной схемы.
