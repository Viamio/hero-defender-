# Ostatnia Wieża

Mroczna gra roguelike na telefon. Chodzisz łucznikiem po nieskończonym cmentarzysku, a on sam atakuje najbliższe potwory. Przetrwaj jak najwięcej fal.

**Zagraj:** https://viamio.github.io/Wie-a-niesko-czono-ci-/

## Jak grać

- **Dotknij ekranu w dowolnym miejscu i przesuń palec**, a bohater idzie w tę stronę (joystick pojawia się pod palcem). Na komputerze: WASD lub strzałki.
- Bohater **sam atakuje najbliższego wroga**.
- **Przycisk w prawym dolnym rogu** (lub spacja) to umiejętność *Deszcz Strzał*.
- Zabici wrogowie zostawiają **niebieskie kryształy**. Podejdź, żeby je zebrać. Na każdym poziomie wybierasz **1 z 3 kart**.
- Czasem wypada **serce** (leczy) albo **magnes** (przyciąga wszystkie kryształy).
- Co 5 fal do walki dołącza **boss**. Za pokonanie bossa lub elity dostajesz skrzynię z lepszą kartą.

## Instalacja na telefonie

Otwórz link w przeglądarce i wybierz:
- **Android (Chrome):** menu ⋮ → *Dodaj do ekranu głównego* / *Zainstaluj aplikację*
- **iPhone (Safari):** przycisk Udostępnij → *Do ekranu początkowego*

Po pierwszym uruchomieniu gra działa także bez internetu.

## Karty

Rzadkości: pospolita 84%, rzadka 10%, epicka 5%, legendarna 1%. Rzadsza karta to ta sama karta, ale mocniejsza.

Rodzaje kart: statystyki, modyfikatory ataku, żywioły, bronie (kusza, miotacz ognia, wirujące ostrza, garnce smoły), towarzysze, efekty przy zabiciu, obrona, klątwy (ryzyko za nagrodę), **synergie** (pojawiają się przy konkretnych parach kart) i **ewolucje** (legendarne połączenia).

## Pliki

| Plik | Co zawiera |
|---|---|
| `data.js` | **Balans gry**: wrogowie, bossowie, karty, błogosławieństwa, tempo trudności |
| `game.js` | Logika: fale, walka, karty, ekrany |
| `render.js` | Grafika rysowana kodem |
| `audio.js` | Dźwięki syntezowane w przeglądarce |
| `sw.js` | Działanie offline (przy aktualizacji podnieś `VERSION`) |
