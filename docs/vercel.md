# Vercel a Neon PostgreSQL

Frontend a API běží v jednom existujícím Vercel projektu. API používá PostgreSQL podle `DATABASE_URL`; lokální vývoj bez této proměnné používá původní SQLite. Nasazení nevyžaduje přesun frontendu ani nový Vercel projekt.

## 1. Samostatná databáze pro Forester

Ve svém existujícím Neon účtu založ samostatný projekt **Forester**. Použij region poblíž Vercel funkce. Připojení jiného projektu znovu nepoužívej: tato aplikace vytváří vlastní tabulky `users`, `employees`, `sessions` a další.

V PostgreSQL Forester používá vlastní schéma **`forester`**, včetně `forester.schema_migrations`. Existující tabulky v `public` se nemažou, neupravují a nepoužívají pro přihlašování Foresteru. Migrační DDL má transakční `SET LOCAL search_path`; běžné dotazy odkazují přímo na `forester.*`, takže výběr schématu nezávisí na session stavu pooleru. Triggerové funkce mají vlastní pevný `search_path`. Schéma odděluje názvy objektů; samostatný Neon projekt nadále odděluje provoz a přístupové údaje aplikací.

Ve Vercelu otevři existující projekt Forester → **Storage / Marketplace** → **Neon** a připoj databázi Foresteru. Alternativně nastav `DATABASE_URL` přímo v **Settings → Environment Variables**. Použij připojení s poolingem (hostname obsahuje `-pooler`) a zachovej parametry TLS dodané Neonem.

Připojovací URL obsahuje heslo: patří jen do serverového prostředí, nikoliv do Git repozitáře nebo proměnné s prefixem `VITE_`.

## 2. Prostředí Vercelu

Pro **Production** nastav:

| Proměnná        | Hodnota                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`  | Připojení k databázi Foresteru z Neonu; integrace ho může doplnit sama.                  |
| `APP_ORIGIN`    | Přesná adresa webu, např. `https://forester.example`, bez koncového lomítka a bez cesty. |
| `INIT_USERNAME` | Přihlašovací jméno prvního dispečera, např. `dispecer`.                                  |
| `INIT_PASSWORD` | Vlastní nové heslo o 12–128 znacích.                                                     |

Pokud `APP_ORIGIN` není nastavený, API na Vercelu použije `VERCEL_PROJECT_PRODUCTION_URL` pro produkci, respektive `VERCEL_URL` pro preview. Vlastní doménu nastav explicitně přes `APP_ORIGIN`.

Pro **Preview** používej samostatnou Neon větev/databázi a odpovídající proměnné. Build aplikuje migrace do databáze svého prostředí, proto preview nesměruj do produkční databáze. Každé prostředí přijímá pouze svůj nastavený Origin.

## 3. Sestavení a první přihlášení

Vercel má použít konfiguraci z `vercel.json`: framework **Vite**, build **`npm run vercel:build`**, výstup **`dist`**, Node **24.x**. Pokud projekt ručně přepisuje Build Command, nastav jej na `npm run vercel:build` nebo override vypni.

Po nahrání změn spusť redeploy. Build nejprve provede `npm run db:deploy`: transakční PostgreSQL migrace a případné vytvoření prvního dispečera. Potom sestaví frontend. Další deploy již existujícího dispečera ani jeho heslo nepřepíše. Selhání migrací nebo inicializace zastaví build.

Otevři `/api/health`; odpověď má být `{"status":"ok"}`. Přihlas se údaji `INIT_USERNAME` a `INIT_PASSWORD`, založ řidičský účet a ověř jeho přihlášení. Po vytvoření prvního účtu odstraň `INIT_PASSWORD` a `INIT_USERNAME` z Vercel prostředí. Pro další účty použij správu účtů v aplikaci.

Demo účty `dispecer` / `ridic` se do Neonu automaticky nepřenášejí. Lokální SQLite soubor i jeho data zůstávají lokální. Přenos existujících dat je samostatná operace; nasazení vytváří novou databázi.

## Co je v projektu připravené

- `api/index.ts`: společný vstup pro API, sdílený pool s `attachDatabasePool` a bezpečná odpověď při nedostupné konfiguraci.
- `vercel.json`: směrování `/api/*` do funkce a ostatních aplikačních adres do SPA.
- `server/postgres.ts` a `server/postgres-migrations`: databázové připojení, migrace, první dispečer a PostgreSQL varianta celého datového modelu.
- `server/store.ts`: asynchronní dotazy a transakce pro PostgreSQL i místní SQLite. Každá PostgreSQL transakce používá jediného klienta; zápisy účtů se serializují databázovým zámkem i mezi různými instancemi API.
- `login_attempts`: databázový limit chybných přihlášení sdílený mezi instancemi. Neukládá přímo IP, jen její SHA-256 hash a čas expirace. Lokální SQLite nadále používá limit v paměti procesu.

## Ověření

`npm run build` ověřuje TypeScript a frontend bez potřeby online databáze. `npm test` spouští původní SQLite testy i integrační testy PostgreSQL nad PGlite (PostgreSQL ve WASM). Ty ověřují SQL migrace, účet, session, role, reset hesla, atomické uložení a sdílené omezení přihlášení. Živé připojení k Neonu a směrování na Vercelu je potřeba ověřit po propojení účtů a nasazení.

Build navíc spouští `npm run check:runtime`: přeloží API a server v režimu NodeNext do ignorované složky `artifacts/runtime` a načte vstup API v nativním Node.js. Relativní serverové importy mají `.js` příponu, aby fungovaly i po překladu TypeScriptu bez vývojového loaderu. Kontrola nepotřebuje databázové heslo a neotevírá síťové spojení. Úspěšné sestavení samo nenahrazuje kontrolu `/api/health` a přihlášení na veřejné adrese.

Při neúspěšném buildu ukáže `db:deploy` fázi (`připojení`, `migrace`, `první účet`) a kód chyby. Například `28P01` znamená odmítnuté přihlašovací údaje, `42P07` již existující tabulku/index (možný konflikt s databází druhé aplikace), `42501` chybějící oprávnění. Log neobsahuje URL, hesla, SQL dotazy ani DETAIL z databázových chyb. Žluté upozornění ovladače na budoucí význam `sslmode` samo není chybou nasazení; kód výslovně zachovává současné ověřování certifikátu pomocí `verify-full`.

Zdroje: [Vercel Functions pro Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Vite na Vercelu](https://vercel.com/docs/frameworks/frontend/vite), [connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [Neon připojení](https://neon.com/docs/get-started/connect-neon).
