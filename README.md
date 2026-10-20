# Hero Defender

Mroczna gra roguelike na telefon. Chodzisz łucznikiem po nieskończonym cmentarzysku, a on sam atakuje najbliższe potwory. Przetrwaj jak najwięcej fal.

**Zagraj:** https://viamio.github.io/hero-defender-/

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

Większość kart przy awansie to **bronie**. Możesz nosić 6 broni naraz (obok łuku), a każda ma 8 poziomów. Rzadsza karta broni daje od razu kilka poziomów i dodatkową siłę.

| Broń | Rodzaj | Co robi |
|---|---|---|
| ⚙️ Wirujące Ostrza | Wręcz | krążą wokół bohatera |
| 🪓 Topór Bojowy | Wręcz | cięcie w najbliższego wroga, z odrzutem |
| ☠️ Kosa Żniwiarza | Wręcz | wielkie cięcie dookoła, leczy za zabójstwa |
| 🔫 Arkebuz | Palna | serie szybkich kul z daleka |
| 💥 Garłacz | Palna | śrut z bliska, mocny odrzut |
| 🎇 Miotacz Strzał | Dystans | pierścień strzał we wszystkie strony |
| 🔪 Rzucane Noże | Dystans | szybkie noże w kierunku marszu |
| 🌪️ Rzucane Topory | Dystans | lecą jak bumerang, tam i z powrotem |
| 🏹 Ciężka Kusza | Dystans | bełty w najsilniejszych wrogów |
| ♨️ Miotacz Ognia | Ogień | strumień ognia, podpala |
| ⚱️ Garnce Smoły | Pułapka | płonące kałuże, spowalniają |
| 💣 Bomby | Wybuch | rzucane w grupy wrogów |
| ⚡ Kamień Burzy | Magia | pioruny z nieba |
| 🔆 Święta Aura | Magia | krąg stale raniący wrogów wokół |
| 🐦‍⬛ Stado Kruków | Towarzysz | kruki dziobią wrogów |

Pozostałe karty: wzmocnienia broni (obrażenia, szybkość, obszar), ulepszenia łuku, żywioły, obrona, ruch, klątwy (ryzyko za nagrodę), **synergie** i **ewolucje**: broń na poziomie 6+ połączona z konkretną kartą zmienia się w potężniejszą wersję (np. Topór + Żelazne Zdrowie = Topór Rzeźnika).

## Pliki

| Plik | Co zawiera |
|---|---|
| `data.js` | **Balans gry**: wrogowie, bossowie, karty, błogosławieństwa, tempo trudności |
| `game.js` | Logika: fale, walka, karty, ekrany |
| `render.js` | Grafika rysowana kodem |
| `audio.js` | Dźwięki syntezowane w przeglądarce |
| `sw.js` | Działanie offline (przy aktualizacji podnieś `VERSION`) |
