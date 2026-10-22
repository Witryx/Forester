# Rozhraní a wireframy — říjen

Rozsah odpovídá říjnovému seznamu uživatele: přihlášení, oddělení rolí, základ administrace a návrh vzhledu a navigace. V aplikaci nejsou provozní moduly ani jejich upoutávky.

## Vizuální styl

Lesní zelená, světlá pracovní plocha, jemné okraje a ilustrace lesa na přihlášení. Nadpisy používají Manrope Variable, běžný text DM Sans Variable. Fonty včetně češtiny se balí lokálně. Sdílené prvky: tlačítka, pole, chybové zprávy a dialogy.

| Token | Světlý režim | Tmavý režim |
| --- | --- | --- |
| `--page` | `#f5f6f3` | `#14221c` |
| `--card` | `#ffffff` | `#1d2d24` |
| `--text` | `#263c32` | `#e6ece3` |
| `--muted` | `#7a847c` | `#9caea1` |
| `--border` | `#e7ebe5` | `#33443a` |
| `--green` | `#244e3b` | `#9ac9a7` |

Volba tématu se ukládá do localStorage; první otevření respektuje systémový režim. Přihlašovací token ani role se tam neukládají.

## Přihlášení

```text
Desktop: značka a ilustrace vlevo, formulář vpravo.
Mobil: značka a formulář v jedné koloně.

Forester                  [Téma]
Přihlášení do Foresteru
Uživatelské jméno [             ]
Heslo            [           👁 ]
[ Přihlásit se                  ]
```

Obrazovka zobrazuje chyby přihlášení a stav odesílání. Nový účet nebo účet po resetu musí nejprve změnit dočasné heslo.

## Dispečer

```text
┌────────────────┬──────────────────────────────┐
│ Forester       │ Pracovní prostor / Úvod   ☾ │
│ Úvod           ├──────────────────────────────┤
│ Účty a         │ Vítejte, Petr.               │
│ oprávnění      │ Jste přihlášeni jako dispečer│
│                │ Jméno, username a role       │
│                │ [ Správa účtů ]              │
│ Uživatel / ↪   │                              │
└────────────────┴──────────────────────────────┘
```

Správa účtů obsahuje hledání, vytvoření a úpravu jména, username, role, aktivity a profilu zaměstnance. Reset hesla je samostatná akce. Dialog upozorňuje na zneplatnění dosavadního přihlášení upravovaného účtu. Duplicita a zastaralá verze zobrazí chybu bez přepsání aktuálních dat.

## Řidič

```text
┌───────────────────────────────┐
│ ☰  Úvod                  ☾ MN│
├───────────────────────────────┤
│ Vítejte, Martin.              │
│ Jste přihlášeni jako řidič.   │
│                               │
│ Martin Novák                  │
│ @ridic · Řidič                │
│ Správu účtu zajišťuje dispečer.│
└───────────────────────────────┘
Navigace: Úvod, odhlášení.
```

Úvod neobsahuje přepravy, techniku, statistiky ani samostatnou profilovou sekci. Jméno a role v postranním panelu jsou informační. Při přímém otevření správy účtů se zobrazí odmítnutí přístupu. Ostatní neznámé adresy zobrazí nedostupnou stránku s návratem na úvod.

## Stavy a ověření

Rozhraní obsahuje načítání, prázdný seznam účtů, nulový výsledek hledání, chybu API, nepovolenou roli, vypršení session a potvrzení úspěšného zápisu. Formuláře upozorňují na neuložené změny. Dialog má implementovaný focus, Escape a návrat fokusu. Stav není vyjádřený pouze barvou.

Do 700 px se navigace vysouvá. CSS obsahuje úpravy pro mobilní rozložení. Vizuální kontrola na desktopu a šířce 360 px, skutečný kontrast a ovládání klávesnicí zůstávají neověřené. Checklist je v `docs/overeni.md`.
