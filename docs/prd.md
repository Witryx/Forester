# Forester – Product Requirements Document

> Rozsah aktuální říjnové aplikace byl 20. 10. 2026 podle výslovného požadavku uživatele zúžen na jeho říjnový seznam: databázový návrh, přihlášení a role, správu uživatelů a UI/UX. Aktuální rozsah popisuje `docs/rijnove-zadani.md`; širší harmonogram níže není seznamem dodaných funkcí.

**Verze:** 1.0  
**Datum:** 9. 10. 2026  
**Autor projektu:** Petr Hetzendorf  
**Produkt:** webová aplikace pro přepravu dřeva a lesní těžbu  
**Stav:** implementační návrh; doplněná rozhodnutí jsou výslovně označena.

## 1. Účel a zdroje

PRD sjednocuje kompletní zadání Foresteru do podkladu pro návrh databáze, rozhraní, vývoj a ověření. Obsahuje maturitní minimum i cílovou rozšířenou aplikaci. Rozdělení do fází určuje pořadí dodání, nikoliv odstranění funkcí z produktové vize.

Primární zdroje:

- **S1: Forester – maturitní verze projektu.pdf**, 16 stran, 19 hlavních částí.
- **S2: Forester – kompletni projekt (hotova stranka).pdf**, 19 stran, 34 hlavních částí.
- **S3: Projektové zadání v dosavadní konverzaci:** název Forester, plán říjen–únor, UI/UX v každém měsíci, dispečer a řidiči.

S1 určuje minimum maturitní verze. S2 doplňuje cílovou aplikaci. Při rozporu s dřívějším plánem mají aktuální PDF přednost: veřejný prezentační web se v první fázi neimplementuje. S1 výslovně požaduje samostatného AI asistenta, proto patří do maturitního minima.

**Význam formulací:** „musí“ označuje požadované chování pro uvedenou fázi. „Návrhové rozhodnutí“ označuje zpřesnění, které původní dokumenty neřeší; jde o výchozí implementační pravidlo, které může autor upravit. „Volitelné“ znamená nepovinné rozšíření. Konkrétní technologie, poskytovatel AI a hosting dosud nejsou potvrzené.

## 2. Produktová vize a cíle

Forester poskytne dispečerovi jedno místo pro plánování přeprav, správu lidí a techniky, kontrolu dostupnosti, tankování, servis a těžbu. Řidiči získají jednoduché mobilní rozhraní s vlastní prací a možností zapisovat provozní údaje.

Hlavní hodnota vzniká propojením dat. Dovolená řidiče ovlivňuje plánování, konflikty, dashboard a AI. Servisní odstávka blokuje použití vozidla v daném období. Dokončená práce aktualizuje historii a statistiky. Tankování patří do historie stroje a později do nákladů.

### 2.1 Řešené problémy

| Problém | Požadované zlepšení |
| --- | --- |
| Údaje o práci jsou rozptýlené | Společná evidence s propojenými detaily |
| Dostupnost se kontroluje ručně | Vyhodnocení konkrétního intervalu |
| Dvojí rezervace lidí a techniky | Blokování konfliktů před uložením |
| Řidič nemá aktuální instrukce | Mobilní karta přidělené práce |
| Servisní termíny a náklady se ztrácejí | Historie, plán odstávek a upozornění |
| Výběr soupravy závisí na paměti | Vysvětlitelné doporučení nad aktuálními daty |
| Není jasný autor změny | Auditní stopa důležitých operací |

### 2.2 Kritéria úspěchu

Maturitní aplikace musí umožnit celý tok od vytvoření zakázky přes doporučení a přiřazení po dokončení řidičem a dohledání historie.

| Cíl | Ověření |
| --- | --- |
| Oddělení rolí | Řidič nezíská administraci, finance ani cizí práci přes UI ani API |
| Spolehlivé plánování | Překryvy řidiče, tahače i návěsu jsou blokovány i při souběžném uložení |
| Propojená dostupnost | Nepřítomnost a odstávka se projeví ve všech souvisejících modulech |
| Mobilní použitelnost | Na šířce 360 px lze dokončit práci a zapsat tankování |
| Důvěryhodná AI | Výsledek neporušuje tvrdé podmínky a vysvětlení odpovídá datům |
| Dohledatelnost | Přiřazení, stavy, ceny a archivace mají autora, čas a rozdíl hodnot |

**Návrhové cíle uživatelského testu:** po krátkém seznámení vytvořit a přiřadit běžnou zakázku do 3 minut; změnit stav práce řidičem z hlavní obrazovky do 3 akcí. Jde o cíle k ověření, nikoliv naměřené výsledky.

## 3. Uživatelé a rozsah

### 3.1 Role

- **Dispečer / administrátor:** spravuje účty, řidiče, techniku, zakázky, těžbu, servis, audit, archiv, AI a nastavení; později také finance.
- **Řidič / zaměstnanec:** vidí vlastní práci, přidělenou techniku a oznámení; zapisuje tankování a povolené stavy; může vložit vlastní práci.
- **Veřejný návštěvník:** v pozdější fázi vidí pouze prezentační web.

Samostatná role majitele není v PDF definována. Budoucí manažerská role vyžaduje samostatné oprávnění.

### 3.2 Výchozí předpoklady

**Návrhová rozhodnutí:** jedna instalace pro jednu firmu, online webová aplikace, čeština, měna CZK, místní časy Europe/Prague a uložení časových okamžiků v UTC. Více firem, nativní mobilní aplikace a offline synchronizace nejsou požadovány.

### 3.3 Fáze

- **M – maturitní verze:** všech 19 částí S1 v níže stanovené minimální hloubce.
- **R – rozšířená interní aplikace:** dodatečné funkce S2.
- **W – veřejný prezentační web:** následující fáze.

| Oblast | M – minimum | R / W – rozšíření |
| --- | --- | --- |
| Účty | Přihlášení, odhlášení, role, deaktivace, správa účtů | Samoobslužný profil a změna hesla |
| Řidiči | Evidence, nepřítomnosti, stavy, souprava, historie | Podrobné km a vytížení |
| Tahače | Evidence, fotografie, tachometr, nosnost, ruka, historie | Náklady a podrobné statistiky |
| Návěsy | Oddělená evidence, přiřazení, dostupnost | Podrobnější servis |
| Zakázky | Evidence, stavy, obsazení, cena, kontakty, filtry, archiv | Mapová vzdálenost a profit |
| Dispatch | Denní přehled a vlastní práce řidiče | Kalendář den / týden / měsíc |
| Konflikty | Překryvy, nepřítomnosti, odstávky a vhodnost | Ověřená přejezdová doba |
| AI doporučení | TOP 3 a důvody | Pokročilejší skóre a vzdálenost |
| AI asistent | Přirozený jazyk nad reálnými daty, čtení | Další typy dotazů |
| Mobilní část | Vlastní práce, tahač, dokončení, tankování | Detailní kroky přepravy |
| Tankování | Litry, autor, čas, volitelné km, měsíční cena | Externí orientační cena, finance |
| Servis | Historie, intervaly, plán, upozornění | Servisní firma a návěsy |
| Těžba | Porost, harvestor, m³, MTH, cena, tankování, hajní | Srovnání výkonu |
| Dashboard | Provozní přehled a základní grafy | Finance a podrobné statistiky |
| Oznámení | Relevantní upozornění v aplikaci | Další kanály pouze novým zadáním |
| Audit / archiv | Historie změn a zachované vazby | Finance a širší archiv kontaktů |
| Vzhled | Responzivita, světlý a tmavý režim | Stejná identita veřejného webu |
| Administrace | Účty, palivové ceny, intervaly a nutné číselníky | Rozšířená konfigurace |
| Vyhledávání | Hledání a filtry uvnitř modulů | Globální hledání |
| Finance | Evidované ceny a náklady v příslušných záznamech | Příjmy, náklady, profit a dashboard |
| Veřejný web | Připravené oddělení od interní části | W: firma, služby, technika, kontakt |

