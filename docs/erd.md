# Datový model a ERD databáze Forester

ERD odpovídá aktuálnímu schématu SQLite: [001-foundation.sql](../server/migrations/001-foundation.sql), [002-order-integrity.sql](../server/migrations/002-order-integrity.sql) a technické tabulce migrací v [server/db.ts](../server/db.ts). Obsahuje všech 27 tabulek, jejich sloupce, klíče a všechny skutečné FK vazby.

V říjnové aplikaci jsou dostupné identity a správa účtů podle [říjnového zadání](rijnove-zadani.md). Ostatní provozní tabulky již existují v databázi jako základ dalšího vývoje, ale nemají dostupné provozní API ani obrazovky. Finanční entity `FinancialEntry` a `CostAllocation` jsou pouze budoucí návrh pro rozšířenou verzi R a nejsou součástí tohoto ERD.

## Jak diagram číst

Diagramy jsou ve formátu Mermaid. Ve VS Code otevři náhled Markdownu pomocí **Ctrl+Shift+V**; pokud se zobrazuje jen kód, použij náhled s podporou Mermaid.

| Značka                    | Význam                                              |
| ------------------------- | --------------------------------------------------- |
| PK                        | Primární klíč                                       |
| FK                        | Cizí klíč                                           |
| UK                        | Samostatně unikátní sloupec                         |
| NULL                      | Sloupec dovoluje neznámou nebo nevyplněnou hodnotu  |
| <code>&#124;&#124;</code> | Právě jeden záznam                                  |
| <code>o&#124;</code>      | Nula nebo jeden záznam                              |
| `o{`                      | Nula až mnoho záznamů                               |
| `..`                      | Neidentifikující vazba: FK není součástí PK potomka |

Názvy a typy sloupců odpovídají SQL. Logické hodnoty jsou v SQLite uložené jako `INTEGER`. Popisek vazby uvádí název FK sloupce v potomkovi. Tabulka bez vypsaných sloupců je odkaz na její úplný popis v jiném diagramu. Složená unikátní omezení a podmíněná pravidla jsou uvedena pod diagramy.

## 1. Účty, zaměstnanci a přihlášení

Aktivní říjnový základ: profily zaměstnanců, správa účtů, serverové přihlášení a interní audit. Vazba zaměstnance na účet je volitelná na obou stranách; role `driver` však profil zaměstnance vyžaduje. Audit může mít neznámého nebo systémového autora (`actor_id = NULL`).

```mermaid
erDiagram
    EMPLOYEES {
        TEXT id PK
        TEXT code UK
        TEXT first_name
        TEXT last_name
        TEXT phone
        TEXT email "NULL"
        INTEGER active
        INTEGER archived_at "NULL"
    }
    EMPLOYEES o|..o| USERS : "employee_id"
    USERS {
        TEXT id PK
        TEXT username UK
        TEXT password_hash
        TEXT role
        INTEGER active
        TEXT employee_id FK,UK "NULL"
        TEXT display_name
        INTEGER must_change_password
        INTEGER session_version
        INTEGER version
    }
    USERS ||..o{ SESSIONS : "user_id"
    SESSIONS {
        TEXT token_hash PK
        TEXT user_id FK
        TEXT csrf_token
        INTEGER session_version
        INTEGER expires_at
        INTEGER created_at
    }
    USERS o|..o{ AUDIT_EVENTS : "actor_id"
    AUDIT_EVENTS {
        TEXT id PK
        TEXT actor_id FK "NULL"
        TEXT actor_name "NULL"
        TEXT action
        TEXT entity_type
        TEXT entity_id
        TEXT before_json "NULL"
        TEXT after_json "NULL"
        INTEGER created_at
        TEXT correlation_id
    }
```

## 2. Technika, soupravy a dostupnost

Běžné přiřazení soupravy propojuje zaměstnance a tahač, volitelně návěs. Nepřítomnost patří zaměstnanci a má autora. Odstávka se vztahuje právě k jednomu tahači, návěsu nebo harvestoru.

