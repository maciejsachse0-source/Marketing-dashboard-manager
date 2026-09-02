# DECISIONS — dziennik decyzji i obalonych hipotez

Format wpisu:

```
## <data> · <issue> · <tytuł decyzji>
Kontekst: co było do rozstrzygnięcia.
Rozważane: warianty, po jednym zdaniu.
Decyzja: co wybrano.
Dowód: liczby, komenda, plik. Dla decyzji wydajnościowych obowiązkowo przed i po.
Konsekwencja: co się zmienia w kodzie i co trzeba pamiętać później.
```

Obalona hipoteza wydajnościowa (zmiana, która nie poprawiła metryki o 10%) jest
normalnym wpisem, nie porażką. Zapisz ją, żeby nikt nie próbował drugi raz.

---

*(brak wpisów)*

## 2026-09-02 · F0-01 · Baza lokalna: kontener Docker zamiast bazy zdalnej
Kontekst: w chwili startu F0-01 w repozytorium nie było `.env.local`, więc `DATABASE_URL`
nie istniał. Wyzwalacz wariantu zapasowego z F0-01 zadziałał dosłownie.
Rozważane: (a) czekać na URL od usera i zatrzymać całą fazę F0; (b) postawić Postgresa
w Dockerze i trzy bazy w jednej instancji, zgodnie z zapisanym wariantem zapasowym.
Decyzja: (b). Kontener `mc-pg`, obraz `postgres:17`, port hosta 5433, hasło `mc`.
Trzy bazy w tej instancji: `marketing` (robocza), `marketing_perf` (pomiarowa),
`marketing_test` (testowa).
Dowód: `docker info` kod 0; `select 1` odpowiada na wszystkich trzech URL-ach;
`drizzle/migrate.ts` kod 0 na każdej z trzech baz; po migracji każda ma 12 tabel
w schemacie `public` (`select count(*) from information_schema.tables where table_schema='public'`).
Konsekwencja: pomiary z F0-03 i F0-05 powstają na lokalnym Postgresie 17 na dysku SSD
Maca, nie na hostingu produkcyjnym. Liczby są porównywalne między sobą (baseline i po
zmianie mierzone tak samo), ale NIE są prognozą czasów produkcyjnych, bo tam dochodzi
RTT do bazy zdalnej. Gdy user dostarczy prawdziwy `DATABASE_URL`, baseline trzeba
przemierzyć od nowa i zapisać z innym polem `mode`. Kontener trzeba wstać przed każdą
sesją pracy: `docker start mc-pg`.
