#!/usr/bin/env python3
"""Controlla che data/promos.js sia valido prima di salvarlo come definitivo."""
import json
import re
import sys
from pathlib import Path

PREFIX = "window.PROMO_DATA = "
CATEGORIE = {"conto", "liquidita", "crypto", "airdrop", "defi"}
RISCHI = {"basso", "medio", "alto"}
VERIFICHE = {"alta", "media", "bassa"}
CRYPTO = {"crypto", "airdrop", "defi"}
ITALIA = {"autorizzato", "verificare", "non-regolamentato"}
CAMPI = [
    "id", "nome", "provider", "categoria", "valore", "valoreStima", "sintesi",
    "facilita", "tempo", "capitale", "rischio", "scadenza", "aggiunta",
    "aggiornata", "novita", "requisiti", "termini", "costi", "referral",
    "link", "fonte", "verifica", "note", "profittevole", "profitto", "italia",
]
DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def main():
    path = Path(__file__).resolve().parent.parent / "data" / "promos.js"
    text = path.read_text(encoding="utf-8").strip()
    if not text.startswith(PREFIX) or not text.endswith(";"):
        sys.exit(f"ERRORE: il file deve iniziare con '{PREFIX}' e finire con ';'")
    try:
        data = json.loads(text[len(PREFIX):-1])
    except json.JSONDecodeError as e:
        sys.exit(f"ERRORE: JSON non valido: {e}")

    errori = []
    if not DATA.match(data.get("aggiornato", "")):
        errori.append("'aggiornato' deve essere una data AAAA-MM-GG")
    if not isinstance(data.get("changelog"), list):
        errori.append("'changelog' deve essere una lista")

    for e in data.get("esclusi", []):
        if not e.get("nome") or not e.get("motivo"):
            errori.append("ogni voce di 'esclusi' richiede nome e motivo")
    if not isinstance(data.get("esclusi"), list):
        errori.append("'esclusi' deve essere una lista")

    ids = set()
    for p in data.get("promo", []):
        pid = p.get("id", "?")
        for campo in CAMPI:
            if campo not in p:
                errori.append(f"{pid}: manca il campo '{campo}'")
        if pid in ids:
            errori.append(f"{pid}: id duplicato")
        ids.add(pid)
        if p.get("categoria") not in CATEGORIE:
            errori.append(f"{pid}: categoria non valida")
        if p.get("rischio") not in RISCHI:
            errori.append(f"{pid}: rischio non valido")
        if p.get("verifica") not in VERIFICHE:
            errori.append(f"{pid}: verifica non valida")
        if p.get("facilita") not in (1, 2, 3, 4, 5):
            errori.append(f"{pid}: facilita deve essere tra 1 e 5")
        if not isinstance(p.get("profittevole"), bool):
            errori.append(f"{pid}: 'profittevole' deve essere true o false")
        if not p.get("profitto"):
            errori.append(f"{pid}: 'profitto' deve spiegare la classificazione")
        it = p.get("italia")
        if p.get("categoria") in CRYPTO:
            if not isinstance(it, dict) or it.get("stato") not in ITALIA or not it.get("testo"):
                errori.append(f"{pid}: le promo crypto richiedono 'italia' con stato e testo")
        elif it is not None:
            errori.append(f"{pid}: 'italia' deve essere null fuori dalle categorie crypto")
        for campo in ("aggiunta", "aggiornata"):
            if not DATA.match(str(p.get(campo, ""))):
                errori.append(f"{pid}: '{campo}' deve essere AAAA-MM-GG")
        if p.get("scadenza") is not None and not DATA.match(str(p["scadenza"])):
            errori.append(f"{pid}: 'scadenza' deve essere AAAA-MM-GG o null")
        for campo in ("requisiti", "termini"):
            if not isinstance(p.get(campo), list) or not p.get(campo):
                errori.append(f"{pid}: '{campo}' deve essere una lista non vuota")

    if errori:
        sys.exit("ERRORI:\n- " + "\n- ".join(errori))
    print(f"OK: {len(ids)} promo valide, aggiornato al {data['aggiornato']}")


if __name__ == "__main__":
    main()