### 3.4 Mimo první verzi

Podle S2: export dat, samostatná mapa, živé GPS, samostatný modul lokací a dokumenty řidičů. Výpočet vzdálenosti přes mapové API v R nevyžaduje mapovou obrazovku.

**Dodatečné návrhové hranice:** bez účetnictví, fakturace, mezd, automatického přidělování AI, diagnostiky závad, veřejné registrace a offline režimu. Oznámení „nový úkol“ ze S2 neznamená samostatný modul úkolů; může označovat novou práci.

## 4. Oprávnění

Oprávnění se ověřují na serveru při každém čtení a zápisu, včetně vyhledávání, agregací, fotografií a AI nástrojů. Skrytí tlačítka nenahrazuje autorizaci.

| Operace | Dispečer | Řidič / zaměstnanec |
| --- | --- | --- |
| Účty a role | Správa | Ne |
| Řidiči a nepřítomnosti | Všichni | Vlastní základní údaje pro čtení |
| Zakázky | Všechny, správa | Vlastní, povolené změny stavu |
| Cena zakázky a finance | Ano | Ne |
| Vložení vlastní práce | Ano | Ano pod vlastní identitou |
| Přiřazení jiného člověka či soupravy | Ano | Ne |
| Technika | Veškerá data | Přidělená technika bez financí a cizí historie |
| Zápis tankování | Ano | Ano pro aktivní techniku firmy |
| Oprava tankování | Auditovaná oprava / zneplatnění | Ne, řeší dispečer |
| Servis a těžba | Správa | Relevantní upozornění, bez správy v M |
| AI | Ano | Ne |
| Oznámení | Provozní přehled firmy | Pouze vlastní |
| Audit, archiv, nastavení | Ano | Ne |

**Návrhové rozhodnutí pro tankování:** „každý zaměstnanec“ může vybrat i jiný aktivní tahač nebo harvestor. Výběr poskytne pouze identifikaci stroje, ne jeho ostatní data. Autor zápisu se vždy převezme ze session. Dispečer při zápisu za jiného člověka eviduje zvlášť skutečného tankujícího a autora.

Deaktivovaný účet se nepřihlásí a jeho staré session se zneplatní. Historie zůstane zachována. Server nikdy nepovažuje ID uživatele zaslané klientem za důkaz jeho identity.

## 5. Doménová pravidla

### 5.1 Interval zakázky

Pouhé datum a čas nestačí pro spolehlivé konflikty. **Návrhové rozhodnutí:** naplánovaná práce má začátek a konec; konec musí být pozdější. Čekající práce může mít předběžný termín, ale před přiřazením musí mít úplný interval. Přeprava přes půlnoc je podporována.

Intervaly jsou polouzavřené [začátek, konec). Konflikt nastává při A.start < B.end a B.start < A.end. Práce končící v 12:00 proto časově nekoliduje s prací od 12:00. Reálnou dosažitelnost dalšího místa řeší v M dispečer; R může přidat ověřenou přejezdovou dobu. Časová dostupnost sama nedokazuje dosažitelnost trasy.

Nepřítomnost 12.–18. ledna zahrnuje celé dny: od 12. 1. 00:00 do 19. 1. 00:00 místního času. Odstávka bez známého konce blokuje prostředek od svého začátku až do ukončení.

### 5.2 Životní cyklus zakázky

| Stav | Význam | Povolené běžné přechody |
| --- | --- | --- |
| Čeká na přiřazení | Bez potvrzeného obsazení | Naplánovaná, zrušená |
| Naplánovaná | Ověřený interval a souprava | Probíhá, čeká na přiřazení, zrušená |
| Probíhá | Skutečně zahájená práce | Dokončená, zrušená dispečerem |
| Dokončená | Ukončená práce | Jen auditovaná oprava dispečerem |
| Zrušená | Ukončená bez běžného dokončení | Explicitní obnovení dispečerem s novou validací |

**Archiv je atribut, nikoliv provozní stav.** Archivovaná dokončená zakázka zůstává dokončená. Zrušení uvolní rezervace a přesune práci do pohledu „Zrušené zakázky“. Uloží se autor, čas a volitelný důvod; bez důvodu se uvede „neuvedeno“. **Návrhové zpřesnění:** zrušení probíhající práce důvod vyžaduje.

V M řidič zahájí vlastní práci a označí ji dokončenou. Zjednodušené „Dokončit“ může u naplánované práce provést oba přechody jednou transakcí a zaznamenat zjednodušený postup. R přidává podstavy převzato, cesta na nakládku, naloženo, přeprava a vyloženo. Podstavy nenahrazují hlavní stavový automat.

Probíhající práce po plánovaném konci stále blokuje použití týchž prostředků až do ukončení nebo vyřešení skutečného konce dispečerem. Ovlivněná budoucí práce je označena k přeplánování. Dokončené a zrušené práce neblokují budoucí intervaly.

### 5.3 Dostupnost

Odděleně se ukládá administrativní aktivita, provozní omezení a rezervace. „Dostupný“ a „na zakázce“ se odvozují společnou logikou.

- Řidič: neaktivní → nepřítomnost → probíhající práce → dostupný nyní.
- Technika: neaktivní → odstavená → servisní odstávka → probíhající práce → dostupná nyní.
- Dostupnost pro termín navíc zohledňuje všechny rezervace v celém intervalu.
- Servisní upozornění samo o sobě neznamená odstávku.
- Dovolená řidiče automaticky neblokuje jeho běžný tahač. Vozidlo lze použít s jiným řidičem.

### 5.4 Souprava a vhodnost

Běžné přiřazení tahače a návěsu slouží k předvyplnění. Rezervace vzniká konkrétní zakázkou. Změna běžné soupravy nesmí zpětně přepsat historické práce.

M používá jednoho řidiče, jeden tahač a nejvýše jeden návěs / přívěs na zakázku. Pokud typ práce návěs vyžaduje, je povinný. U řidiče lze uchovávat více obvyklých návěsů, ale současná rezervace používá jeden; vícečlenné soupravy vyžadují rozšíření.

Hmotnost je v tunách, objem v m³; bez vlastností materiálu se nepřevádějí. Použitelná kapacita soupravy je explicitně zadaná a schválená, nikoliv prostý součet nosností. Bez známé kapacity nelze potvrdit vhodnost práce se zadanou hmotností. Požadovaná ruka / kleště a typ nákladu jsou strukturované údaje. Tvrdé požadavky platí i při ručním výběru.

## 6. Funkční požadavky maturitní verze

Identifikátory FR slouží k návaznosti implementace a testů. Společná pravidla z kapitol 4–5 platí ve všech modulech.

### FR-01: Účty a přihlášení [M; S1 §1, S2 §3, §34]

