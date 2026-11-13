# Promo Radar

Sito statico (GitHub Pages: https://came790.github.io/promo-radar/) che elenca promo di conti,
liquidità ed exchange/airdrop/DeFi crypto utilizzabili dall'Italia. Il proprietario non è un
programmatore: spiegazioni in italiano semplice.

- `index.html`, `style.css`, `app.js`: l'interfaccia. Non modificarli durante un aggiornamento dati.
- `data/promos.js`: **l'unico file da toccare per aggiornare le promo**.
- `tools/validate.py`: controllo obbligatorio dopo ogni modifica dei dati (`python3 tools/validate.py`).

## Procedura di aggiornamento giornaliero

1. Leggi `data/promos.js` e `tools/validate.py` (schema dei campi e valori ammessi).
2. Data di oggi = fuso Europe/Rome, formato AAAA-MM-GG. Chiamala OGGI.
3. Per **ogni promo esistente** verifica sul web (sito ufficiale prima, poi comparatori come
   qualebanca.com, ponss.it, aziendabanca.it, promarketer.it) se è ancora attiva, prorogata o cambiata.
   - Cambiata (importo, requisiti, scadenza, condizioni): aggiorna i campi, metti `aggiornata` = OGGI
     e scrivi in `novita` una frase che spiega cosa è cambiato.
   - Invariata: non toccare `aggiornata` né `novita`.
   - Scaduta da più di 30 giorni: rimuovila dal catalogo (annotalo nel changelog).
   - Scaduta da meno di 30 giorni: lasciala (il sito la mostra nella sezione "Scadute").
4. Cerca **nuove promo** nelle stesse categorie: nuovi conti con bonus/cashback/tassi promozionali,
   codici amico, conti deposito/liquidità remunerata, bonus di benvenuto di exchange **autorizzati MiCA**,
   airdrop e rendimenti DeFi rilevanti. Per le nuove: `aggiunta` = `aggiornata` = OGGI, `novita` = "".
5. Crypto: ogni promo crypto/airdrop/defi deve avere `italia` con `stato` e `testo`. Piattaforme non
   utilizzabili dall'Italia vanno in `esclusi` con il motivo, non nel catalogo.
6. Classificazione `profittevole`: true solo se il guadagno è alto rispetto a quanto bisogna spendere,
   vincolare o rischiare (es. "spendi 20€ ricevi 20€" sì; "spendi 1.000€ per 100€ in buoni" no;
   tassi su capitale vincolato e airdrop non garantiti: no). `profitto` spiega il perché in una frase.
7. `verifica`: alta = confermato su fonte ufficiale o aggiornata; media = solo comparatore; bassa = fonti
   discordanti. In caso di dubbio scrivilo nei `termini` o in `note`, non inventare.
8. Imposta `aggiornato` = OGGI e aggiungi **in testa** a `changelog` una voce `{data: OGGI, voci: [...]}`
   con frasi brevi: nuove, cambiate, rimosse, in scadenza nei prossimi 10 giorni, confermate senza
   variazioni. Tieni solo le ultime 20 voci di changelog. Se nulla è cambiato, aggiorna comunque
   `aggiornato` con una voce "Nessuna variazione".
9. Esegui `python3 tools/validate.py`: deve stampare OK. Correggi finché non passa.
10. Commit su `main` con messaggio "Aggiornamento promo OGGI" e **push diretto su `main`**
    (non su un ramo `claude/`): il sito si ripubblica da solo.

Regole: mai inventare importi o scadenze; non toccare i file dell'interfaccia; testi in italiano semplice.
