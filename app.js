(function () {
  const DATA = window.PROMO_DATA || { aggiornato: "", changelog: [], promo: [], esclusi: [] };
  DATA.esclusi = DATA.esclusi || [];
  const DAY = 86400000;
  const CATEGORIE = {
    conto: "Conti",
    liquidita: "Liquidità",
    crypto: "Exchange crypto",
    airdrop: "Airdrop",
    defi: "DeFi",
  };
  const CRYPTO = ["crypto", "airdrop", "defi"];
  const CRYPTO_SEZIONI = {
    crypto: ["Exchange", "Bonus di benvenuto e inviti su exchange che possono operare in Italia."],
    airdrop: ["Airdrop", "Campagne a punti e distribuzioni di token: premio mai garantito."],
    defi: ["DeFi: rendite", "Rendimenti su stablecoin con protocolli non custodial."],
  };
  const ITALIA = {
    autorizzato: ["Autorizzato in Italia", "good"],
    verificare: ["Italia: da verificare", "soon"],
    "non-regolamentato": ["Accessibile, non regolamentato", "soon"],
  };
  const VERIFICA = {
    alta: "Verificata su fonte aggiornata",
    media: "Da ricontrollare sul sito ufficiale",
    bassa: "Dati incerti: verifica prima di procedere",
  };
  const KEY = "promo.state";
  const TABS = ["oggi", "facili", "crypto", "tutte", "attivita"];

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\//.test(u || "") ? u : "");
  const euro = (n) => (Number(n) || 0).toLocaleString("it-IT", { maximumFractionDigits: 2 }) + "€";
  const byId = (id) => DATA.promo.find((x) => x.id === id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const todayISO = iso(today);
  const parse = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const daysTo = (s) => (s ? Math.round((parse(s) - today) / DAY) : null);
  const fmt = (s) => parse(s).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  /* ---------- Stato salvato nel browser ---------- */

  function normalize(raw) {
    const s = Object.assign(
      { people: [], progress: {}, hidden: {}, codes: {}, notes: {}, hideDone: false, tab: "oggi", sort: "consigliate", person: "tutti" },
      raw && typeof raw === "object" ? raw : {}
    );
    if (!Array.isArray(s.people)) s.people = [];
    s.people = s.people.filter((p) => p && typeof p.id === "string" && typeof p.nome === "string");
    if (!s.people.some((p) => p.id === "io")) s.people.unshift({ id: "io", nome: "Io" });
    for (const k of ["progress", "hidden", "codes", "notes"]) if (!s[k] || typeof s[k] !== "object") s[k] = {};
    if (!TABS.includes(s.tab)) s.tab = "oggi";
    if (s.person !== "tutti" && !s.people.some((p) => p.id === s.person)) s.person = "tutti";
    return s;
  }

  function loadState() {
    const read = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch (e) {
        return null;
      }
    };
    const saved = read(KEY);
    if (saved) return normalize(saved);
    // Migrazione dalla prima versione dell'app
    const s = normalize({ hidden: read("promo.hidden") || {}, hideDone: localStorage.getItem("promo.hideDone") === "1" });
    for (const id of read("promo.done") || []) {
      const p = byId(id);
      if (p) s.progress[id] = { io: { steps: p.requisiti.map((_, i) => i), stato: "", importo: 0, inizio: todayISO, nome: p.nome } };
    }
    return s;
  }

  const state = loadState();
  const ui = { cat: "tutte", profit: "tutte", query: "", sheetId: null, sheetPerson: "io" };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* archiviazione non disponibile */
    }
  };

  /* ---------- Regole ---------- */

  const isExpired = (p) => p.scadenza && daysTo(p.scadenza) < 0;
  const isNew = (p) => p.aggiunta === DATA.aggiornato;
  const isChanged = (p) => !isNew(p) && p.aggiornata === DATA.aggiornato && p.novita;
  const isSoon = (p) => p.scadenza && daysTo(p.scadenza) >= 0 && daysTo(p.scadenza) <= 10;
  const isEasy = (p) => p.facilita >= 4 && p.rischio !== "alto" && !isExpired(p);
  const isHidden = (p) => state.hidden[p.id] === p.aggiornata;
  const isBack = (p) => p.id in state.hidden && !isHidden(p);
  const personName = (id) => (state.people.find((x) => x.id === id) || { nome: "?" }).nome;
  const forWho = (id) => (id === "io" ? "te" : personName(id));

  function rec(p, person, create) {
    let all = state.progress[p.id];
    if (!all && create) all = state.progress[p.id] = {};
    if (!all) return null;
    if (!all[person] && create) all[person] = { steps: [], stato: "", importo: 0, inizio: todayISO, nome: p.nome };
    return all[person] || null;
  }

  const stepsDone = (p, r) => (r ? r.steps.filter((i) => i < p.requisiti.length).length : 0);

  // none | incorso | attesa (requisiti completati, bonus non ancora arrivato) | incassato
  function status(p, person) {
    const r = rec(p, person);
    if (!r) return "none";
    if (r.stato === "incassato") return "incassato";
    const n = stepsDone(p, r);
    if (!n) return "none";
    return n >= p.requisiti.length ? "attesa" : "incorso";
  }

  const doneByMe = (p) => ["attesa", "incassato"].includes(status(p, "io"));

  function deadlineLabel(p) {
    if (!p.scadenza) return "Senza scadenza nota";
    const d = daysTo(p.scadenza);
    if (d < 0) return "Scaduta";
    if (d === 0) return "Scade oggi";
    if (d === 1) return "Scade domani";
    return "Scade tra " + d + " giorni";
  }

  function matches(p) {
    if (ui.cat !== "tutte" && state.tab !== "crypto" && p.categoria !== ui.cat) return false;
    if (ui.profit === "si" && !p.profittevole) return false;
    if (ui.profit === "no" && p.profittevole) return false;
    if (state.hideDone && doneByMe(p)) return false;
    if (!ui.query) return true;
    const hay = [p.nome, p.provider, p.sintesi, p.valore, CATEGORIE[p.categoria], p.requisiti.join(" ")].join(" ").toLowerCase();
    return hay.includes(ui.query);
  }

  const byEase = (a, b) => b.profittevole - a.profittevole || b.facilita - a.facilita || b.valoreStima - a.valoreStima;
  const byDeadline = (a, b) => (daysTo(a.scadenza) ?? 9999) - (daysTo(b.scadenza) ?? 9999);
  const SORT = {
    consigliate: byEase,
    scadenza: (a, b) => byDeadline(a, b) || byEase(a, b),
    valore: (a, b) => b.valoreStima - a.valoreStima || byEase(a, b),
    recenti: (a, b) => b.aggiunta.localeCompare(a.aggiunta) || b.aggiornata.localeCompare(a.aggiornata) || byEase(a, b),
  };
  const sorted = (items) => items.slice().sort((a, b) => isExpired(a) - isExpired(b) || (SORT[state.sort] || byEase)(a, b));

  /* ---------- Pezzi di interfaccia ---------- */

  function dots(n) {
    return '<span class="dots" aria-label="Facilità ' + n + ' su 5">' + "●".repeat(n) + "<i>" + "●".repeat(5 - n) + "</i></span>";
  }

  function profitBox(p) {
    return (
      '<div class="profit' + (p.profittevole ? " yes" : "") + '"><b>' + (p.profittevole ? "Profittevole" : "Non profittevole") +
      "</b><span>" + esc(p.profitto) + "</span></div>"
    );
  }

  function who(p) {
    return (
      '<span class="avatar">' + esc(p.provider.trim().charAt(0).toUpperCase()) + "</span>" +
      '<div class="card-who"><div class="card-provider">' + esc(p.provider) + '</div><div class="card-cat">' + esc(CATEGORIE[p.categoria]) + "</div></div>"
    );
  }

  function peopleBadges(p) {
    return state.people
      .map((x) => {
        const st = status(p, x.id);
        if (st === "none") return "";
        if (st === "incorso") return '<span class="badge info">' + esc(x.nome) + " " + stepsDone(p, rec(p, x.id)) + "/" + p.requisiti.length + "</span>";
        if (st === "attesa") return '<span class="badge soon">' + esc(x.nome) + ": attende il bonus</span>";
        return '<span class="badge good">' + esc(x.nome) + " ✓</span>";
      })
      .join("");
  }

  function card(p) {
    const hidden = isHidden(p);
    const it = p.italia && ITALIA[p.italia.stato];
    const badges = [
      isBack(p) ? '<span class="badge new">È cambiata: rivalutala</span>' : "",
      isNew(p) ? '<span class="badge new">Nuova</span>' : "",
      isChanged(p) && !isBack(p) ? '<span class="badge new">Aggiornata</span>' : "",
      isExpired(p) ? '<span class="badge bad">Scaduta</span>' : isSoon(p) ? '<span class="badge soon">' + deadlineLabel(p) + "</span>" : "",
      it ? '<span class="badge ' + it[1] + '">' + it[0] + "</span>" : "",
      peopleBadges(p),
    ].join("");
    const showNews = p.novita && (isBack(p) || p.aggiornata === DATA.aggiornato);
    return (
      '<div class="card cat-' + esc(p.categoria) + (doneByMe(p) ? " done" : "") + (isExpired(p) ? " expired" : "") + (isBack(p) ? " back" : "") +
      '" data-id="' + esc(p.id) + '" role="button" tabindex="0">' +
      '<div class="card-top">' + who(p) +
      (hidden ? "" : '<button class="card-x" data-hide="' + esc(p.id) + '" aria-label="Elimina dal radar" title="Elimina dal radar">✕</button>') +
      "</div>" +
      '<p class="card-value">' + esc(p.valore) + "</p>" +
      '<p class="card-name">' + esc(p.nome) + "</p>" +
      profitBox(p) +
      (showNews ? '<p class="card-news">' + esc(p.novita) + "</p>" : "") +
      '<div class="card-badges">' + badges + "</div>" +
      '<div class="card-meta"><span>Facilità ' + dots(p.facilita) + "</span>" +
      "<span>Rischio <b>" + esc(p.rischio) + "</b></span>" +
      "<span>" + esc(p.scadenza && !isSoon(p) && !isExpired(p) ? "Fino al " + fmt(p.scadenza) : p.tempo) + "</span></div>" +
      "</div>"
    );
  }

  function section(title, sub, items) {
    if (!items.length) return "";
    return (
      '<h2 class="section-title">' + esc(title) + " <small>" + items.length + "</small></h2>" +
      (sub ? '<p class="section-sub">' + esc(sub) + "</p>" : "") +
      '<div class="list">' + items.map(card).join("") + "</div>"
    );
  }

  /* ---------- Viste ---------- */

  function viewOggi(active) {
    let html = "";
    const age = DATA.aggiornato ? -daysTo(DATA.aggiornato) : 0;
    if (age > 1) {
      html += '<div class="banner"><b>Dati fermi da ' + age + " giorni.</b> L'aggiornamento automatico di ogni mattina non è andato a buon fine: " +
        "controlla il task \"Aggiorna Promo Radar\" su claude.ai/code/routines. Controlla le scadenze prima di procedere.</div>";
    }
    const back = active.filter(isBack);
    const fresh = active.filter((p) => (isNew(p) || isChanged(p)) && !isBack(p));
    const soon = active.filter(isSoon).sort(byDeadline);
    html += section("Da rivalutare", "Le avevi eliminate, ma sono cambiate. Tienile o eliminale di nuovo.", back);
    const log = DATA.changelog.find((c) => c.data === DATA.aggiornato);
    if (log && log.voci.length) {
      html += '<h2 class="section-title">Cosa è cambiato</h2><p class="section-sub">Aggiornamento del ' + fmt(DATA.aggiornato) +
        '</p><div class="panel changes"><ul>' + log.voci.map((v) => "<li>" + esc(v) + "</li>").join("") + "</ul></div>";
    }
    html += section("In scadenza", "Chiudono entro 10 giorni.", soon);
    const firstLoad = DATA.promo.length && DATA.promo.every(isNew);
    html += section(
      firstLoad ? "Catalogo iniziale" : "Novità di oggi",
      firstLoad ? "Primo caricamento: da domani qui vedrai solo le promo nuove o modificate." : "Promo aggiunte o cambiate nell'ultimo aggiornamento.",
      sorted(fresh)
    );
    if (!fresh.length && !back.length) html += '<h2 class="section-title">Novità di oggi</h2><p class="empty">Nessuna novità nell\'ultimo aggiornamento.</p>';
    return html;
  }

  // Le promo scadute non stanno tra le attive: finiscono in una sezione chiusa in fondo
  function expiredFold(items) {
    const gone = items.filter(isExpired).sort((a, b) => b.scadenza.localeCompare(a.scadenza));
    if (!gone.length) return "";
    return '<details class="fold"><summary>Scadute (' + gone.length + ")</summary>" +
      '<p class="section-sub">Non più attive. Restano qui finché il prossimo aggiornamento non le toglie dal catalogo.</p>' +
      '<div class="list">' + gone.map(card).join("") + "</div></details>";
  }

  function viewCrypto(visible) {
    const all = visible.filter((p) => CRYPTO.includes(p.categoria));
    const items = sorted(all.filter((p) => !isExpired(p)));
    let html = CRYPTO.map((c) => section(CRYPTO_SEZIONI[c][0], CRYPTO_SEZIONI[c][1], items.filter((p) => p.categoria === c))).join("");
    if (!html) html = '<p class="empty">Nessuna promo crypto corrisponde ai filtri.</p>';
    html += expiredFold(all);
    if (DATA.esclusi.length) {
      html += '<h2 class="section-title">Escluse: non utilizzabili dall\'Italia</h2>' +
        '<p class="section-sub">Piattaforme controllate e lasciate fuori dal radar.</p>' +
        '<div class="panel excluded"><ul>' + DATA.esclusi.map((e) => "<li><b>" + esc(e.nome) + "</b> — " + esc(e.motivo) + "</li>").join("") + "</ul></div>";
    }
    return html;
  }

  function viewTutte(visible) {
    const items = sorted(visible.filter((p) => !isExpired(p)));
    let html =
      section("Profittevoli", "Guadagno alto rispetto a quello che devi spendere o impegnare.", items.filter((p) => p.profittevole)) +
      section("Non profittevoli", "Guadagno basso, incerto o legato a capitale da impegnare.", items.filter((p) => !p.profittevole));
    if (!html) html = '<p class="empty">Nessuna promo corrisponde ai filtri.</p>';
    html += expiredFold(visible);
    const gone = DATA.promo.filter(isHidden);
    if (gone.length) {
      html += '<details class="fold"><summary>Promo eliminate (' + gone.length + ")</summary>" +
        '<p class="section-sub">Tornano da sole nel radar se cambiano. Apri una promo per ripristinarla.</p>' +
        '<div class="list">' + gone.map(card).join("") + "</div></details>";
    }
    return html;
  }

  // Tutte le righe di avanzamento, comprese quelle di promo non più in catalogo
  function activityRows() {
    const rows = [];
    for (const [pid, people] of Object.entries(state.progress)) {
      const p = byId(pid);
      for (const [person, r] of Object.entries(people)) {
        if (!state.people.some((x) => x.id === person)) continue;
        const st = p ? status(p, person) : r.stato === "incassato" ? "incassato" : "orfana";
        if (st !== "none") rows.push({ pid, p, person, r, st });
      }
    }
    return rows;
  }

  function row(x) {
    const title = x.p ? x.p.nome : x.r.nome || "Promo rimossa";
    const cat = x.p ? " cat-" + x.p.categoria : "";
    const avatar = '<span class="avatar">' + esc(title.charAt(0).toUpperCase()) + "</span>";
    let sub = esc(personName(x.person));
    let side = "";
    let extra = "";
    if (x.st === "incorso") {
      const n = stepsDone(x.p, x.r);
      const next = x.p.requisiti.find((_, i) => !x.r.steps.includes(i));
      sub += " · " + n + "/" + x.p.requisiti.length + " · Prossimo: " + esc(next);
      extra = '<div class="bar"><i style="width:' + Math.round((n / x.p.requisiti.length) * 100) + '%"></i></div>';
      side = x.p.scadenza ? '<span class="badge ' + (isExpired(x.p) ? "bad" : isSoon(x.p) ? "soon" : "") + '">' + deadlineLabel(x.p) + "</span>" : "";
    } else if (x.st === "attesa") {
      sub += " · Requisiti completati, bonus non ancora arrivato";
      side = '<span class="badge soon">' + esc(x.p.valore) + "</span>";
    } else if (x.st === "incassato") {
      sub += x.r.incasso ? " · Incassato il " + fmt(x.r.incasso) : " · Incassato";
      side = euro(x.r.importo);
    } else {
      sub += " · Non più in catalogo";
      side = '<span class="badge">Rimuovi</span>';
    }
    const attrs = x.p ? ' data-open="' + esc(x.pid) + '" data-person="' + esc(x.person) + '"' : ' data-drop="' + esc(x.pid) + '" data-person="' + esc(x.person) + '"';
    const tag = x.p || x.st === "orfana" ? "button" : "div";
    return (
      "<" + tag + ' class="row' + cat + '"' + (tag === "button" ? attrs : "") + ">" + avatar +
      '<div class="row-main"><div class="row-title">' + esc(title) + '</div><div class="row-sub">' + sub + "</div>" + extra + "</div>" +
      '<div class="row-side' + (x.st === "incassato" ? " money" : "") + '">' + side + "</div></" + tag + ">"
    );
  }

  function rowSection(title, sub, rows) {
    if (!rows.length) return "";
    return '<h2 class="section-title">' + esc(title) + " <small>" + rows.length + "</small></h2>" +
      (sub ? '<p class="section-sub">' + esc(sub) + "</p>" : "") + '<div class="rows">' + rows.map(row).join("") + "</div>";
  }

  function viewAttivita() {
    const all = activityRows();
    const rows = state.person === "tutti" ? all : all.filter((x) => x.person === state.person);
    const pick = (st) => rows.filter((x) => x.st === st);
    const incassato = pick("incassato").reduce((t, x) => t + (Number(x.r.importo) || 0), 0);
    const attesa = pick("attesa");
    const inCorso = pick("incorso").sort((a, b) => byDeadline(a.p, b.p));

    let html =
      '<div class="chips" style="margin-bottom:14px">' +
      [{ id: "tutti", nome: "Tutti" }, ...state.people]
        .map((x) => '<button class="chip" data-filter-person="' + esc(x.id) + '" aria-pressed="' + (state.person === x.id) + '">' + esc(x.nome) + "</button>")
        .join("") +
      "</div>" +
      '<div class="tiles">' +
      '<div class="tile money"><b>' + euro(incassato) + "</b><span>incassati</span></div>" +
      '<div class="tile"><b>' + euro(attesa.reduce((t, x) => t + x.p.valoreStima, 0)) + "</b><span>in arrivo (stima)</span></div>" +
      '<div class="tile"><b>' + inCorso.length + "</b><span>in corso</span></div>" +
      "</div>";

    html += rowSection("In corso", "Ordinate per scadenza. Tocca per continuare da dove eri rimasto.", inCorso);
    html += rowSection("In attesa del bonus", "Requisiti completati: quando arriva il premio, segnalo come incassato.", attesa);

    if (state.person !== "tutti") {
      const todo = DATA.promo
        .filter((p) => p.profittevole && !isExpired(p) && !isHidden(p) && status(p, state.person) === "none")
        .sort((a, b) => SORT.scadenza(a, b))
        .slice(0, 6);
      html += section("Da proporre a " + personName(state.person), "Profittevoli non ancora iniziate, prima quelle che scadono.", todo);
    }

    html += rowSection("Incassate", "", pick("incassato").sort((a, b) => (b.r.incasso || "").localeCompare(a.r.incasso || "")));
    html += rowSection("Rimosse dal catalogo", "Promo scadute mentre erano in corso. Tocca per toglierle dall'elenco.", pick("orfana"));
    if (!rows.length) {
      html += '<p class="empty">Ancora nessuna attività. Apri una promo e spunta i requisiti man mano che li completi: qui vedrai cosa manca, cosa sta per scadere e quanto hai incassato.</p>';
    }

    html +=
      '<h2 class="section-title">Persone</h2><p class="section-sub">Aggiungi amici e familiari per seguire le promo che fai fare a ognuno.</p>' +
      '<div class="panel"><div class="people-list">' +
      state.people
        .map((x) => '<span class="person-tag">' + esc(x.nome) + (x.id === "io" ? "&nbsp;" : '<button data-del-person="' + esc(x.id) + '" aria-label="Rimuovi ' + esc(x.nome) + '">✕</button>') + "</span>")
        .join("") +
      '</div><form class="people-form" id="person-form"><input class="field" id="person-name" placeholder="Nome (es. Mamma)" maxlength="30" aria-label="Nome della persona">' +
      '<button class="mini primary" type="submit">Aggiungi</button></form></div>' +
      '<h2 class="section-title">Backup</h2><p class="section-sub">Avanzamento, persone, note e promo eliminate vivono solo in questo browser. Salva un file per non perderli o per spostarli su un altro dispositivo.</p>' +
      '<div class="btn-row"><button class="mini" data-act="export">Esporta backup</button><button class="mini" data-act="import">Importa backup</button></div>';
    return html;
  }

  function render() {
    const radar = DATA.promo.filter((p) => !isHidden(p));
    const live = radar.filter((p) => !isExpired(p));
    const visible = radar.filter(matches);
    const active = visible.filter((p) => !isExpired(p));
    const rows = activityRows();
    const incassato = rows.filter((x) => x.st === "incassato").reduce((t, x) => t + (Number(x.r.importo) || 0), 0);

    $("stats").innerHTML =
      '<button class="stat" data-go="tutte"><b>' + live.length + "</b><span>attive</span></button>" +
      '<button class="stat" data-go="profittevoli"><b>' + live.filter((p) => p.profittevole).length + "</b><span>profittevoli</span></button>" +
      '<button class="stat" data-go="oggi"><b>' + live.filter(isSoon).length + "</b><span>in scadenza</span></button>" +
      '<button class="stat" data-go="attivita"><b>' + euro(incassato) + "</b><span>incassati</span></button>";
    $("count-oggi").textContent = live.filter((p) => isNew(p) || isChanged(p) || isBack(p)).length || "";
    $("count-facili").textContent = live.filter(isEasy).length || "";
    $("count-crypto").textContent = live.filter((p) => CRYPTO.includes(p.categoria)).length || "";
    $("count-tutte").textContent = live.length || "";
    $("count-attivita").textContent = rows.filter((x) => x.st === "incorso" || x.st === "attesa").length || "";

    let html;
    if (state.tab === "oggi") html = viewOggi(active);
    else if (state.tab === "facili") {
      html = section("Più facili e fattibili", "Pochi passaggi e rischio non alto.", sorted(active.filter(isEasy))) ||
        '<p class="empty">Nessuna promo corrisponde ai filtri.</p>';
    } else if (state.tab === "crypto") html = viewCrypto(visible);
    else if (state.tab === "tutte") html = viewTutte(visible);
    else html = viewAttivita();
    $("view").innerHTML = html;

    $("tools").hidden = state.tab === "attivita";
    $("chips").hidden = state.tab === "crypto";
    $("sort").value = state.sort;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === state.tab));
    document.querySelectorAll("#chips .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.cat === ui.cat));
    document.querySelectorAll("#chips-profit .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.profit === ui.profit));
  }

  /* ---------- Azioni ---------- */

  let toastTimer;
  function toast(text, undo) {
    const el = $("toast");
    el.innerHTML = "<span>" + esc(text) + "</span>" + (undo ? "<button>Annulla</button>" : "");
    el.hidden = false;
    if (undo) {
      el.querySelector("button").onclick = () => {
        undo();
        el.hidden = true;
      };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 6000);
  }

  function go(tab) {
    state.tab = tab;
    save();
    render();
    window.scrollTo(0, 0);
  }

  function hide(id) {
    const p = byId(id);
    if (!p) return;
    const before = state.hidden[id];
    state.hidden[id] = p.aggiornata;
    save();
    render();
    toast("Eliminata dal radar: tornerà solo se cambia.", () => {
      if (before === undefined) delete state.hidden[id];
      else state.hidden[id] = before;
      save();
      render();
    });
  }

  function download(name, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function calendar(p) {
    const clean = (s) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const d = parse(p.scadenza);
    const next = new Date(d.getTime() + DAY + 3600000);
    const ymd = (x) => iso(x).replace(/-/g, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Promo Radar//IT",
      "BEGIN:VEVENT",
      "UID:" + p.id + "-" + p.scadenza + "@promo-radar",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;VALUE=DATE:" + ymd(d),
      "DTEND;VALUE=DATE:" + ymd(next),
      "SUMMARY:" + clean("Scade promo: " + p.nome),
      "DESCRIPTION:" + clean(p.valore + "\n" + p.requisiti.map((r, i) => i + 1 + ". " + r).join("\n")),
      "BEGIN:VALARM",
      "TRIGGER:-P3D",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + clean("Tra 3 giorni scade: " + p.nome),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    download("scadenza-" + p.id + ".ics", ics, "text/calendar");
  }

  function shareText(p) {
    const code = (state.codes[p.id] || "").trim();
    return [
      p.nome + " (" + p.valore + ")",
      p.sintesi,
      "",
      "Cosa fare:",
      ...p.requisiti.map((r, i) => i + 1 + ". " + r),
      p.scadenza ? "\nScadenza: " + fmt(p.scadenza) : "",
      code ? "\nUsa il mio codice o link invito: " + code : "",
      safeUrl(p.link) && !/^https?:\/\//.test(code) ? "\n" + p.link : "",
    ].filter((l) => l !== "").join("\n");
  }

  /* ---------- Scheda di dettaglio ---------- */

  function progressBlock(p) {
    const person = ui.sheetPerson;
    const r = rec(p, person);
    const st = status(p, person);
    const pills =
      '<div class="chips">' +
      state.people
        .map((x) => {
          const s = status(p, x.id);
          const mark = s === "incassato" ? " ✓" : s === "attesa" ? " ⏳" : s === "incorso" ? " " + stepsDone(p, rec(p, x.id)) + "/" + p.requisiti.length : "";
          return '<button class="chip" data-sheet-person="' + esc(x.id) + '" aria-pressed="' + (x.id === person) + '">' + esc(x.nome) + mark + "</button>";
        })
        .join("") +
      "</div>";
    const steps =
      '<ol class="steps">' +
      p.requisiti
        .map((t, i) => {
          const on = !!r && (r.steps.includes(i) || r.stato === "incassato");
          return '<li class="' + (on ? "done" : "") + '"><label><input type="checkbox" data-step="' + i + '"' + (on ? " checked" : "") +
            (r && r.stato === "incassato" ? " disabled" : "") + '><span class="num">' + (on ? "✓" : i + 1) + '</span><span class="txt">' + esc(t) + "</span></label></li>";
        })
        .join("") +
      "</ol>";
    let box = "";
    if (st === "attesa") {
      box = '<div class="progress-box">Requisiti completati per <b>' + esc(forWho(person)) + "</b>. Quando arriva il bonus, registra l'importo." +
        '<div class="people-form"><input class="field" id="amount" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(p.valoreStima || "") +
        '" placeholder="€" aria-label="Importo incassato in euro"><button class="mini primary" data-act="cash">Bonus ricevuto</button></div></div>';
    } else if (st === "incassato") {
      box = '<div class="progress-box good"><b>' + (person === "io" ? "Hai incassato " : esc(personName(person)) + " ha incassato ") + euro(r.importo) + "</b>" +
        (r.incasso ? " il " + fmt(r.incasso) : "") + '. <button class="mini link" data-act="uncash">Annulla</button></div>';
    } else if (st === "incorso") {
      box = '<div class="progress-box">' + stepsDone(p, r) + " di " + p.requisiti.length + " completati per <b>" + esc(forWho(person)) +
        '</b>. <button class="mini link" data-act="reset">Azzera</button></div>';
    }
    return "<h3>Requisiti: spunta quelli completati</h3>" + pills + steps + box;
  }

  function renderSheet(enter) {
    const p = byId(ui.sheetId);
    const sheet = $("sheet");
    if (!p) return closeSheet();
    const keep = sheet.scrollTop;
    const link = safeUrl(p.link);
    const fonte = safeUrl(p.fonte);
    const it = p.italia && ITALIA[p.italia.stato];
    sheet.className = "sheet cat-" + p.categoria + (enter ? " enter" : "");
    sheet.innerHTML =
      '<div class="sheet-top">' + who(p) + '<button class="close" data-act="close" aria-label="Chiudi">✕</button></div>' +
      '<h2 id="sheet-title">' + esc(p.nome) + "</h2>" +
      '<p class="sheet-value">' + esc(p.valore) + '</p><p class="sheet-sum">' + esc(p.sintesi) + "</p>" +
      profitBox(p) +
      (isBack(p)
        ? '<div class="box news" style="margin-bottom:14px"><p><strong>È cambiata da quando l\'hai eliminata</strong>' +
          esc(p.novita || "Le condizioni sono state aggiornate il " + fmt(p.aggiornata) + ".") + "</p></div>"
        : "") +
      '<dl class="facts">' +
      (it ? '<div class="fact wide"><dt>Disponibilità in Italia</dt><dd>' + it[0] + "<small>" + esc(p.italia.testo) + "</small></dd></div>" : "") +
      '<div class="fact"><dt>Scadenza</dt><dd>' + (p.scadenza ? fmt(p.scadenza) + "<small>" + deadlineLabel(p) + "</small>" : "Non indicata") + "</dd></div>" +
      '<div class="fact"><dt>Facilità</dt><dd>' + dots(p.facilita) + "</dd></div>" +
      '<div class="fact"><dt>Tempo richiesto</dt><dd>' + esc(p.tempo) + "</dd></div>" +
      '<div class="fact"><dt>Capitale necessario</dt><dd>' + esc(p.capitale) + "</dd></div>" +
      '<div class="fact"><dt>Rischio</dt><dd>' + esc(p.rischio) + "</dd></div>" +
      '<div class="fact"><dt>Costi</dt><dd>' + esc(p.costi) + "</dd></div>" +
      "</dl>" +
      (p.novita && !isBack(p) ? "<h3>Ultima modifica · " + fmt(p.aggiornata) + '</h3><div class="box news"><p>' + esc(p.novita) + "</p></div>" : "") +
      progressBlock(p) +
      '<h3>Termini e condizioni</h3><ul class="terms">' + p.termini.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" +
      '<h3>Per amici e familiari</h3><div class="box">' +
      (p.referral ? "<p><strong>" + esc(p.referral.valore) + "</strong>" + esc(p.referral.testo) + "</p>" : "<p>Nessun programma inviti noto: puoi comunque condividere la promo.</p>") +
      '<input class="field" id="code" placeholder="Il tuo codice o link invito" value="' + esc(state.codes[p.id] || "") + '" aria-label="Il tuo codice o link invito">' +
      "</div>" +
      (p.note ? '<h3>Attenzione</h3><div class="box warn"><p>' + esc(p.note) + "</p></div>" : "") +
      '<h3>Note personali</h3><textarea class="field" id="note" placeholder="Appunti: date, importi versati, a chi l\'hai proposta">' + esc(state.notes[p.id] || "") + "</textarea>" +
      '<h3>Affidabilità del dato</h3><p class="source">' + esc(VERIFICA[p.verifica]) + ". Ultimo controllo: " + fmt(DATA.aggiornato) + "." +
      (fonte ? ' <a href="' + esc(fonte) + '" target="_blank" rel="noopener noreferrer">Apri la fonte</a>' : "") + "</p>" +
      '<div class="actions">' +
      (link ? '<a class="btn primary" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Vai al sito ufficiale</a>' : "") +
      '<button class="btn' + (p.scadenza ? "" : " wide") + '" data-act="share">Condividi</button>' +
      (p.scadenza ? '<button class="btn" data-act="ics">Scadenza in calendario</button>' : "") +
      (isBack(p) ? '<button class="btn wide" data-act="keep">Tienila nel radar</button>' : "") +
      (isHidden(p)
        ? '<button class="btn wide" data-act="keep">Ripristina nel radar</button>'
        : '<button class="btn wide danger" data-act="hide">' + (isBack(p) ? "Elimina di nuovo" : "Non mi interessa: elimina dal radar") + "</button>") +
      "</div>";
    sheet.scrollTop = enter ? 0 : keep;
  }

  function openSheet(id, person) {
    ui.sheetId = id;
    ui.sheetPerson = person || (state.person !== "tutti" ? state.person : "io");
    $("overlay").hidden = false;
    document.body.style.overflow = "hidden";
    renderSheet(true);
  }

  function closeSheet() {
    ui.sheetId = null;
    $("overlay").hidden = true;
    document.body.style.overflow = "";
  }

  function refresh() {
    save();
    render();
    if (ui.sheetId) renderSheet(false);
  }

  async function sheetAction(act, el) {
    const p = byId(ui.sheetId);
    if (!p) return;
    const person = ui.sheetPerson;
    if (act === "close") return closeSheet();
    if (act === "hide") {
      closeSheet();
      return hide(p.id);
    }
    if (act === "keep") {
      delete state.hidden[p.id];
      return refresh();
    }
    if (act === "ics") return calendar(p);
    if (act === "share") {
      const text = shareText(p);
      try {
        if (navigator.share) await navigator.share({ title: p.nome, text });
        else {
          await navigator.clipboard.writeText(text);
          el.textContent = "Copiato ✓";
        }
      } catch (e) {
        /* condivisione annullata o non permessa */
      }
      return;
    }
    if (act === "cash") {
      const r = rec(p, person, true);
      const v = parseFloat(String($("amount").value).replace(",", "."));
      r.stato = "incassato";
      r.importo = Number.isFinite(v) && v >= 0 ? v : 0;
      r.incasso = todayISO;
      r.nome = p.nome;
      return refresh();
    }
    if (act === "uncash") {
      const r = rec(p, person);
      if (r) {
        r.stato = "";
        r.steps = p.requisiti.map((_, i) => i);
      }
      return refresh();
    }
    if (act === "reset") {
      if (state.progress[p.id]) delete state.progress[p.id][person];
      return refresh();
    }
  }

  function toggleStep(i, on) {
    const p = byId(ui.sheetId);
    if (!p) return;
    const r = rec(p, ui.sheetPerson, true);
    r.steps = r.steps.filter((x) => x !== i && x < p.requisiti.length);
    if (on) r.steps.push(i);
    r.nome = p.nome;
    if (!r.steps.length && r.stato !== "incassato") delete state.progress[p.id][ui.sheetPerson];
    refresh();
  }

  /* ---------- Avvio ---------- */

  function init() {
    if (DATA.aggiornato) {
      const age = -daysTo(DATA.aggiornato);
      const el = $("updated");
      el.textContent = age <= 0 ? "Aggiornato oggi" : age === 1 ? "Aggiornato ieri" : "Aggiornato " + age + " giorni fa";
      el.classList.toggle("stale", age > 1);
    }

    $("chips").innerHTML =
      '<button class="chip" data-cat="tutte">Tutte le categorie</button>' +
      Object.entries(CATEGORIE)
        .map(([k, v]) => '<button class="chip cat-' + k + '" data-cat="' + k + '"><i></i>' + v + "</button>")
        .join("");
    $("chips-profit").innerHTML = [["tutte", "Tutte"], ["si", "Solo profittevoli"], ["no", "Non profittevoli"]]
      .map(([k, v]) => '<button class="chip" data-profit="' + k + '">' + v + "</button>")
      .join("");
    $("hide-done").checked = state.hideDone;

    document.querySelector(".tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (t) go(t.dataset.tab);
    });
    $("stats").addEventListener("click", (e) => {
      const s = e.target.closest("[data-go]");
      if (!s) return;
      ui.profit = s.dataset.go === "profittevoli" ? "si" : "tutte";
      go(s.dataset.go === "profittevoli" ? "tutte" : s.dataset.go);
    });
    $("chips").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      ui.cat = c.dataset.cat;
      render();
    });
    $("chips-profit").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      ui.profit = c.dataset.profit;
      render();
    });
    $("search").addEventListener("input", (e) => {
      ui.query = e.target.value.trim().toLowerCase();
      render();
    });
    $("hide-done").addEventListener("change", (e) => {
      state.hideDone = e.target.checked;
      save();
      render();
    });
    $("sort").addEventListener("change", (e) => {
      state.sort = e.target.value;
      save();
      render();
    });

    $("view").addEventListener("click", (e) => {
      const x = e.target.closest("[data-hide]");
      if (x) return hide(x.dataset.hide);
      const fp = e.target.closest("[data-filter-person]");
      if (fp) {
        state.person = fp.dataset.filterPerson;
        save();
        return render();
      }
      const del = e.target.closest("[data-del-person]");
      if (del) {
        const id = del.dataset.delPerson;
        if (!confirm("Rimuovere " + personName(id) + " e tutto il suo avanzamento?")) return;
        state.people = state.people.filter((p) => p.id !== id);
        for (const all of Object.values(state.progress)) delete all[id];
        if (state.person === id) state.person = "tutti";
        save();
        return render();
      }
      const drop = e.target.closest("[data-drop]");
      if (drop) {
        const all = state.progress[drop.dataset.drop];
        if (all) delete all[drop.dataset.person];
        save();
        return render();
      }
      const act = e.target.closest("[data-act]");
      if (act && act.dataset.act === "export") {
        return download("promo-radar-backup-" + todayISO + ".json", JSON.stringify(state, null, 2), "application/json");
      }
      if (act && act.dataset.act === "import") return $("import-file").click();
      const open = e.target.closest("[data-open]");
      if (open) return openSheet(open.dataset.open, open.dataset.person);
      const c = e.target.closest(".card");
      if (c) openSheet(c.dataset.id);
    });
    $("view").addEventListener("submit", (e) => {
      if (e.target.id !== "person-form") return;
      e.preventDefault();
      const nome = $("person-name").value.trim();
      if (!nome) return;
      const id = "p" + Date.now().toString(36);
      state.people.push({ id, nome });
      state.person = id;
      save();
      render();
    });
    $("view").addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
        e.preventDefault();
        openSheet(e.target.dataset.id);
      }
    });

    $("import-file").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.people)) throw new Error("formato");
        if (!confirm("Sostituire i dati attuali con quelli del backup?")) return;
        const next = normalize(raw);
        for (const k of Object.keys(state)) delete state[k];
        Object.assign(state, next);
        save();
        $("hide-done").checked = state.hideDone;
        render();
        toast("Backup importato.");
      } catch (err) {
        toast("File non valido: non è un backup di Promo Radar.");
      }
    });

    $("sheet").addEventListener("click", (e) => {
      const sp = e.target.closest("[data-sheet-person]");
      if (sp) {
        ui.sheetPerson = sp.dataset.sheetPerson;
        return renderSheet(false);
      }
      const act = e.target.closest("[data-act]");
      if (act) sheetAction(act.dataset.act, act);
    });
    $("sheet").addEventListener("change", (e) => {
      if (e.target.matches("[data-step]")) toggleStep(Number(e.target.dataset.step), e.target.checked);
    });
    $("sheet").addEventListener("input", (e) => {
      if (!ui.sheetId) return;
      const map = e.target.id === "code" ? state.codes : e.target.id === "note" ? state.notes : null;
      if (!map) return;
      if (e.target.value.trim()) map[ui.sheetId] = e.target.value;
      else delete map[ui.sheetId];
      save();
    });
    $("overlay").addEventListener("click", (e) => {
      if (e.target === $("overlay")) closeSheet();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ui.sheetId) closeSheet();
    });

    render();
  }

  init();
})();
