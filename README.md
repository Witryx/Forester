# Forester

Interní web pro přepravu dřeva a lesní těžbu. Říjnový rozsah podle seznamu uživatele: databázový návrh, přihlášení a odhlášení, role Dispečer / Řidič, deaktivace, základ správy účtů a UI/UX. Dispečer má úvod a správu účtů; řidič pouze úvod s údaji účtu a odhlášení. React + TypeScript, Express, lokální SQLite nebo PostgreSQL (Neon / Vercel); Node **24.11+ v řadě 24.x**.

## Spuštění

```powershell
npm.cmd ci
npm.cmd run db:seed
npm.cmd run dev
```

Web: **http://127.0.0.1:5173/**. API: `http://127.0.0.1:3001`.

V PowerShellu používejte `npm.cmd`, pokud execution policy blokuje `npm.ps1`. Na jiných systémech stačí `npm`.

| Demo role          | Username   | Heslo               |
| ------------------ | ---------- | ------------------- |
| Dispečer           | `dispecer` | `ForesterDemo!2026` |
| Řidič Martin Novák | `ridic`    | `ForesterDemo!2026` |

Hesla jsou výhradně pro lokální ukázku. Demo obsahuje dva uživatelské účty a tři profily zaměstnanců pro přiřazení řidičských účtů. Při zakládání řidičského účtu lze vybrat existujícího zaměstnance nebo vytvořit nového zadáním jména a příjmení. Evidenční kód se přidělí automaticky a profil se uloží společně s účtem. Data se uchovávají v `data/forester.sqlite`; při dalších spuštěních nevznikají znovu. Seed obsahuje také interní data pro ověření databázového modelu, provozní moduly však nejsou v říjnové aplikaci dostupné.

## Kontroly a sestavení

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

`start` servíruje sestavený frontend i API na **http://127.0.0.1:3001/**. SQLite může vypsat upozornění na experimentální vestavěné API; pro projekt používejte uvedenou Node verzi. Produkční nasazení zatím není ověřené.

## Konfigurace a první vlastní účet

Volitelně zkopírujte `.env.example` do `.env`. Skripty API a DB načítají `.env`; soubor je ignorovaný Gitem. Výchozí hodnoty fungují bez něj.

Pro vlastní prázdnou databázi nastavte `DATABASE_PATH`, `INIT_USERNAME` a silné `INIT_PASSWORD` (12–128 znaků) v prostředí nebo `.env`, spusťte `npm.cmd run db:init`, poté inicializační heslo z konfigurace odstraňte. CLI vytvoří pouze prvního dispečera. Další účty zakládá dispečer v UI. Veřejná registrace neexistuje.

`NODE_ENV=production` vyžaduje HTTPS origin a odmítne databázi s demo daty. Pro vlastní server se SQLite potřebujete HTTPS reverse proxy, trvalý disk a zálohování. Port a bind adresu nastavují `PORT` a `HOST`, výchozí je pouze loopback. Vývojová proxy ve `vite.config.ts` míří na port 3001; při změně API portu ji také upravte.

## Vercel a Neon

Do existujícího Vercel projektu připojte samostatnou Neon databázi Foresteru. Nastavte `DATABASE_URL`, `APP_ORIGIN` a pro první deploy také `INIT_USERNAME` a `INIT_PASSWORD`. Konfigurace `vercel.json` používá `npm run vercel:build`, který aplikuje PostgreSQL migrace, případně vytvoří prvního dispečera a sestaví frontend. Lokální SQLite se automaticky nekopíruje a demo přihlašovací údaje v nové databázi neexistují. Podrobný postup je v [docs/vercel.md](docs/vercel.md).

## Obnova demo prostředí bez mazání stávajících dat

Ukončete běžící server a použijte nový DB soubor:

```powershell
$env:DATABASE_PATH = './data/forester-demo-new.sqlite'
npm.cmd run db:seed
npm.cmd run dev
```

Původní databáze zůstane zachovaná. Seed je opakovatelný, transakční a odmítá vložit demo do již inicializované vlastní DB. Pro souborovou zálohu zastavte server a uchovejte DB spolu s případnými soubory `-wal` a `-shm`; automatický produkční backup se bude řešit s hostingem.

## Dokumentace

- [Kompletní říjnové zadání](docs/rijnove-zadani.md) — výstupy, akceptace, harmonogram a hranice rozsahu.
- [Původní PRD](docs/prd.md) — zachované znění přiloženého dokumentu.
- [Architektura](docs/architektura.md), [ERD a datový slovník](docs/erd.md).
- [UI/UX a wireframy](docs/ui-ux.md), [ověření a manuální checklist](docs/overeni.md).

Rozhraní ani API neposkytují práci řidiče, techniku, plán přeprav, rezervace nebo prohlížení auditu. Databázový model a interní audit změn účtů zůstávají zachované. Vizuální a klávesnicové QA v prohlížeči, zejména při 360 px a v obou režimech, zbývá ověřit.