```mermaid
erDiagram
    VEHICLES {
        TEXT id PK
        TEXT plate UK
        TEXT vin UK "NULL"
        TEXT manufacturer
        TEXT model
        INTEGER year "NULL"
        TEXT kind
        TEXT photo_key "NULL"
        INTEGER odometer_km "NULL"
        INTEGER capacity_kg "NULL"
        INTEGER crane
        INTEGER active
        INTEGER archived_at "NULL"
    }
    TRAILERS {
        TEXT id PK
        TEXT plate UK
        TEXT manufacturer
        TEXT model
        TEXT kind
        INTEGER capacity_kg "NULL"
        INTEGER year "NULL"
        INTEGER active
        INTEGER archived_at "NULL"
    }
    TRAILERS o|..o{ DEFAULT_ASSIGNMENTS : "trailer_id"
    VEHICLES ||..o{ DEFAULT_ASSIGNMENTS : "vehicle_id"
    EMPLOYEES ||..o{ DEFAULT_ASSIGNMENTS : "employee_id"
    DEFAULT_ASSIGNMENTS {
        TEXT id PK
        TEXT employee_id FK
        TEXT vehicle_id FK
        TEXT trailer_id FK "NULL"
        INTEGER approved_capacity_kg "NULL"
        INTEGER starts_at
        INTEGER ends_at "NULL"
    }
    USERS ||..o{ ABSENCES : "actor_id"
    EMPLOYEES ||..o{ ABSENCES : "employee_id"
    ABSENCES {
        TEXT id PK
        TEXT employee_id FK
        TEXT kind
        INTEGER starts_at
        INTEGER ends_at
        TEXT actor_id FK
    }
    HARVESTERS o|..o{ DOWNTIMES : "harvester_id"
    TRAILERS o|..o{ DOWNTIMES : "trailer_id"
    VEHICLES o|..o{ DOWNTIMES : "vehicle_id"
    DOWNTIMES {
        TEXT id PK
        TEXT vehicle_id FK "NULL"
        TEXT trailer_id FK "NULL"
        TEXT harvester_id FK "NULL"
        TEXT kind
        INTEGER starts_at
        INTEGER ends_at "NULL"
        TEXT reason
    }
```

## 3. Zákazníci, zakázky a rezervace

Zakázka může být propojena se zákazníkem a těžbou. Řidič, tahač, návěs i schvalující účet mají nullable FK; povinné obsazení závisí na stavu zakázky a požadavku na návěs. Každá rezervace blokuje právě jeden prostředek.

```mermaid
erDiagram
    CUSTOMERS {
        TEXT id PK
        TEXT name
        TEXT phone "NULL"
        TEXT email "NULL"
        INTEGER archived_at "NULL"
    }
    HARVESTS o|..o{ ORDERS : "harvest_id"
    USERS o|..o{ ORDERS : "approved_by"
    TRAILERS o|..o{ ORDERS : "trailer_id"
    VEHICLES o|..o{ ORDERS : "vehicle_id"
    EMPLOYEES o|..o{ ORDERS : "employee_id"
    CUSTOMERS o|..o{ ORDERS : "customer_id"
    ORDERS {
        TEXT id PK
        TEXT number UK
        TEXT customer_id FK "NULL"
        TEXT pickup
        TEXT delivery
        INTEGER starts_at
        INTEGER ends_at
        INTEGER actual_start "NULL"
        INTEGER actual_end "NULL"
        TEXT status
        TEXT employee_id FK "NULL"
        TEXT vehicle_id FK "NULL"
        TEXT trailer_id FK "NULL"
        TEXT material
        INTEGER weight_kg "NULL"
        INTEGER volume_milli "NULL"
        INTEGER requires_crane
        INTEGER requires_trailer
        INTEGER approved_capacity_kg "NULL"
        INTEGER price_cents "NULL"
        TEXT note
        TEXT source
        TEXT approved_by FK "NULL"
        TEXT harvest_id FK "NULL"
        INTEGER needs_replanning
        INTEGER archived_at "NULL"
        INTEGER version
    }
    TRAILERS o|..o{ RESERVATIONS : "trailer_id"
    VEHICLES o|..o{ RESERVATIONS : "vehicle_id"
    EMPLOYEES o|..o{ RESERVATIONS : "employee_id"
    ORDERS ||..o{ RESERVATIONS : "order_id"
    RESERVATIONS {
        TEXT id PK
        TEXT order_id FK
        TEXT employee_id FK "NULL"
        TEXT vehicle_id FK "NULL"
        TEXT trailer_id FK "NULL"
        INTEGER starts_at
        INTEGER ends_at
    }
    USERS ||..o{ ORDER_STATUS_EVENTS : "actor_id"
    ORDERS ||..o{ ORDER_STATUS_EVENTS : "order_id"
    ORDER_STATUS_EVENTS {
        TEXT id PK
        TEXT order_id FK
        TEXT old_status "NULL"
        TEXT new_status
        TEXT actor_id FK
        INTEGER created_at
    }
```