Dispečer zakládá účet s unikátním username, rolí a aktivitou. Řidičský účet se propojí s profilem zaměstnance. První dispečer vznikne řízenou inicializací. Veřejná registrace není dostupná. Hesla se ukládají pouze bezpečným soleným hashem. Odhlášení a deaktivace zneplatní session. Obnova přístupu v M může být administrativní reset; doporučené zpřesnění je dočasné heslo s povinnou změnou.

**Akceptace:** aktivní účet se přihlásí do správného rozhraní; chyba neprozradí existenci username; deaktivovaný účet i stará session selžou; přímý serverový přístup řidiče do administrace je odmítnut.

### FR-02: Řidiči a nepřítomnosti [M; S1 §2, S2 §10]

Evidence: jméno, příjmení, telefon, volitelný e-mail, unikátní ID zaměstnance, aktivita, běžný tahač a návěs. Detail: současná práce, souprava a historie. Dispečer zadává období dovolené, nemoci a stavu mimo službu.

**Návrhové rozhodnutí:** nemoc nebo jiná skutečná nepřítomnost se může uložit i při existující rezervaci. Systém vypíše ovlivněné práce, označí je „vyžaduje přeplánování“ a upozorní dispečera. Nesmí prezentovat kolidující plán jako platný. Stejně se řeší deaktivace obsazeného řidiče.

**Akceptace:** dovolená vyloučí člověka z doporučení v daném období; jeho dostupné vozidlo lze přidělit někomu jinému; deaktivace nesmaže historii.

### FR-03: Tahače [M; S1 §3, S2 §12–13]

Údaje: SPZ, VIN, výrobce, model, rok, typ, fotografie, tachometr, nosnost / použitelná kapacita, ruka / kleště, aktivita a omezení. Detail propojí řidiče, návěs, aktuální práci, historii, tankování, spotřebu a servis. SPZ a zadaný VIN jsou unikátní. **Návrhové rozhodnutí:** VIN může být při založení nevyplněný; pokud je zadán, validuje se.

Tachometr vychází z ověřených provozních záznamů. Nižší nová hodnota vyžaduje auditovanou opravu nebo výměnu tachometru. Zpětně zadaný starý záznam nesníží aktuální nájezd.

**Akceptace:** karta zobrazí správný návěs a historii; odstávka ovlivní plánování i AI; archivované vozidlo není v nových výběrech.

### FR-04: Návěsy / přívěsy [M; S1 §4, S2 §14]

Samostatná evidence SPZ, výrobce, modelu, typu, nosnosti, roku, aktivity, omezení a přiřazení. Detail odkazuje na tahač, řidiče a zakázky. M umožní blokující odstávku návěsu; podrobný servis patří do R.

**Akceptace:** návěs zůstává samostatnou entitou po změně tahače; dvojí rezervace i použití při odstávce jsou blokovány.

### FR-05: Zakázky [M; S1 §5, S2 §5–6, §8]

Formulář: automatické číslo, zákazník, nakládka, vykládka, plánovaný interval, druh nákladu, volitelná hmotnost a m³, požadované vybavení, cena, poznámka, volitelný hajný, řidič, tahač, návěs. Automaticky se ukládá autor a čas vytvoření. Uživatelské číslo například 2027-042 je odlišné od interního ID a unikátní i při souběžném založení.

Zákazník je opakovaně použitelný kontakt. Místa mohou být adresa nebo srozumitelný popis porostu; samostatný modul lokací se nezavádí. Vzdálenost je v M volitelná ruční hodnota, v R dopočet. Výběr řidiče předvyplní soupravu; ruční změna provede nové kontroly.

Čekající práci lze uložit bez obsazení. Naplánovaná vyžaduje úplný interval a platnou soupravu. Cena se vrací pouze dispečerovi. Přehled má hledání čísla / zákazníka, filtry data, stavu, řidiče a techniky, řazení a stránkování.

**Akceptace:** změna běžného vozidla řidiče nezmění již uloženou práci; zamítnuté obsazení nezanechá částečnou rezervaci; zrušení zachová autora, čas a důvod.

### FR-06: Dispatch a vlastní práce [M; S1 §6, S2 §7]

Denní přehled s volbou data: čas, číslo práce, řidič, tahač, návěs, místa a stav. Přes půlnoc je práce viditelná v obou dnech. Čekající a konfliktní práce jsou rozlišeny.

**Návrhové rozhodnutí:** vlastní práce řidiče vzniká jako návrh pod jeho identitou. Obsahuje místa, termín, náklad a poznámku; čeká na potvrzení dispečera a dosud nerezervuje techniku. Řidič může upravit či stáhnout nepotvrzený návrh. Potvrzenou práci nesmaže, nepřeřadí a zásadně neupraví. Dispečer schvaluje po stejných kontrolách jako běžnou zakázku.

**Akceptace:** návrh upozorní dispečera; schválení neobejde konflikty; řidič neupraví cizí práci ani potvrzenou soupravu.

### FR-07: Kontrola konfliktů [M; S1 §7, S2 §25]

Server před potvrzením přiřazení, změnou termínu či soupravy ověří překryvy, nepřítomnosti, aktivitu, odstávky, vybavení a kapacitu. Upravená zakázka není konfliktem sama se sebou. Tvrdý konflikt nelze obejít ruční volbou ani AI.

Kontrola a zápis rezervace jsou atomické. Použije se transakční zamykání nebo ekvivalentní mechanismus: dva souběžné požadavky nemohou oba obsadit tentýž prostředek v překryvu. UI předběžná kontrola nestačí.

Chyba uvede prostředek a příčinu, například „Řidič má zakázku #2027-042 od 10:00 do 14:00“. Neoprávněnému uživateli nevypíše cizí údaje. Dodatečná nemoc, porucha či zpoždění označí ovlivněné práce k přeplánování; nepřiřazuje automaticky náhradu.

**Akceptace:** jednotlivé překryvy řidiče, tahače a návěsu selžou; navazující interval projde časovou kontrolou; při souběžném konfliktu uspěje nejvýše jeden zápis.

### FR-08: Inteligentní doporučení [M; S1 §8, S2 §9]

Sdílená logika nejprve vyřadí neplatné kombinace řidič–tahač–návěs a následně seřadí vhodné varianty. Nabídne maximálně TOP 3; při menším počtu nevymýšlí další. Nulový výsledek vysvětlí překážky.

Tvrdé podmínky: aktivita, celý interval dostupnosti, nepřítomnosti, servis / odstávka, rezervace, typ a vybavení, známá dostatečná kapacita. Měkká kritéria: vytížení, počet prací ve stejném období, běžná souprava, ověřený nájezd a blízkost servisu. Samotný vysoký nájezd není důkaz závady.

**Návrhové rozhodnutí:** M může používat deterministický skórovací algoritmus s transparentními vahami. Dokument jej neoznačuje za natrénovaný ML model. Skutečná jazyková AI tvoří FR-09. Pokud škola vyžaduje ML přímo v doporučení, musí být tato podmínka potvrzena.

Výsledek má důvody, upozornění, čas vyhodnocení a verzi pravidel. Vzdálenost se hodnotí pouze se známou výchozí polohou; bez GPS se aktuální poloha nedomýšlí. Dispečer přijme, změní nebo ignoruje doporučení. Přijetí předvyplní formulář a před uložením znovu validuje.

