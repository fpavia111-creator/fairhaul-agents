# Fairhaul-Frachtagenten

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

Dreißig kleine MCP-Agenten für Fracht- und Versandkosten. Jeder ist für **eine Aufgabe** zuständig, etwa eine Frachtrechnung prüfen, die Frachtabgrenzung zum Monatsende erstellen, Frachtführer-Zahlungen abrechnen oder eine Zollanmeldung prüfen, und kann nicht darüber hinaus handeln. Sie lesen die Dateien, die Sie bereits aus TMS, ERP, WMS, Frachtführer-Portalen und vom EDI-Dienstleister exportieren, schreiben Berichte auf Ihrem Rechner und warten auf eine namentlich genannte Person, bevor Geld bewegt, eine Nachricht gesendet oder ein laufendes System geändert wird.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · keine Abhängigkeiten

## Ausprobieren

```bash
npx -y fairhaul-freight-bill-audit demo        # Frachtrechnungsprüfung mit fiktiven Daten
npx -y fairhaul-freight-accruals demo     # Frachtabgrenzung mit fiktiven Daten
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`npx -y <agent> mcp --root <ordner>`) für Claude Desktop, Claude Code, Cursor und andere MCP-Hosts. Spaltennamen und Berichte sind vorerst auf Englisch.

## Die Agenten

**Was Frachtführer berechnen:** `fairhaul-freight-bill-audit` (Komplett- und Teilladungsrechnungen gegen Verträge), `fairhaul-parcel-refunds` (Paketrechnungen), `fairhaul-detention-and-lumper` (Standgeld und Wartezeit), `fairhaul-fuel-surcharges` (Dieselzuschläge), `fairhaul-accessorial-charges` (Ursachen von Nebenleistungen), `fairhaul-ltl-reweighs` (Nachwiegungen und Klassenänderungen), `fairhaul-duplicate-payments` (Doppelzahlungen), `fairhaul-ocean-freight-audit` (Seefracht), `fairhaul-air-freight-audit` (Luftfracht), `fairhaul-proof-of-delivery` (Zustellnachweise), `fairhaul-container-demurrage` (Container-Freizeit und Demurrage), `fairhaul-customs-entries` (Zollanmeldungen gegen Handelsrechnungen, ohne Tarifierungsberatung).

**Fracht planen, einkaufen und steuern:** `fairhaul-rfp-bid-scoring` (Ausschreibungen), `fairhaul-contract-rerating` (Historie unter jedem Vertrag neu bewertet), `fairhaul-spot-quotes` (Spotangebote), `fairhaul-lane-spend` (Relationskosten und Bündelung), `fairhaul-carrier-scorecards` (Frachtführer-Scorecards), `fairhaul-carrier-vetting` (Warnzeichen für Betrug), `fairhaul-load-tracking` (verspätete Sendungen), `fairhaul-dock-scheduling` (Rampentermine), `fairhaul-carton-sizing` (Kartongrößen), `fairhaul-edi-files` (X12-Dateien lesen und abgleichen).

**Abschluss und Kosten:** `fairhaul-freight-accruals` (Frachtabgrenzung), `fairhaul-freight-allocation` (Fracht auf Aufträge und Kostenstellen verteilen), `fairhaul-standard-freight-cost` (Frachtstandards in Artikelkosten), `fairhaul-freight-margins` (berechnete gegen tatsächliche Fracht je Kunde), `fairhaul-broker-settlements` (Frachtführer-Zahlungen für Broker), `fairhaul-freight-claims` (Schadensmeldungen), `fairhaul-returns-tracking` (Retouren bis zur Gutschrift), `fairhaul-freight-emissions` (Emissionsschätzungen mit Faktoren Ihrer Wahl).

## Wie sie sicher bleiben

- **Freigabeliste je Agent.** Jeder Agent darf nur seine eigenen Werkzeuge aufrufen.
- **Maskiert, bevor das Modell es sieht.** Namen von Paket- und Retourenempfängern, Unterzeichnern, Kontakten und Fahrern werden zu Pseudonymen (`CU-3f2a9c1d`, `ST-8cea1a2d`), Telefonnummern, E-Mails und Straßenadressen zu Platzhaltern. Firmennamen von Frachtführern und Kunden, Ladungs- und Rechnungsnummern, Daten und Beträge gehen unverändert hinaus (`--pii strict` verbirgt auch Firmennamen). Die Dateien auf Ihrem Rechner behalten die echten Werte.
- **Verweigerte Werkzeuge.** Bezahlen, E-Mails senden, TMS ändern, ins Hauptbuch buchen oder beim Zoll einreichen sind benannt und gesperrt.
- **Ein namentlicher Klick.** Zahlungen, Sendungen, Produktionsänderungen und Buchungsfreigaben warten auf eine namentlich genannte Person, auch im Auto-Modus, gebunden an den sha256 des geprüften Entwurfs.
- **Prüfprotokoll** unter `.fairhaul/`, verkettet über Hashes, signiert, wenn Sie einen Ed25519-Schlüssel einrichten.
- **Not-Aus:** `<agent> kill` stoppt alle Werkzeuge bis `<agent> unkill`.

## Wie sie getestet werden

Jeder Agent hat eigene Tests für seine Regeln, dieselben Vertragstests wie alle anderen (Argumente, Dateien außerhalb von `--root`, Prüfmodus, Not-Aus, Freigabe von Entwürfen, wiederholbare Ergebnisse) und 14 bis 22 Testfälle auf fiktiven Dateien. Jeder Fall mit Tabellen läuft zusätzlich als deutscher, französischer, spanischer, brasilianischer, italienischer, japanischer, chinesischer und koreanischer Export, und in die Dateien jedes Agenten werden feindliche Daten eingeschleust. Insgesamt 915 Tests und 520 Testfälle, bestanden auf Node 20, 22 und 24. [REVIEW-ver3.md](REVIEW-ver3.md) (englisch) listet die Änderungen in Version 2 und die gefundenen Fehler.

## Grenzen

- Jeder Agent arbeitet nur mit den Dateien, die Sie ihm geben, und meldet sich bei keinem Frachtführer-, TMS-, ERP-, Bank- oder Behördensystem an.
- Keine Rechts-, Steuer-, Zoll- oder Buchhaltungsberatung. Menschen entscheiden und handeln.