## 4. Těžba a denní výkony

Těžba má povinný harvestor a volitelný kontakt na hajného. Denní výkon odkazuje na těžbu i konkrétní harvestor. Odvoz ze těžby je propojen přes `orders.harvest_id` v diagramu zakázek.

```mermaid
erDiagram
    FORESTER_CONTACTS {
        TEXT id PK
        TEXT name
        TEXT phone "NULL"
        TEXT note "NULL"
        INTEGER archived_at "NULL"
    }
    HARVESTERS {
        TEXT id PK
        TEXT name UK
        TEXT manufacturer "NULL"
        TEXT model "NULL"
        INTEGER meter_milli "NULL"
        INTEGER active
        INTEGER archived_at "NULL"
    }
    HARVESTERS ||..o{ HARVESTS : "harvester_id"
    FORESTER_CONTACTS o|..o{ HARVESTS : "forester_id"
    HARVESTS {
        TEXT id PK
        TEXT forest_stand
        TEXT forester_id FK "NULL"
        TEXT harvester_id FK
        INTEGER starts_at
        INTEGER ends_at "NULL"
        INTEGER price_per_m3_cents "NULL"
        INTEGER archived_at "NULL"
    }
    HARVESTERS ||..o{ HARVEST_DAILY_RECORDS : "harvester_id"
    HARVESTS ||..o{ HARVEST_DAILY_RECORDS : "harvest_id"
    HARVEST_DAILY_RECORDS {
        TEXT id PK
        TEXT harvest_id FK
        TEXT date
        TEXT harvester_id FK
        INTEGER volume_milli
        INTEGER meter_start_milli
        INTEGER meter_end_milli
    }
```

## 5. Tankování, ceny a odečty

Tankování i odečet patří právě jednomu tahači nebo harvestoru. Tankování má autora, zaměstnance a volitelnou těžbu. `fuel_prices` je samostatný měsíční ceník bez cizího klíče do tankování; uložená cena `price_snapshot_cents` zachovává historickou cenu.

```mermaid
erDiagram
    FUEL_PRICES {
        TEXT month PK
        INTEGER price_cents
        TEXT source
    }
    HARVESTS o|..o{ FUEL_RECORDS : "harvest_id"
    EMPLOYEES ||..o{ FUEL_RECORDS : "employee_id"
    USERS ||..o{ FUEL_RECORDS : "actor_id"
    HARVESTERS o|..o{ FUEL_RECORDS : "harvester_id"
    VEHICLES o|..o{ FUEL_RECORDS : "vehicle_id"
    FUEL_RECORDS {
        TEXT id PK
        TEXT vehicle_id FK "NULL"
        TEXT harvester_id FK "NULL"
        INTEGER event_at
        TEXT actor_id FK
        TEXT employee_id FK
        INTEGER liters_milli
        INTEGER odometer_km "NULL"
        INTEGER meter_milli "NULL"
        INTEGER full_tank
        INTEGER price_snapshot_cents "NULL"
        INTEGER cost_cents "NULL"
        TEXT harvest_id FK "NULL"
        INTEGER invalidated_at "NULL"
    }
    HARVESTERS o|..o{ METER_READINGS : "harvester_id"
    VEHICLES o|..o{ METER_READINGS : "vehicle_id"
    METER_READINGS {
        TEXT id PK
        TEXT vehicle_id FK "NULL"
        TEXT harvester_id FK "NULL"
        INTEGER event_at
        INTEGER value_milli
        TEXT source
        TEXT correction_reason "NULL"
    }
```

