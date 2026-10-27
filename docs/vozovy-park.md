# Řidiči a vozový park

Dispečer má v hlavní navigaci části **Řidiči**, **Tahače** a **Návěsy**. Každá nabízí hledání, filtr dostupnosti, přidání, detail a úpravu. Detail má vlastní adresu a funguje po obnovení stránky i přes tlačítka Zpět/Vpřed v prohlížeči. Seznam se obnovuje po uložení a každých 30 sekund, pokud je stránka viditelná.

## Řidiči

Profil obsahuje automatický evidenční kód, jméno, příjmení, telefon, e-mail, stav a poznámku. Profil může existovat bez přihlašovacího účtu; účet se propojí ve správě účtů. Stavy jsou aktivní, dovolená, nemoc, volno a neaktivní.

Neaktivní profil ukončí aktuální soupravu a deaktivuje propojený řidičský účet včetně jeho přihlášení. Opětovná aktivace profilu automaticky nezapíná účet; dispečer obnoví přístup samostatně ve správě účtů. Změna jména profilu nepřepisuje zobrazované jméno přihlašovacího účtu.

## Technika

Tahač obsahuje SPZ, výrobce, model, rok, nosnost v kg, typ, VIN, tachometr v km, hydraulickou ruku, provozní stav, poznámku a fotografie. Návěs obsahuje SPZ, výrobce, model, rok, nosnost, typ, provozní stav a poznámku. Stavy jsou provozuschopné, v servisu, mimo provoz a neaktivní.

SPZ je unikátní napříč tahači i návěsy bez ohledu na velikost písmen a mezery. VIN je volitelný, unikátní a má 17 znaků. Nosnost musí být kladné celé číslo; chybějící hodnoty jsou `NULL`, nikdy umělá nula.

Servis a stav mimo provoz zachovají stálé přiřazení a zobrazí nedostupnost. Neaktivní technika ukončí přiřazení celé soupravy. Žádný z těchto kroků nepřepisuje již naplánované přepravy.

### Fotografie

Tahač může mít až čtyři fotografie JPG, PNG nebo WebP. Prohlížeč přijímá vstup do 15 MB, zmenší delší stranu na nejvýše 1400 px a uloží JPEG do 500 kB. Lze zobrazit náhled, fotografii odebrat a v detailu otevřít originál uložené verze.

Fotografie se ukládají do databáze, fungují tedy na SQLite i bez trvalého filesystemu na Vercelu. API ověřuje formát, podpis souboru, velikost a počet. Seznamy obsahují pouze počet fotografií; obrázky mají vlastní autentizované endpointy. Audit neobsahuje obrazová data. Limit JSON těla pro tahače je 3 MB, ostatní požadavky zachovávají 16 kB.

## Soupravy a dostupnost

V detailu řidiče nebo tlačítkem přiřazení v jeho řádku lze vybrat tahač a volitelný návěs, vyměnit soupravu, odebrat návěs nebo ukončit přiřazení. Návěs nelze přiřadit bez tahače. Ovládání u detailu techniky vede ke stejnému formuláři jejího řidiče.

Jeden řidič má nejvýše jednu otevřenou soupravu. Jeden tahač nebo návěs patří nejvýše jednomu řidiči. Obsazenou techniku je nutné nejprve uvolnit. Nepřítomnost, odstávka a použití techniky jiným řidičem na právě probíhající přepravě brání novému přiřazení. Změna uzavře předchozí interval a otevře nový; posledních 20 přiřazení je v detailu řidiče i techniky.

Dostupnost se odvozuje v tomto pořadí:

1. Neaktivní záznam nebo ručně evidovaný nedostupný stav.
2. Právě platná nepřítomnost řidiče nebo odstávka techniky.
3. Rezervace pro právě probíhající přepravu; stav přepravy `in_progress` blokuje techniku i po plánovaném konci.
4. Přiřazení do stálé soupravy.
5. K dispozici.

Filtr **Bez přiřazení** je nezávislý na provozuschopnosti: může ukázat například i nepřiřazený tahač v servisu. Stálá souprava slouží k evidenci, není novou rezervací přepravy.

## API, migrace a ochrana změn