**Akceptace:** dovolená a servis mají konkrétní vysvětlení; žádný doporučený kandidát neporuší tvrdé podmínky; změna dostupnosti po doporučení se zachytí při uložení.

### FR-09: AI asistent dispečera [M; S1 §9]

Panel umožní otázky „Kdo je zítra volný?“, „Které tahače mají ruku?“ či „Kdo může ve čtvrtek ráno jet z Děčína do Lovosic?“. Asistent čte aktuální autorizovaná data přes omezené serverové nástroje. Dostupnost zjišťuje stejnými službami jako plánování, nikoliv odlišnou vlastní logikou.

Odpověď uvede konkrétní záznamy, termín a odkazy na detaily. „Zítra“ se interpretuje v Europe/Prague a zobrazí se konkrétní datum. Neurčité „ráno“ bez délky nestačí k potvrzení obsazení: asistent požádá o interval nebo přizná předpoklad.

Asistent neprovádí změny, nemá libovolný SQL přístup, hesla ani klíče. Poznámky a uživatelské texty jsou data, ne instrukce k rozšíření oprávnění. Externímu modelu se předají jen nezbytné údaje. Finance v M nejsou mezi jeho nástroji.

Při výpadku modelu se zobrazí chyba a běžné plánování i algoritmické doporučení dále fungují. Maturitní ověření zahrnuje skutečné propojení s jazykovým modelem; předpřipravené odpovědi nestačí.

**Akceptace:** změna dovolené se projeví v další odpovědi; neexistující lidé nejsou vymyšleni; požadavek na změnu ceny se neprovede; nejistý termín je doplněn.

### FR-10: Mobilní část řidiče [M; S1 §10, S2 §11]

Úvod zobrazuje probíhající práci, jinak nejbližší naplánovanou. Karta: číslo, zákazník, místa, termín, náklad, poznámka, tahač, návěs, známá vzdálenost a kontakt hajného. Další části: vlastní nadcházející / dokončené práce, karta tahače, tankování a oznámení.

Stav lze měnit jen u právě přiřazené práce. Dokončení uloží skutečný čas a autora. Opakovaný klik / síťový požadavek nesmí vytvořit duplicitu. Po přeřazení jinému řidiči starý řidič nezíská detail přes uloženou URL.

**Akceptace:** mobilní kritické úkony fungují; výpadek spojení nehlásí falešný úspěch; cena a cizí práce se nevrátí ani v API.

### FR-11: Tankování a spotřeba [M; S1 §11, S2 §16]

Záznam: tahač nebo harvestor, litry, volitelný tachometr / MTH, skutečný čas tankování, tankující a automatický autor / čas zápisu. Čas události se předvyplní; zpětné zadání je povoleno dispečerovi. Oddělení času události a zápisu sjednocuje oba zdroje.

Dispečer nastaví nákupní cenu litru na každý měsíc. Záznam použije cenu podle data tankování a uloží kopii ceny i původ. Náklad = litry × cena. Pozdější úprava ceny nepřepíše minulost bez explicitního auditovaného přepočtu.

Bez ceny se uloží náklad „neznámý“, ne 0 Kč, a upozornění dispečerovi. Automatická orientační cena ČR patří do R a musí obsahovat zdrojové období a označení odhadu.

**Návrhové rozhodnutí pro spotřebu:** podporovat „doplněno do plné“. l/100 km = součet litrů po výchozí plné až po další plnou včetně / rozdíl km × 100. Litry prvního výchozího naplnění se nepočítají. Bez uzavřeného intervalu / km se zobrazí nedostatek dat. Prostý provozní poměr lze zobrazit jen jako odhad. Harvestor používá případně l/MTH.

**Akceptace:** 380 l × 34,50 Kč = 13 110 Kč; bez km lze uložit tankování; chybějící cena není nula; starý záznam nesníží aktuální tachometr.

### FR-12: Servis [M; S1 §12, S2 §15]

Historie tahače obsahuje datum, km, typ opravy, popis, cenu a další plán. Provedený servis a plán jsou oddělené záznamy. Interval má poslední provedení, hranici km a/nebo datum; pokud jsou obě, rozhoduje první dosažená.

Typy: olej, pneumatiky, brzdy, běžný servis, STK, emise. Předběžné prahy upozornění jsou nastavitelné, překročení je odlišeno. Evidované termíny nejsou automatickým právním potvrzením způsobilosti vozidla.

Reset intervalu je auditovaná akce s provedeným servisem, datem a km, ne pouhé skrytí hlášky. Nová km hranice vychází ze skutečného nájezdu při opravě. Bez km se upozornění označí nevyhodnotitelné. Blokování dostupnosti má vlastní interval odstávky.

**Akceptace:** hranice 250 000 km při nájezdu 247 700 km hlásí 2 300 km; reset uloží historii a novou hranici; samotné upozornění vozidlo neodstaví.

### FR-13: Těžba, harvestory a hajní [M; S1 §13, S2 §17–18]

Těžba obsahuje místo / porost, volitelného hajného a telefon, harvestor, období, cenu za m³, produkci, MTH a navázané tankování. Harvestor je samostatný stroj s označením, aktivitou a MTH.

**Návrhové rozhodnutí:** akce má denní záznamy s datem, strojem, m³ a MTH začátek / konec. M používá jeden hlavní harvestor; více strojů je následné rozšíření.

Kontakty hajného se opakovaně používají a našeptávají. Absence hajného ani telefonu neblokuje práci. Shodné jméno není automaticky totožná osoba; možné duplicity se nabídnou podle jména a telefonu.

Výpočty: m³ = součet záznamů; MTH = součet konec − začátek; m³/den = produkce / počet různých pracovních dnů; m³/MTH = produkce / odpracované MTH. Nulový jmenovatel vrací „nelze určit“. Cena × produkce je orientační hodnota práce, ne důkaz úhrady.

Tankování je odkaz na tentýž FR-11 záznam, ne kopie nákladu. Přeprava může odkazovat na těžbu, ale vytěžené a odvezené množství jsou různé ukazatele.

**Akceptace:** 423 m³ za 6 pracovních dnů = 70,5 m³/den; záporné MTH a překryv práce stejného harvestoru jsou odmítnuty; tankování se neduplikuje.

### FR-14: Dashboard [M; S1 §14, S2 §4]

Karty aktivních, naplánovaných a dokončených prací, dostupných / pracujících řidičů a tahačů a vozidel v servisu. Dále dnešní / budoucí práce, nepřiřazené a konfliktní plány, stavy techniky a servisní upozornění. Základní grafy: práce za měsíc, dokončené práce a plánované vytížení.

Karta uvádí období a má proklik na stejný filtr. Aktivní práce = čekající + naplánované + probíhající nearchivované. Dostupnost na úvodu znamená nyní, nikoliv libovolný budoucí termín. Finanční karty patří do R.

**Akceptace:** karty souhlasí s přehledy po změně stavu; prázdná firma má srozumitelné nuly; konfliktní plán není vydáván za bezproblémový.

### FR-15: Oznámení [M; S1 §15, S2 §24]

Vznikají při nové / změněné / přidělené práci, vlastním návrhu řidiče, konfliktu, potřebě přeplánování, servisním termínu nebo problému techniky. Příjemci odpovídají roli a aktuální vazbě.