## 6. Servis a servisní intervaly

Servisní záznam i servisní plán patří právě jednomu tahači, návěsu nebo harvestoru. Plán může odkazovat na poslední provedený servis; shodu jeho prostředku s prostředkem servisního záznamu samotný FK nekontroluje.

```mermaid
erDiagram
    USERS ||..o{ SERVICE_RECORDS : "actor_id"
    HARVESTERS o|..o{ SERVICE_RECORDS : "harvester_id"
    TRAILERS o|..o{ SERVICE_RECORDS : "trailer_id"
    VEHICLES o|..o{ SERVICE_RECORDS : "vehicle_id"
    SERVICE_RECORDS {
        TEXT id PK
        TEXT vehicle_id FK "NULL"
        TEXT trailer_id FK "NULL"
        TEXT harvester_id FK "NULL"
        INTEGER event_at
        TEXT kind
        TEXT description
        INTEGER cost_cents "NULL"
        INTEGER meter_milli "NULL"
        TEXT provider "NULL"
        TEXT actor_id FK
    }
    SERVICE_RECORDS o|..o{ SERVICE_SCHEDULES : "last_service_id"
    HARVESTERS o|..o{ SERVICE_SCHEDULES : "harvester_id"
    TRAILERS o|..o{ SERVICE_SCHEDULES : "trailer_id"
    VEHICLES o|..o{ SERVICE_SCHEDULES : "vehicle_id"
    SERVICE_SCHEDULES {
        TEXT id PK
        TEXT vehicle_id FK "NULL"
        TEXT trailer_id FK "NULL"
        TEXT harvester_id FK "NULL"
        TEXT kind
        TEXT last_service_id FK "NULL"
        INTEGER interval_milli "NULL"
        INTEGER next_meter_milli "NULL"
        INTEGER next_date "NULL"
        INTEGER warning_milli "NULL"
    }
```

## 7. Oznámení a systémové tabulky

Oznámení má příjemce a běh doporučení autora. `outbox_events` uchovává události k doručení, `settings` konfiguraci a `schema_migrations` evidenci provedených migrací. Poslední tabulku vytváří `server/db.ts`.

```mermaid
erDiagram
    USERS ||..o{ NOTIFICATIONS : "recipient_id"
    NOTIFICATIONS {
        TEXT id PK
        TEXT recipient_id FK
        TEXT kind
        TEXT entity_id
        TEXT text
        INTEGER created_at
        INTEGER read_at "NULL"
        TEXT dedup_key UK
    }
    OUTBOX_EVENTS {
        TEXT id PK
        TEXT kind
        TEXT payload_json
        INTEGER created_at
        INTEGER processed_at "NULL"
        TEXT dedup_key UK
    }
    USERS ||..o{ RECOMMENDATION_RUNS : "actor_id"
    RECOMMENDATION_RUNS {
        TEXT id PK
        TEXT actor_id FK
        TEXT input_json
        TEXT rules_version
        TEXT result_json
        INTEGER created_at
    }
    SETTINGS {
        TEXT key PK
        TEXT value_json
    }
    SCHEMA_MIGRATIONS {
        TEXT name PK
        INTEGER applied_at
    }
```

## Datový slovník a pravidla integrity