- `GET /api/fleet` – konzistentní přehled řidičů, techniky, aktuálních přiřazení a dostupnosti.
- `GET/POST /api/drivers`, `/api/vehicles`, `/api/trailers` – seznam a vytvoření.
- `GET/PATCH /api/{drivers|vehicles|trailers}/:id` – detail s historií a úprava.
- `PUT /api/drivers/:id/assignment` – změna soupravy, `vehicleId`, `trailerId`, `version` řidiče.
- `GET /api/vehicles/:id/photos/:index` – chráněná fotografie.

Všechny endpointy vyžadují dispečera, zápisy také CSRF a povolený origin. Úpravy používají verze; zastaralý formulář vrátí 409 a ponechá rozepsané údaje. Přiřazení a jeho ukončení zvyšují také verze souvisejících profilů a techniky. Transakce chrání obchodní změnu spolu s auditem. Částečné unikátní indexy v obou databázích chrání výlučnost otevřených souprav; PostgreSQL používá také existující transakční advisory lock pro souběh mezi instancemi serveru.

Migrace jsou `003-fleet.sql` pro SQLite a `002-fleet.sql` pro PostgreSQL. Přidávají pole do existujících tabulek; dosavadní profily, technika a historie zůstávají zachované. PostgreSQL migrace proběhne přes stávající `db:deploy`, SQLite při otevření databáze. Pro již existující databázi s duplicitními otevřenými přiřazeními je nutné nejprve opravit tyto konflikty; unikátní index je nepřijme.

## Ověření

`npm.cmd test` spouští společnou sadu integračních scénářů nad SQLite a PostgreSQL (PGlite): CRUD, validace a unikátnost SPZ/VIN, zastaralé verze, souběžné přiřazení stejné soupravy, konflikt samostatného návěsu bez částečného zápisu, historie, fotografie a jejich přístupová ochrana, role, CSRF, nepřítomnost, deaktivace účtu a odhlášení.

`npm.cmd run build` ověří TypeScript, nativní Node runtime a vytvoří frontend. Responzivní kontrola v prohlížeči nenahrazuje ověření skutečné dotykové klávesnice a safe areas na fyzickém telefonu.

### Výsledek kontroly 27. 10. 2026

- Všech **50 testů** prošlo. Prošlo také produkční sestavení a kontrola nativních Node importů.
- V oddělené testovací databázi prošel celý postup v prohlížeči: přihlášení, vytvoření/úprava řidiče, hledání a filtry včetně prázdného výsledku, vytvoření/úprava tahače a změna stavu, zmenšení a uložení fotografie, vytvoření návěsu, přiřazení soupravy, obnovení detailu a historie prohlížeče.
- Nové obrazovky neměly vodorovný přesah při 360, 390, 768 a 1440 px. Ověřeno otevření mobilní navigace, formulář, počáteční fokus, Escape a tmavý režim. V prohlížeči nebyly zachyceny JavaScript výjimky.
- Automatický vizuální inspektor na seznamech řidičů, tahačů a návěsů při 1440/768/390 px: **0 chyb a 0 varování**. Detaily řidiče a tahače ve tmavém režimu: **0 chyb**, jedno varování na odlišnou výšku sousedních panelů na desktopu. Panely zůstávají vysoké podle svého obsahu, aby kratší kontaktní část neměla umělou prázdnou plochu.

Vizuální směr je **Accent ladder**, seed `68370965`, s původními barvami a fonty Foresteru. Pracovní motiv je řidič se svou konkrétní soupravou: veškeré identifikátory, dostupnost i historie se vykreslují ze stejných databázových záznamů. Stávající značku a zelenou navigaci aplikace zachováváme. Nejsou doplněny žádné cizí fotografie; demo ponechává fotografii prázdnou do nahrání vlastních snímků.

Závěrečná vizuální revize: hlavní seznam odpovídá otázce „kdo a s čím jezdí“, počty vycházejí z filtrovaných řádků, SPZ a jména souhlasí mezi seznamem a detailem, chybějící údaje jsou výslovně označené, stav má textové označení i barevný bod. Na tabletu se navigace skládá a poslední lichá karta vyplní šířku; na telefonu je aktuální souprava před kontaktními údaji. Fyzický telefon zatím ověřen nebyl.

Lokální screenshoty a měření jsou v ignorované složce `artifacts/fleet-final-*`; testovací fotografie a profily zůstávají jen v oddělené QA databázi v `artifacts/`.