Záznam: příjemce, typ, text, objekt, čas, přečtení. Počet nepřečtených a proklik; detail znovu ověří oprávnění. Opakované vyhodnocení stejného servisního prahu nevytváří každým během kopii. Historická zpráva nesmí prozradit nově cizí zakázku.

**Akceptace:** oznámení dostanou jen relevantní uživatelé; přečtení je individuální; změnou ID nelze přečíst zprávu někoho jiného.

### FR-16: Audit [M; S1 §16, S2 §28]

Audit eviduje založení a důležité změny zakázek, souprav, stavů, cen, lidí, nepřítomností, techniky, tankování, servisu, těžby, archivace a nastavení / rolí. R přidá finance.

Záznam má autora nebo označenou systémovou akci, čas, operaci, typ a ID entity a původní / nové hodnoty změněných polí. Obchodní změna a audit jsou atomické. Hesla, tokeny a klíče se nezapisují. V aplikaci je audit pouze pro čtení, bez běžného mazání či přepisování.

**Akceptace:** změna řidiče ukáže obě hodnoty; neúspěšný zápis nevytvoří falešnou změnu; historie se zachová po archivaci.

### FR-17: Archiv [M; S1 §17, S2 §30]

Archivují se dokončené / zrušené práce a neaktivní lidé, tahače a návěsy. Uloží se autor a čas, objekt se skryje z aktivních výběrů, ale vazby zůstanou. Aktivní práci nelze pouhou archivací zbavit rezervace.

Objekt s budoucí rezervací vyžaduje vyřešení přiřazení. Obnovení provede nové kontroly a neobnoví historické rezervace. Řidič může vidět vlastní dokončenou historii, aniž získá modul Archivu.

**Akceptace:** minulá práce uchová identifikaci archivované techniky; použité entity nelze běžně trvale smazat; archiv není dostupný řidiči.

### FR-18: Světlý a tmavý režim [M; S1 §18, S2 §33]

Světlé pozadí, lesní zelená a čisté karty; tmavá lesní zelená, přírodní tóny, světlejší akcenty a čitelné tabulky. Režim se zachová mezi návštěvami, výchozí může respektovat systém.

**Akceptace:** formuláře, tabulky, grafy a hlášky fungují v obou režimech; stav se nesděluje pouze barvou.

### FR-19: Responzivita [M; S1 §19, S2 §32]

Řidičská část je mobile-first; dispečerská je optimalizovaná pro velký displej a použitelná i na telefonu. Mobilní tabulky použijí karty nebo řízený posuv, ne přetékání celé stránky.

**Návrhové cíle:** hlavní dotykové prvky alespoň 44 × 44 px, klávesnice, viditelný focus, popisky a textové chyby, kontrast běžného textu alespoň 4,5 : 1. Ověřit 360, 390, 768, 1024 a 1440 px. Nejde o tvrzení o certifikaci.

**Akceptace:** řidič dokončí práci a zapíše palivo; dispečer upraví zakázku na telefonu; chyba zachová vyplněná pole.

## 7. Rozšířená interní aplikace

### FR-20: Finance a profit [R; S2 §19–21]

Pouze dispečer. Příjmy: cena dokončené práce a ostatní příjmy. Náklady: palivo, servis / opravy, mýtné a další provoz. Každá položka má datum, kategorii, částku, měnu, původ a případný stroj / zakázku.

**Návrhové rozhodnutí:** provozní výsledek v jednotné cenové bázi. Plátce pracuje s cenami bez DPH, neplátce s konečnými cenami; obě báze se nemíchají. Nejde o účetní zisk ani daňovou evidenci. Výnos práce se eviduje podle dokončení, nikoliv jako důkaz přijetí platby.

Tankování patří stroji, ne automaticky jedné práci. Zakázkový profit potřebuje přímý náklad nebo explicitní alokaci s metodou. Alokace v součtu nepřesáhne zdroj a nezapočítá ho znovu ve firemním výsledku. Nealokovaný servis zůstává firemním nákladem. Odhad paliva podle km a spotřeby je označený a nesčítá se se skutečně alokovaným palivem.

Profit = cena práce − přiřazené náklady. Neúplné náklady znamenají „předběžný výsledek“. Příklad: 24 500 − 6 200 − 1 700 − 500 = 16 100 Kč. Firemní výsledek = všechny výnosy − neduplikované náklady stejného období včetně nealokovaných.

Dashboard: měsíční / roční příjmy, náklady, výsledek, průměrný profit, nejvýdělečnější práce a vozidlo. Hodnocení vozidla uvádí alokaci a úplnost dat.

**Akceptace:** jeden náklad se započte jednou; zrušená práce nevytvoří běžný výnos; řidič finance nezíská ani v API.

### FR-21: Statistiky [R; S2 §22]

Období, filtry a proklik na zdroje. Zakázky: počet, dokončení, průměrná cena / profit. Vozidla: km, spotřeba, náklady, vytížení a počet prací. Řidiči: práce, km a vytížení. Těžba: m³, m³/den, MTH a výkon.

Tachometr a plánovaná vzdálenost jsou různé metriky. Km řidiče bez skutečných jízdních záznamů znamenají pouze součet evidovaných vzdáleností, což musí být uvedeno. Vytížení = rezervované hodiny / disponibilní hodiny, podle pracovních oken po odečtení nepřítomností / odstávek. Bez konfigurace se ukazují hodiny, ne vymyšlené procento.

**Akceptace:** agregace vysvětlují zdroj i jmenovatel; neznámá data nejsou nulový výkon; archivované dokončené práce zůstávají v historických statistikách.

### FR-22: Kalendář [R; S2 §23]

Den, týden a měsíc kombinují práce, lidi, techniku, servis a nepřítomnosti. Filtry prostředků a událostí, proklik na detail. Případné přetažení používá stejné validace a audit jako formulář. Kalendář je pohled nad společnými daty, ne druhá evidence.

### FR-23: Globální hledání [R; S2 §26–27]

Zakázky, řidiči, vozidla, zákazníci a hajní podle čísla, jména, SPZ, VIN a telefonu. Výsledky seskupené podle typu, označený archiv a detail. Archiv se zapíná explicitně. Tabulky zachovají filtry data, stavu, řidiče, techniky, zákazníka a řazení podle stáří, ceny, názvu a termínu.

### FR-24: Administrace a profil [M základ, R rozšíření; S2 §3, §29]

M: účty, lidé, technika, palivové ceny a intervaly. R: samoobslužná změna profilu / hesla, typy vozidel a další konfigurace. Správa popisků stavů nesmí narušit stavový automat; nový provozní stav vyžaduje přechody a testy. Nelze deaktivovat posledního dispečera nebo mu odebrat roli bez náhrady.

## 8. Veřejný web [W; S2 §2]

Úvod, firma, služby, přeprava dřeva, veřejná technika, kontakty a formulář. Responzivita a společná identita. Interní evidence není automaticky veřejným zdrojem: zveřejní se jen výslovně zvolené fotografie a popisy.

Bez tlačítka přihlášení a zmínky o interním systému. Interní adresa může být /firma, konkrétní doména není potvrzená. Skrytý odkaz nenahrazuje bezpečnost. Formulář validuje údaje a omezuje spam; vyžaduje zvolený mechanismus doručení.

**Akceptace:** návštěvník nevidí zaměstnance, VIN, práci ani finance; formulář oznamuje skutečný výsledek doručení; interní URL vyžaduje přihlášení.

