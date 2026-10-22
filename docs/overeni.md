# Ověření říjnového základu

Aktualizace 22. 10. 2026 na Windows a Node 24.11.1. Rozsah aplikace odpovídá říjnovému seznamu uživatele s doplněním vytvoření zaměstnance při zakládání účtu. Řidič má pouze úvod s údaji účtu a odhlášení; dispečer má navíc správu účtů.

## Automatické kontroly

- `npm.cmd test`: 39 testů prošlo včetně vytvoření nového zaměstnance s účtem, PostgreSQL varianty, bezpečné diagnostiky nasazení, textové chyby API a domén Vercelu.
- `npm.cmd run check`: TypeScript prošel.
- `npm.cmd run build`: TypeScript a produkční sestavení prošly.
- `npm.cmd run check:runtime`: serverové API se přeloží v režimu NodeNext a načte přímo v nativním Node.js bez `tsx` nebo Vite. Tento krok je součástí buildu.

Testy pokrývají hashování hesel, session cookie, odhlášení, omezení chybných pokusů, CSRF, vytvoření a editaci účtu, role, deaktivaci, reset hesla a ochranu posledního dispečera. Ověřují také zneplatnění session při změně účtu, odmítnutí duplicity bez změny dat a zastaralý zápis.

Nové HTTP testy ověřují vytvoření propojeného profilu a účtu, přidělení evidenčního kódu, přihlášení nového řidiče, společný audit bez hesel a vrácení celé transakce při duplicitním username. Odmítají prázdná jména, současný výběr existujícího i nového profilu a vytvoření profilu řidičem.

Pět integračních testů PostgreSQL nad PGlite ověřuje opakovatelné migrace, prvního dispečera, neměnný audit, přihlášení, souběžné vytvoření zaměstnanců, rollback, role, změnu a reset hesla, deaktivaci a ochranu posledního dispečera. Session i limit chybných přihlášení fungují mezi dvěma instancemi API. HTTP testy procházejí také Vercel adaptérem s přepisem API cesty. Živé připojení k Neonu bylo podle uživatelova Build Logu ověřeno; první migrace selhala kódem `42703` na pozici 8. Oprava tuto chybu reprodukuje na cizí `public.schema_migrations`, zavádí vlastní schéma `forester` a testuje zachování cizích účtů i konfigurace. Úspěšnou migraci a skutečné směrování Vercelu je ještě potřeba ověřit po nasazení opravy.

Další dva testy ověřují, že diagnostika nasazení uvádí fázi a databázový kód bez výpisu připojovacích údajů, a že SSL aliasy současného ovladače zůstávají při normalizaci na `verify-full` ověřované.

Na veřejné adrese `/api/health` a `/api/bootstrap` byly po prvním úspěšném buildu ověřeny textové HTTP 500 `FUNCTION_INVOCATION_FAILED`. Lokální import sestaveného ESM API reprodukoval `ERR_MODULE_NOT_FOUND` kvůli relativním importům bez přípony. Oprava doplňuje `.js` přípony a zavádí kontrolu nativního spuštění. Dva klientské testy ověřují, že textová chyba serveru zobrazí českou zprávu a správné JSON odpovědi zachovají data i chybové zprávy. Po nasazení commitu `3d7f355` bylo na `forester-peach.vercel.app` ověřeno HTTP 200 JSON pro health a HTTP 401 JSON pro bootstrap bez session.

Prázdný přihlašovací požadavek z přesného originu veřejného webu pak odhalil HTTP 403 kvůli nastavení `APP_ORIGIN`. Další oprava normalizuje URL a přijímá také přesné adresy z důvěryhodných systémových metadat Vercelu. Dva testy ověřují domény produkce, oddělení preview, odstranění cesty a odmítnutí nesouvisející domény. Přihlášení se skutečným heslem uživatele zatím nebylo provedeno.

Samostatné HTTP testy ověřují, že řidič nedostane seznam zaměstnanců ani provozní data, nemůže spravovat účty a provozní API není dostupné ani dispečerovi. Bootstrap neobsahuje práce, techniku ani statistiky.

Testy doménové služby rezervací, souběhu a databázové integrity zůstávají součástí testovací sady. Neznamenají dostupnost rezervací v říjnové aplikaci. Tyto testy používají vlastní databáze a zachovávají pokrytí existujícího datového modelu.

## Manuální QA — k provedení

Připojený prohlížeč nebyl dostupný. Následující body jsou checklist, nikoliv provedené testy.

- [ ] Desktop a mobilní šířka 360 px, světlý i tmavý režim.
- [ ] Přihlášení obou rolí, odhlášení a vypršení session.
- [ ] Řidič vidí pouze úvod a odhlášení, bez práce, techniky a samostatného profilu.
- [ ] Dispečer vidí úvod a správu účtů.
- [ ] Vytvoření a editace uživatele, role, deaktivace a reset hesla.
- [ ] Nový řidič: výchozí možnost „Vytvořit nového zaměstnance“, jméno, příjmení a uložení účtu; poté ověřit také výběr existujícího profilu.
- [ ] Povinná změna dočasného hesla při prvním přihlášení.
- [ ] Přímé otevření správy účtů jako řidič zobrazí odmítnutí.
- [ ] Staré adresy práce, techniky, dispatch a auditu zobrazí nedostupnou stránku.
- [ ] Tab, Shift+Tab, Enter a Escape; focus dialogu a potvrzení neuložených změn.
- [ ] Čitelnost, kontrast, dotykové cíle a absence vodorovného přetékání.
- [ ] Výpadek API, opakování načtení a zachování uložených účtů po restartu.