| Oblast                  | Pravidlo                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identifikátory          | Nové záznamy aplikace používají UUID v `TEXT`; demo má stabilní ID. Výjimky PK: `sessions.token_hash`, `fuel_prices.month`, `settings.key`, `schema_migrations.name`.                           |
| Účet a zaměstnanec      | `users.employee_id` je volitelný a unikátní. DB CHECK vyžaduje profil pro roli `driver`; role jsou `dispatcher` a `driver`.                                                                     |
| Přihlašovací jméno      | DB zaručuje unikátnost. Aplikace navíc provádí trim, převod na malá písmena a validaci 3–40 znaků `a-z0-9._-`.                                                                                  |
| Jedinečné údaje         | Samostatné UK jsou vyznačeny v diagramech, včetně kódu zaměstnance, SPZ, VIN a čísla zakázky. Volitelné UK mohou mít více hodnot `NULL`.                                                        |
| Rezervace: složené UK   | `UNIQUE(order_id, employee_id)`, `UNIQUE(order_id, vehicle_id)`, `UNIQUE(order_id, trailer_id)`. Na řádku je právě jeden nenulový FK prostředku.                                                |
| Denní výkon: složené UK | `UNIQUE(harvest_id, date, harvester_id)`. Konečný stav MTH nesmí být nižší než počáteční.                                                                                                       |
| Právě jeden stroj       | Odstávka, servis a servisní plán vyžadují právě jeden z `vehicle_id`, `trailer_id`, `harvester_id`. Tankování a odečet právě jeden z `vehicle_id`, `harvester_id`. Hlídají SQL CHECK.           |
| Stav zakázky            | `waiting`, `planned`, `in_progress`, `completed`, `cancelled`. Kromě `waiting` a `cancelled` DB vyžaduje řidiče a tahač, při `requires_trailer != 0` i návěs.                                   |
| Rezervace: konzistence  | INSERT trigger vyžaduje stav zakázky `planned` nebo `in_progress`, shodný interval a shodný přiřazený prostředek. Další trigger brání časovému překryvu stejného prostředku.                    |
| Přeplánování            | Rezervace nelze upravovat přes UPDATE. Migrace 002 vyžaduje nejprve atomicky uvolnit rezervace před změnou rezervovaných polí nebo ukončením zakázky.                                           |
| Časy a intervaly        | Časové okamžiky jsou `INTEGER` v milisekundách od Unix epochy (UTC). Intervaly používají `[starts_at, ends_at)`; konec musí být po začátku. U soupravy, těžby a odstávky může být konec `NULL`. |
| Kalendářní údaje        | `harvest_daily_records.date` je textové datum, `fuel_prices.month` textový měsíc; nejsou to časové okamžiky v epoch ms.                                                                         |
| Jednotky                | `*_cents` = haléře CZK, `*_kg` = kg, `*_milli` = tisíciny jednotky (l, m³, MTH; u odečtů a servisu podle typu prostředku). `odometer_km` = celé km. `NULL` se liší od nuly.                     |
| Kapacita soupravy       | `approved_capacity_kg` je samostatná schválená kapacita celé soupravy; nejde o prostý součet nosností.                                                                                          |
| Cena paliva             | Tankování ukládá vlastní cenovou kopii. Změna měsíčního ceníku sama nepřepisuje historické tankování; mezi ceníkem a tankováním není FK.                                                        |
| Archiv                  | `archived_at` uchovává čas archivace. FK zachovávají vazby historie; schéma nedefinuje kaskádové mazání.                                                                                        |
| Audit                   | `actor_id` může být `NULL`. Triggery zakazují UPDATE a DELETE auditu; obchodní zápis a jeho audit aplikace ukládá v jedné transakci.                                                            |
| Obecné odkazy           | `audit_events.entity_id` a `notifications.entity_id` nejsou FK. Cílová entita se určuje kontextem typu události, proto nemají zakreslené relační vazby. Totéž platí pro ID uvnitř JSON.         |
| Souběh                  | `users.version` a `orders.version` slouží pro kontrolu zastaralých změn; aplikace používá `BEGIN IMMEDIATE`. `session_version` umožňuje zneplatnit přihlášení.                                  |

Samotné schéma ještě nezajišťuje kompletní provozní workflow. Budoucí doménové služby musí doplnit například kontrolu klesajícího tachometru/MTH napříč záznamy, povolené přechody stavů zakázek, označování plánů k přeplánování a finanční výpočty.