## 9. Hlavní pracovní postupy

### 9.1 Naplánování a dokončení

1. Dispečer vybere zákazníka, zadá místa, interval, náklad a požadavky.
2. Uloží čekající práci nebo získá doporučení.
3. Vybere soupravu a případně ji změní.
4. Server atomicky ověří pravidla, uloží práci, rezervaci a audit.
5. Dispatch a mobilní část zobrazí práci, řidič dostane zprávu.
6. Řidič zahájí a dokončí práci; uloží se skutečné časy a aktualizují historie.

### 9.2 Nemoc či porucha

Skutečné omezení se uloží a systém označí ovlivněné plány. AI vyřadí prostředek, dashboard upozorní. Dispečer vybere náhradu, nová kontrola ověří obsazení a audit uchová původní hodnoty. Ovlivnění řidiči dostanou relevantní zprávu.

### 9.3 Tankování a servis

Zaměstnanec zadá stroj, litry a volitelné km. Aplikace přidá autora, čas a cenu příslušného měsíce. Nájezd může vyvolat upozornění. Dispečer zapíše provedený servis a interval; dostupnost blokuje jen skutečná / plánovaná odstávka.

### 9.4 Těžba

Dispečer založí porost, stroj a volitelného hajného. Denně zapisuje m³ a MTH, připojuje tankování. Detail počítá produkci a výkon. Přeprava odkazující na těžbu automaticky nemění vytěžené množství.

## 10. Informační architektura a UX

| Rozhraní | Navigace |
| --- | --- |
| Dispečer M | Dashboard, Dispatch, Zakázky, Řidiči, Vozový park, Tankování, Servis, Těžba, Kontakty, AI, Oznámení, Archiv, Audit, Nastavení |
| Dispečer R | Navíc Kalendář, Finance, Statistiky a globální hledání |
| Řidič | Moje práce, Moje vozidlo, Tankování, Oznámení, Profil |
| Veřejný web | Úvod, O firmě, Služby, Vozový park, Kontakt |

Každá obrazovka má načítání, prázdný stav, chybu s opakováním a nedostatečná oprávnění. Formuláře označí povinná pole a jednotky, chyby u polí i souhrn. Odchod s neuloženými údaji má potvrzení. Zrušení, archivace a deaktivace popíší dopad.

Tabulky jsou stránkované na serveru a při návratu zachovají filtry. Prázdná evidence se odlišuje od prázdného výsledku hledání. České formáty částek, jednotek a dat. Doporučení je ve formuláři; detail má informační prvek pro poslední důvody s časem. Historický výsledek není prezentován jako aktuální kontrola.

## 11. Konceptuální datový model

Nejde o závazný SQL návrh. Entity mají stabilní interní ID; ceny a množství desetinný typ. Konkrétní typy a tabulky určí stack.

| Entita | Údaje a vazby |
| --- | --- |
| User | username, password_hash, role, active, employee_id?, session_version |
| Employee / Driver | unikátní kód, jméno, telefon, e-mail?, active, archiv |
| Absence | zaměstnanec, typ, začátek, konec, autor |
| Vehicle | SPZ, VIN?, výrobce, model, rok, typ, foto, kapacita, ruka, active |
| Trailer | SPZ, výrobce, model, rok, typ, nosnost, active |
| Harvester | označení, výrobce / model?, MTH, active |
| DefaultAssignment | řidič, tahač, návěs?, platnost běžného přiřazení |
| Customer | název / jméno, kontakt, telefon?, e-mail?, archiv |
| ForesterContact | hajný, telefon?, poznámka?, archiv |
| Order | číslo, zákazník, místa, plánované / skutečné časy, stav, náklad, t?, m³?, požadavky, cena, souprava, zdroj / schválení, těžba?, archiv |
| ResourceReservation | zakázka, prostředek, začátek, konec; případná uložená rezervace musí souhlasit se zakázkou |
| OrderStatusEvent | práce, starý / nový stav, čas, autor, podstav? |
| Downtime | prostředek, servis / odstavení, začátek, konec?, důvod |
| FuelPrice | rok–měsíc, cena za litr, původ, zdrojové období? |
| FuelRecord | stroj, čas události, autor, tankující, litry, km? / MTH?, do plné?, kopie ceny?, náklad?, těžba?, zneplatnění |
| MeterReading | stroj, datum, km nebo MTH, zdroj, explicitní oprava? |
| ServiceRecord | stroj, datum, km?, typ, popis, cena?, poskytovatel?, autor |
| ServiceSchedule | stroj, typ, poslední provedení, interval, další hranice, prahy |
| Harvest | porost, hajný?, harvestor, období, cena za m³ |
| HarvestDailyRecord | těžba, datum, stroj, m³, MTH začátek / konec |
| Notification | příjemce, typ, objekt, text, čas, přečtení, deduplikační klíč |
| AuditEvent | autor, čas, operace, typ / ID entity, změny před / po, korelační ID |
| RecommendationRun | vstup, čas, verze pravidel, varianty a důvody; volitelná evidence |
| FinancialEntry [R] | příjem / náklad, kategorie, datum, částka, původ, stroj?, práce? |
| CostAllocation [R] | zdrojový náklad, práce, částka, metoda, odhad? |
| Settings | pracovní okna, cenová báze, servisní prahy, verze doporučení |

### 11.1 Integrita

- Řidičský účet má nejvýše jeden propojený profil. Dispečer nemusí být řidič.
- Archivace nemaže vazby; použitý zákazník nebo technika se běžně nesmažou.
- Rezervace zná typ prostředku; doménová vrstva / DB zabrání neplatným odkazům.
- Litry a jednotkové ceny jsou kladné; běžné ceny, m³ a km nezáporné. Finanční korekce jsou samostatně označené.
- Konec je po začátku, MTH neklesají, tachometr neklesá bez explicitní opravy.
- SPZ, VIN, employee code, username a číslo práce mají normalizaci a unikátní omezení.
- Obchodní zápis a audit jsou atomické. Událost pro oznámení se uloží spolehlivě; chyba doručení neztratí práci.
- Pozdější změna ceny či běžného přiřazení potichu nemění minulost.

## 12. Výpočty a význam metrik

| Ukazatel | Pravidlo |
| --- | --- |
| Palivo | Litry × uložená cena; bez ceny neznámý náklad |
| Spotřeba | Uzavřený interval plných nádrží podle FR-11 |
| Km do servisu | Servisní hranice − poslední ověřený tachometr |
| MTH | Součet konec − začátek platných pracovních intervalů |
| Produkce | Součet m³ denních záznamů |
| m³/den | Produkce / počet různých pracovních dnů |
| m³/MTH | Produkce / odpracované MTH |
| Profit [R] | Cena dokončené práce − přiřazené náklady |
| Firemní výsledek [R] | Výnosy − neduplikované náklady stejného období |
| Vytížení | Rezervované / disponibilní hodiny; bez konfigurace jen hodiny |
| Průměrná cena | Součet cen dokončených prací / počet dokončených s cenou |

Neznámá hodnota je odlišná od nuly. Měna se zaokrouhluje konzistentně na haléře; součty vycházejí z přesných uložených hodnot. Každý přehled uvádí období, zdroj a případnou neúplnost / odhad.

## 13. Architektura a integrace

