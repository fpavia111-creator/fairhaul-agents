# Agenti per i trasporti Fairhaul

*Tradotto da Claude; revisione di un madrelingua in attesa. Il [README](README.md) inglese fa fede.*

Trenta piccoli agenti MCP per i costi di trasporto e spedizione. Ognuno si occupa di **un solo compito**, come controllare una fattura di trasporto, preparare il rateo dei trasporti di fine mese, liquidare i pagamenti ai vettori o verificare una dichiarazione doganale, e non può agire oltre. Leggono i file che già esportate da TMS, ERP, WMS, portali dei vettori e fornitore EDI, scrivono i report sul vostro computer e attendono una persona indicata per nome prima di qualsiasi cosa che sposti denaro, invii un messaggio o modifichi un sistema in produzione.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · nessuna dipendenza

## Provare

```bash
npx -y fairhaul-freight-bill-audit demo        # controllo fatture di trasporto su dati fittizi
npx -y fairhaul-freight-accruals demo     # rateo dei trasporti su dati fittizi
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi di prova e un server MCP (`npx -y <agent> mcp --root <cartella>`) per Claude Desktop, Claude Code, Cursor e altri host MCP. Per ora i nomi delle colonne e i report sono in inglese.

## Gli agenti

**Cosa fatturano i vettori:** `fairhaul-freight-bill-audit` (carico completo e groupage rispetto ai contratti), `fairhaul-parcel-refunds` (corrieri), `fairhaul-detention-and-lumper` (soste e attese), `fairhaul-fuel-surcharges` (supplementi carburante), `fairhaul-accessorial-charges` (origine dei servizi accessori), `fairhaul-ltl-reweighs` (ripesature e cambi di classe), `fairhaul-duplicate-payments` (pagamenti doppi), `fairhaul-ocean-freight-audit` (marittimo), `fairhaul-air-freight-audit` (aereo), `fairhaul-proof-of-delivery` (prove di consegna), `fairhaul-container-demurrage` (franchigia container e controstallie), `fairhaul-customs-entries` (dichiarazioni doganali rispetto alle fatture commerciali, senza consulenza sulla classificazione).

**Pianificare, acquistare e gestire i trasporti:** `fairhaul-rfp-bid-scoring` (gare), `fairhaul-contract-rerating` (storico ricalcolato con ogni contratto), `fairhaul-spot-quotes` (quotazioni spot), `fairhaul-lane-spend` (spesa per tratta e consolidamento), `fairhaul-carrier-scorecards` (scorecard dei vettori), `fairhaul-carrier-vetting` (segnali di frode), `fairhaul-load-tracking` (spedizioni in ritardo), `fairhaul-dock-scheduling` (appuntamenti alle baie), `fairhaul-carton-sizing` (dimensioni degli imballi), `fairhaul-edi-files` (lettura e riconciliazione dei file X12).

**Chiusura e costi:** `fairhaul-freight-accruals` (rateo dei trasporti), `fairhaul-freight-allocation` (trasporto ripartito per ordine e centro di costo), `fairhaul-standard-freight-cost` (standard di trasporto nel costo degli articoli), `fairhaul-freight-margins` (trasporto addebitato rispetto al costo reale per cliente), `fairhaul-broker-settlements` (pagamenti ai vettori per broker), `fairhaul-freight-claims` (reclami per danni), `fairhaul-returns-tracking` (resi fino alla nota di credito), `fairhaul-freight-emissions` (stime delle emissioni con i fattori che scegliete voi).

## Come restano sicuri

- **Elenco consentito per agente.** Ogni agente può chiamare solo i propri strumenti.
- **Strumenti rifiutati.** Pagare, inviare e-mail, modificare il TMS, registrare in contabilità generale o presentare in dogana sono nominati e bloccati.
- **Un clic nominativo.** Pagamenti, invii, modifiche in produzione e approvazioni di registrazioni attendono una persona indicata per nome, anche in modalità Auto, legati allo sha256 della bozza rivista.
- **Registro di audit** in `.lodestar/`, concatenato tramite hash, firmato se configurate una chiave Ed25519.
- **Arresto di emergenza:** `<agent> kill` ferma tutti gli strumenti fino a `<agent> unkill`.

## Come vengono testati

Ogni agente ha test propri sulle sue regole, gli stessi test di contratto di tutti gli altri (argomenti, file fuori da `--root`, modalità Revisione, arresto di emergenza, approvazione delle bozze, risultati ripetibili) e da 14 a 22 casi di valutazione su file fittizi. Ogni caso con tabelle viene rieseguito come esportazione tedesca, francese, spagnola, brasiliana, italiana, giapponese, cinese e coreana, e nei file di ogni agente vengono inseriti dati ostili. In totale: 915 test e 520 casi di valutazione, superati su Node 20, 22 e 24. [REVIEW-ver3.md](REVIEW-ver3.md) (in inglese) elenca le modifiche della versione 2 e i bug trovati.

## Limiti

- Ogni agente lavora solo con i file che gli fornite e non accede a nessun sistema di vettori, TMS, ERP, banche o enti pubblici.
- Nessuna consulenza legale, fiscale, doganale o contabile. Le persone decidono e agiscono.
