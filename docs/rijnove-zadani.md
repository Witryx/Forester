# Forester — říjnové zadání 2026

Aktualizováno 20. 10. 2026. Rozsah vychází z říjnového seznamu dodaného uživatelem a jeho upřesnění: aplikace má obsahovat pouze říjnový základ. Toto vymezení má přednost před širším říjnovým plánem v původním PRD.

## 1. Databázový návrh

- Relační model a diagram vazeb v `docs/erd.md`.
- SQL migrace, primární a cizí klíče, jedinečná přihlašovací jména a vazba účtu na zaměstnance.
- Databáze SQLite s opakovatelnými migracemi a uchováním dat po restartu.

## 2. Přihlášení a uživatelské role

- Přihlášení a odhlášení pomocí serverové session.
- Role Dispečer a Řidič.
- Deaktivace účtu zablokuje nové přihlášení a zneplatní stávající session.
- Oddělení obrazovek a serverová kontrola oprávnění.
- Bezpečné uložení hesel, omezení chybných pokusů a povinná změna dočasného hesla.

## 3. Základ administrace

Dispečer vytváří a upravuje uživatele, přiřazuje roli a mění aktivitu. Může upravit celé jméno, přihlašovací jméno a propojení na zaměstnance nebo resetovat heslo. Posledního aktivního dispečera nelze deaktivovat ani mu odebrat roli. Konflikt zastaralé verze a duplicitní přihlášení se odmítají.

Doplnění 22. 10. 2026: při založení řidičského účtu může dispečer také vytvořit nového zaměstnance zadáním jména a příjmení. Evidenční kód přidělí server automaticky. Profil a propojený účet se uloží společně; výběr existujícího zaměstnance zůstává dostupný.

## 4. Návrh UI/UX aplikace

- Vizuální styl Foresteru, sdílené formuláře a tlačítka, světlý a tmavý režim.
- Přihlašovací obrazovka.
- Základní rozložení dispečerské a řidičské části včetně mobilní navigace.
- Dispečer: Úvod, Účty a oprávnění, odhlášení.
- Řidič: Úvod se jménem, přihlašovacím jménem a rolí, odhlášení.
- Změna dočasného hesla je součástí přihlášení, samostatná profilová sekce není v navigaci.

## Hranice rozsahu

Práce řidiče, technika, plán přeprav, rezervace a prohlížení historie změn nejsou součástí říjnového rozhraní ani provozního API. Staré adresy těchto obrazovek zobrazí nedostupnou stránku. Aplikace neukazuje plánované moduly ani harmonogram jejich dodání.

Existující databázový model, uložená data, interní audit účtů a doménová služba rezervací zůstávají zachované. Nejsou tím označené za součást dodaného říjnového uživatelského rozhraní.

## Ověření a demo

1. Přihlásit se jako `dispecer`, otevřít Účty a oprávnění.
2. Vytvořit účet pro volný profil zaměstnance, upravit jméno a roli.
3. Odhlásit se a přihlásit `ridic`; dostupný je pouze základní úvod.
4. Jako řidič otevřít `/firma/ucty`; přístup musí být odmítnutý i přes API.
5. Deaktivovat řidiče jako dispečer; stará session i nové přihlášení musí selhat.
6. Ověřit, že staré adresy práce, techniky, dispatch a auditu nejsou dostupné.

Automatické testy a build jsou popsané v `docs/overeni.md`. Vizuální QA na desktopu a šířce 360 px zůstává k provedení.