**Doporučený návrh:** modulární monolit s relační DB, serverovou doménovou logikou a responzivním frontendem. Dostupnost, rezervace, oprávnění a výpočty jsou sdílené služby pro formuláře, dispatch, kalendář i AI. Konkrétní stack není předepsán.

| Modul | Odpovědnost |
| --- | --- |
| Identity | Účty, session, role, omezení dat |
| Planning | Práce, intervaly, rezervace, konflikty |
| Fleet / Employees | Lidé, soupravy, technika, nepřítomnosti |
| Operations | Tankování, tachometry, servis, těžba |
| Intelligence | Doporučení a čtecí nástroje asistenta |
| Reporting | Přehledy, statistiky, finance |
| Společné služby | Audit, oznámení, archiv, konfigurace |

Externí AI, mapy a orientační ceny mají oddělené adaptéry. Klíče zůstávají na serveru. Výpadek externí služby neblokuje ruční evidenci. Fotografie mají kontrolu typu / velikosti, generovaný název a autorizovaný přístup. Interní fotografie se nezveřejní automaticky.

Hosting musí podporovat backend, DB, session, soubory a plánované kontroly; platforma se ověří prototypem. API používá projekce povolených polí podle role.

## 14. Nefunkční požadavky

### NFR-01: Bezpečnost

Ověřená knihovna pro solený hash, HTTPS, bezpečná session, ochrana podvržených požadavků podle auth mechanismu, parametrizované dotazy, escapování výstupu, serverová validace a omezení pokusů o přihlášení. Session cookies mají bezpečné atributy a nastavitelnou expiraci. Tajné údaje nejsou v klientském kódu, auditu ani běžných logách. Role se kombinuje s autorizací konkrétního objektu, včetně AI a vyhledávání.

### NFR-02: Souběh a spolehlivost

Rezervace jsou transakční. Editace detekuje zastaralou verzi, aby druhý dispečer nepozorovaně nepřepsal novější údaje. Uživatel dostane možnost načíst aktuální stav. Opakovaný požadavek nevytvoří dvojité tankování ani dokončení. Úlohy upozornění jsou opakovatelné a deduplikované. UI obnovuje související přehledy pomocí zvoleného polling / push mechanismu; při výpadku ukáže poslední načtení.

### NFR-03: Výkon

**Návrhové cíle:** sada 10 000 prací, 100 řidičů, 100 tahačů a 100 návěsů. Běžný filtrovaný přehled a kontrola konfliktů do 2 s v 95 % měřených backendových požadavků na popsaném prostředí; algoritmické doporučení do 3 s. AI má stav zpracování a timeout, výchozí 30 s. Externí latence se hodnotí odděleně.

Stránkování, indexy prostředků a intervalů, omezené projekce. Jde o cíle, jejichž splnění se musí změřit.

### NFR-04: Provoz a zálohy

Pro skutečný provoz automatické zálohy DB i fotografií, dokumentovaný postup a test obnovy. **Návrh:** denní záloha, RPO 24 h, RTO 4 h; potvrdit podle hostingu. Maturitní verze má obnovitelnou demo DB, migrace a návod spuštění. Logy mají korelační ID a neobsahují tajné či zbytečné osobní údaje. Produkční data nejsou veřejná demonstrační sada.

### NFR-05: Soukromí

Kontakty, nepřítomnosti a audit jen oprávněným lidem. Nemoc se eviduje jako typ nepřítomnosti, bez diagnózy. Před reálným provozem firma stanoví retenční lhůty, anonymizaci, přístupy a rozsah předávání dat AI. Archiv neznamená neomezené uchovávání. PRD neurčuje právní lhůty ani netvrdí právní shodu.

## 15. Akceptační scénáře

| ID | Scénář | Očekávaný výsledek |
| --- | --- | --- |
| AT-01 | Řidič otevře dispečerskou URL / API | Odmítnutí, žádná cizí ani finanční data |
| AT-02 | Změna ID na cizí práci | Čtení i zápis odmítnuty |
| AT-03 | Deaktivace přihlášeného účtu | Stará session nefunguje |
| AT-04 | Překryv pouze návěsu | Naplánování blokováno |
| AT-05 | Souběžné obsazení tahače | Nejvýše jeden konfliktní zápis uspěje |
| AT-06 | Navazující práce / hranice nepřítomnosti | Správná polouzavřená kontrola |
| AT-07 | Půlnoc a změna letního času | Správný interval a zobrazení |
| AT-08 | Nemoc po naplánování | Omezení uložené, plán označený k přeplánování |
| AT-09 | Servis a dovolená kandidátů | Vyloučení a konkrétní vysvětlení |
| AT-10 | Zastaralé doporučení | Uložení znovu ověří dostupnost |
| AT-11 | AI: zítra volný / změň cenu | Konkrétní datum, skutečná data, žádný zápis |
| AT-12 | Výpadek AI / map | Jádro funguje, bez vymyšlených údajů |
| AT-13 | Dvojité dokončení | Jedna změna, konzistentní audit |
| AT-14 | Vlastní práce řidiče | Návrh ke schválení bez rezervace |
| AT-15 | 380 l × 34,50 Kč bez km | 13 110 Kč, tankování platné, spotřeba neznámá |
| AT-16 | Chybějící / později změněná cena | Neznámý náklad, minulost bez tichého přepisu |
| AT-17 | 500 km, 150 l po výchozí plné | 30 l/100 km |
| AT-18 | Servis 250 000 km, nájezd 247 700 | 2 300 km; reset s historií |
| AT-19 | 423 m³ za 6 dnů, 51,2 MTH | 70,5 m³/den, správné MTH |
| AT-20 | Archiv použitého stroje | Zachované vazby, bez nového výběru |
| AT-21 | Změny ceny, soupravy, archivu | Audit před / po bez tajných údajů |
| AT-22 | 360 px, oba režimy, klávesnice | Kritické úkony a čitelné stavy |
| AT-23 | Alokované palivo, nealokovaný servis [R] | Firemní i zakázkový výsledek bez duplicity |
| AT-24 | Globální hledání / veřejný formulář [R/W] | Autorizované výsledky a skutečné doručení |

Demo pokrývá dostupnost, dovolenou, nemoc, deaktivaci, ruku / bez ruky, odstávku, sdílený návěs, půlnoc, zpoždění, neznámou cenu a neúplnou spotřebu. Prioritní automatizované testy ověřují autorizaci, výpočty, přechody a souběžné rezervace.

## 16. Plán říjen 2026 – únor 2027

Bezpečnost, audit a mobilní použitelnost vznikají průběžně. M je široká: cílem jsou kompletní propojené moduly v minimální hloubce, R a W mimo maturitní kritický plán.

| Měsíc | Implementace | UI/UX a ověření |
| --- | --- | --- |
| Říjen | ERD, architektura, účty / role, shell, auditní základ, intervaly a rezervace | Wireframy obou rolí, navigace, mobilní karta, design tokeny a oba režimy |
| Listopad | Řidiči, nepřítomnosti, tahače, návěsy, soupravy, kontakty, archivní mechanismus | Formuláře, detaily, tabulky / mobilní karty a stavy dostupnosti |
| Prosinec | Zakázky, dispatch, konflikty, vlastní práce, mobilní stavy, základ těžby | Tok vytvoření → přiřazení → dokončení, srozumitelné chyby, prototyp doporučení |
| Leden | Tankování, ceny, spotřeba, servis, intervaly, oznámení, dashboard, prototyp AI integrace | Mobilní zápis, upozornění a grafy; výpočty a poruchové stavy |
| Únor | Doporučení TOP 3, propojený AI asistent, dotažení M, opravy a dokumentace | Uživatelské ověření, responzivita, kontrast, režimy a scénář obhajoby |

