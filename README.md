# Ostatnia Wieża

Mroczna gra roguelike na telefon. Bronisz wieży przed nieskończonymi falami potworów, a łucznik na jej szczycie strzela tam, gdzie trzymasz palec.

**Zagraj:** https://viamio.github.io/Wie-a-niesko-czono-ci-/

## Jak grać

- **Przytrzymaj palec** na ekranie, a bohater strzela w to miejsce. Puścisz, to strzela sam do najbliższego wroga (trochę wolniej).
- **Przycisk w prawym dolnym rogu** to umiejętność *Deszcz Strzał*.
- Zabici wrogowie dają doświadczenie. Na każdym poziomie wybierasz **1 z 3 kart**.
- Co 5 fal do walki dołącza **boss**. Za pokonanie bossa lub elity dostajesz skrzynię z lepszą kartą.

## Instalacja na telefonie

Otwórz link w przeglądarce i wybierz:
- **Android (Chrome):** menu ⋮ → *Dodaj do ekranu głównego* / *Zainstaluj aplikację*
- **iPhone (Safari):** przycisk Udostępnij → *Do ekranu początkowego*

Po pierwszym uruchomieniu gra działa także bez internetu.

## Karty

Rzadkości: pospolita 84%, rzadka 10%, epicka 5%, legendarna 1%. Rzadsza karta to ta sama karta, ale mocniejsza.

Rodzaje kart: statystyki, modyfikatory ataku, żywioły, wieżyczki (dobudowują się do wieży), towarzysze, efekty przy zabiciu, obrona, klątwy (ryzyko za nagrodę), **synergie** (pojawiają się przy konkretnych parach kart) i **ewolucje** (legendarne połączenia).

## Pliki

| Plik | Co zawiera |
|---|---|
| `data.js` | **Balans gry**: wrogowie, bossowie, karty, błogosławieństwa, tempo trudności |
| `game.js` | Logika: fale, walka, karty, ekrany |
| `render.js` | Grafika rysowana kodem |
| `audio.js` | Dźwięki syntezowane w przeglądarce |
| `sw.js` | Działanie offline (przy aktualizacji podnieś `VERSION`) |