Brány: říjen – model a role; prosinec – celý přepravní tok; leden – ověřený AI poskytovatel a hosting; únor – všechny M moduly propojené a otestované. AI technický prototyp neodkládat až na poslední měsíc.

## 17. Rizika a závislosti

| Riziko | Opatření |
| --- | --- |
| 19 modulů v krátkém čase | Držet minimum M, odložit R/W, sdílet komponenty |
| Neznámý konec práce | Povinný interval před potvrzením |
| Dvojí souběžné obsazení | Atomická rezervace a AT-05 |
| Odlišná dostupnost v AI a UI | Společná doménová služba |
| Chybějící provozní data | Odlišit neznámou hodnotu, odhad a skutečnost |
| Halucinace / výpadek AI | Čtecí nástroje, konkrétní podklady, timeout, oddělení od jádra |
| Zpětná změna nákladů | Uložená cena a auditovaný přepočet |
| Nevhodný hosting | Včasný prototyp DB, session, fotek a úloh |
| Finance v odpovědi řidiči | Projekce podle role a testy API |
| Slabé demo | Reprodukovatelná sada a reset prostředí |

## 18. Definition of Done

Maturitní předání vyžaduje:

1. Všech 19 M bloků s doloženou akceptací.
2. Celý tok práce pro obě role, konflikty, doporučení a historii.
3. Skutečného AI asistenta nad aktuálními daty bez zápisových oprávnění.
4. Procházející prioritní testy a žádné známé kritické chyby.
5. Ověřenou mobilní část a oba režimy.
6. Migrace, demo data, návod spuštění / nasazení a konfiguraci bez klíčů.
7. ERD, popis rolí, workflow, AI pravidla, omezení a výsledky testů.
8. Zachované auditní a archivní vazby a ověřenou obnovu demo prostředí.
9. Přiznané neimplementované části R/W.

Obhajoba: dispečer → nemoc řidiče → nová přeprava s rukou → doporučení → přiřazení → zamítnutý konflikt → řidič → dokončení a tankování → servisní upozornění → těžební statistika → AI dotaz → audit a archiv.

## 19. Otevřená rozhodnutí

Nejsou potvrzena ve zdrojích. Do jejich vyřešení platí výchozí návrhy PRD; technologické volby uzavřít před příslušnou implementací.

| Rozhodnutí | Výchozí návrh | Termín |
| --- | --- | --- |
| Stack a DB | Relační DB, modulární monolit; technologie neurčena | Říjen |
| Hosting / fotografie / úlohy | Technický prototyp, žádná platforma předem potvrzena | Říjen–leden |
| AI model a rozpočet | Serverové klíče, read-only nástroje, limity | Nejpozději leden |
| Školní význam AI doporučení | Pravidlové skóre + skutečný LLM asistent; potvrdit případné ML | Říjen |
| Přejezdový buffer | Explicitní interval, M bez automatické trasy | Před zakázkami |
| Kapacita soupravy | Explicitně schválená použitelná kapacita | Před vhodností |
| Vlastní práce | Návrh čekající na dispečera | Před dispatchí |
| Mobilní podstavy | M zahájení / dokončení; R detailnější kroky | Před mobilní částí |
| Těžba a její obsluha | Denní záznamy zadává dispečer, základ harvestoru | Před těžbou |
| Cenová báze a alokace | Provozní výnos podle dokončení, jednotná báze | Před financemi R |
| Mapy a výchozí poloha | Trasa R; bez GPS a domýšlení polohy | Před integrací R |
| Externí cena paliva | Volitelná R, zdroj zatím neurčen | Před integrací R |
| Retence a zálohy | Dohoda s firmou a ověření obnovy | Před reálným provozem |
| Doména / formulář | /firma jako návrh, služba doručení neurčena | Před W |

## 20. Mapa pokrytí zdrojů

### 20.1 S1 – všech 19 maturitních částí

| Část S1 | Pokrytí |
| --- | --- |
| 1 Přihlášení + role | FR-01, kapitola 4, NFR-01 |
| 2 Řidiči | FR-02 |
| 3 Vozidla | FR-03 |
| 4 Návěsy | FR-04 |
| 5 Zakázky | FR-05, kapitola 5 |
| 6 Dispatch | FR-06 |
| 7 Kontrola konfliktů | FR-07 |
| 8 AI doporučení | FR-08 |
| 9 AI asistent | FR-09 |
| 10 Řidičská mobilní část | FR-10 |
| 11 Tankování | FR-11 |
| 12 Základní servis | FR-12 |
| 13 Těžba | FR-13 |
| 14 Dashboard | FR-14 |
| 15 Oznámení | FR-15 |
| 16 Audit log | FR-16 |
| 17 Archiv | FR-17 |
| 18 Light + dark mode | FR-18 |
| 19 Responzivita | FR-19 |

### 20.2 S2 – všech 34 částí cílové aplikace

| Část S2 | Pokrytí |
| --- | --- |
| 1 Základní popis | Kapitoly 2–3 |
| 2 Veřejný web | Kapitola 8, W |
| 3 Účty | FR-01, FR-24 |
| 4 Dashboard | FR-14, FR-20 |
| 5 Zakázky | FR-05, vzdálenost R |
| 6 Práce se zakázkami | FR-05, FR-17, FR-23 |
| 7 Dispatching | FR-06 |
| 8 Přiřazování | Kapitola 5.4, FR-05 |
| 9 Doporučování | FR-08 |
| 10 Řidiči | FR-02, FR-21 |
| 11 Řidičská část | FR-10 |
| 12 Vozový park | FR-03 |
| 13 Detail vozidla | FR-03, FR-12; bez diagnostiky |
| 14 Návěsy | FR-04, servis R |
| 15 Servis | FR-12 |
| 16 Tankování | FR-11, externí cena R |
| 17 Těžba | FR-13 |
| 18 Hajní | FR-13, model kontaktů |
| 19 Finance | FR-20 |
| 20 Profit | FR-20 |
| 21 Finanční dashboard | FR-20 |
| 22 Statistiky | FR-21 |
| 23 Kalendář | FR-22 |
| 24 Oznámení | FR-15 |
| 25 Konflikty | FR-07 |
| 26 Vyhledávání | FR-23 |
| 27 Filtry a řazení | FR-05, FR-23, kapitola 10 |
| 28 Historie změn | FR-16 |
| 29 Administrace | FR-24 |
| 30 Archiv | FR-17 |
| 31 Vyřazené funkce | Kapitola 3.4 |
| 32 Responzivita | FR-19 |
| 33 Vzhled | FR-18 |
| 34 Bezpečnost | Kapitola 4, NFR-01 |

## 21. Pravidla dalšího rozvoje

Nový požadavek dostane fázi, roli, datové vazby, dopad na dostupnost / audit a akceptaci. Změna stavů, kapacit, intervalů a finančních vzorců aktualizuje společná pravidla i testy. R a W staví na stabilním maturitním základu a nevytvářejí druhou evidenci stejné skutečnosti.
