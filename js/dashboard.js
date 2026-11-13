/* Dashboard: index.html */
(function () {
  "use strict";
  var P = window.PropsEV;
  var state = {
    payload: null,
    rows: [],
    sortKey: "ev_per_100",
    sortDir: "desc",
  };

  var COLUMNS = [
    { key: "player", label: "Player" },
    { key: "position", label: "Pos" },
    { key: "tier", label: "Tier" },
    { key: "matchup", label: "Matchup" },
    { key: "market", label: "Market" },
    { key: "side", label: "Side" },
    { key: "line", label: "Line", num: true },
    { key: "odds_american", label: "Odds", num: true },
    { key: "book", label: "Book" },
    { key: "model_prob", label: "Model", num: true },
    { key: "fair_odds_american", label: "Fair", num: true },
    { key: "edge_pct", label: "Edge", num: true },
    { key: "ev_per_100", label: "EV / $100", num: true },
    { key: "kelly_stake_pct", label: "Stake", num: true },
    { key: "drivers", label: "Why", wrap: true },
    { key: "confidence", label: "Conf / N" },
  ];

  function $(id) { return document.getElementById(id); }

  function unique(rows, key) {
    var set = {};
    var out = [];
    rows.forEach(function (r) {
      var v = r[key];
      if (v == null || v === "") return;
      if (!set[v]) {
        set[v] = true;
        out.push(String(v));
      }
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  function populateFilters(rows) {
    fillSelectSimple($("filter-game"), unique(rows, "matchup"), "All games");
    fillSelectSimple($("filter-position"), unique(rows, "position"), "All positions");
    var markets = unique(rows, "market");
    fillSelectSimple($("filter-market"), markets, "All markets", P.marketLabel);
    fillSelectSimple($("filter-book"), unique(rows, "book"), "All books");
  }

  function fillSelectSimple(sel, values, placeholder, labelFn) {
    var current = sel.value;
    sel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = labelFn ? labelFn(v) : v;
      sel.appendChild(o);
    });
    if (current && values.indexOf(current) !== -1) sel.value = current;
  }

  function filters() {
    var minEdgeRaw = $("filter-edge-num").value;
    var minEdge = minEdgeRaw === "" ? null : Number(minEdgeRaw);
    if (minEdge != null && !Number.isFinite(minEdge)) minEdge = null;
    return {
      q: ($("filter-q").value || "").trim().toLowerCase(),
      game: $("filter-game").value,
      position: $("filter-position").value,
      market: $("filter-market").value,
      book: $("filter-book").value,
      minEdge: minEdge,
      showFailed: $("filter-failed").checked,
    };
  }

  function applyFilters(rows) {
    var f = filters();
    return rows.filter(function (r) {
      if (!f.showFailed && P.isFailed(r)) return false;
      if (f.game && r.matchup !== f.game) return false;
      if (f.position && r.position !== f.position) return false;
      if (f.market && r.market !== f.market) return false;
      if (f.book && r.book !== f.book) return false;
      if (f.minEdge != null && !(Number.isFinite(r.edge_pct) && r.edge_pct >= f.minEdge)) return false;
      if (f.q) {
        var hay = (r.player + " " + (r.team || "") + " " + (r.opponent || "")).toLowerCase();
        if (hay.indexOf(f.q) === -1) return false;
      }
      return true;
    });
  }

  function sortRows(rows) {
    var key = state.sortKey;
    var dir = state.sortDir === "asc" ? 1 : -1;
    var numeric = [
      "line", "odds_american", "model_prob", "fair_odds_american",
      "edge_pct", "ev_per_100", "kelly_stake_pct", "sample_size",
    ];
    var copy = rows.slice();
    copy.sort(function (a, b) {
      var va = a[key];
      var vb = b[key];
      var na = va == null || va === "";
      var nb = vb == null || vb === "";
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      if (numeric.indexOf(key) !== -1) {
        return (Number(va) - Number(vb)) * dir;
      }
      return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" }) * dir;
    });
    return copy;
  }


  function tierBadge(row) {
    var tier = row.tier || "Pass";
    var cls = "badge tier-" + String(tier).toLowerCase();
    return '<span class="' + cls + '">' + P.escapeHtml(tier) + "</span>";
  }

  function confCell(row) {
    var parts = [];
    if (row.confidence) parts.push(P.escapeHtml(String(row.confidence)));
    if (row.sample_size != null) parts.push("n=" + P.escapeHtml(String(row.sample_size)));
    return parts.join(" · ") || "—";
  }

  function renderTable(rows) {
    var thead = $("props-thead");
    thead.innerHTML = "<tr>" + COLUMNS.map(function (c) {
      var sort = c.key === state.sortKey ? ' aria-sort="' + (state.sortDir === "asc" ? "ascending" : "descending") + '"' : "";
      var cls = (c.num ? " num" : "") + (c.wrap ? " wrap" : "");
      return '<th scope="col" data-key="' + c.key + '" class="' + cls.trim() + '"' + sort + ">" + c.label + "</th>";
    }).join("") + "</tr>";

    var tbody = $("props-tbody");
    if (!rows.length) {
      tbody.innerHTML = "";
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var failed = P.isFailed(r) ? " failed" : "";
      var liq = P.liquidityLine(r);
      var chips = P.contextChips(r);
      var matchup = P.escapeHtml(r.matchup || "—") +
        (r.kickoff ? '<span class="sub">' + P.escapeHtml(P.formatKickoff(r.kickoff)) + "</span>" : "") +
        chips;
      var book = P.escapeHtml(r.book || "—") +
        (liq ? '<span class="sub">' + P.escapeHtml(liq) + "</span>" : "");
      var sideCls = r.side === "over" ? "pill over" : r.side === "under" ? "pill under" : "pill";
      var cells = [
        '<td><span class="player-cell">' + P.escapeHtml(r.player || "—") + "</span>" +
          (r.team ? '<span class="sub">' + P.escapeHtml(r.team + (r.opponent ? " vs " + r.opponent : "")) + "</span>" : "") +
          "</td>",
        '<td class="pos">' + P.escapeHtml(r.position || "—") + "</td>",
        "<td>" + tierBadge(r) + "</td>",
        '<td class="wrap">' + matchup + "</td>",
        "<td>" + P.escapeHtml(P.marketLabel(r.market)) + "</td>",
        "<td><span class=\"" + sideCls + "\">" + P.escapeHtml(r.side || "—") + "</span></td>",
        '<td class="num">' + (r.line != null ? r.line : "—") + "</td>",
        '<td class="num">' + P.formatAmerican(r.odds_american) + "</td>",
        "<td>" + book + "</td>",
        '<td class="num">' + P.formatProb(r.model_prob) + "</td>",
        '<td class="num">' + P.formatAmerican(r.fair_odds_american) + "</td>",
        '<td class="num ' + P.edgeClass(r.edge_pct) + '">' + P.formatSignedPct(r.edge_pct) + "</td>",
        '<td class="num ' + P.evClass(r.ev_per_100) + '">' + P.formatMoney(r.ev_per_100) + "</td>",
        '<td class="num">' + (Number.isFinite(r.kelly_stake_pct) ? r.kelly_stake_pct.toFixed(2) + "%" : "—") + "</td>",
        '<td class="wrap">' + P.escapeHtml(r.summary || r.drivers || "—") + (r.summary && r.drivers && r.summary !== r.drivers ? '<span class="sub">' + P.escapeHtml(r.drivers) + "</span>" : "") + "</td>",
        "<td>" + confCell(r) + "</td>",
      ];
      return '<tr class="' + failed.trim() + '">' + cells.join("") + "</tr>";
    }).join("");
  }

  function renderCards(rows) {
    var root = $("props-cards");
    if (!rows.length) {
      root.innerHTML = '<div class="empty-state">No props match the current filters.</div>';
      return;
    }
    root.innerHTML = rows.map(function (r) {
      var failed = P.isFailed(r) ? " failed" : "";
      var liq = P.liquidityLine(r);
      var chips = P.contextChips(r);
      var sideCls = r.side === "over" ? "pill over" : r.side === "under" ? "pill under" : "pill";
      function cell(label, value, cls) {
        return '<div><span class="label">' + label + '</span><span class="' + (cls || "") + '">' + value + "</span></div>";
      }
      return (
        '<article class="card' + failed + '">' +
          '<div class="card-top">' +
            "<div>" +
              '<div class="player-cell">' + P.escapeHtml(r.player || "—") +
                ' <span class="pos">' + P.escapeHtml(r.position || "") + "</span> " + tierBadge(r) + "</div>" +
              '<div class="sub">' + P.escapeHtml(r.matchup || "") +
                (r.kickoff ? " · " + P.escapeHtml(P.formatKickoff(r.kickoff)) : "") + "</div>" +
              chips +
            "</div>" +
            '<div class="card-ev ' + P.evClass(r.ev_per_100) + '">' + P.formatMoney(r.ev_per_100) +
              '<span class="sub">EV / $100</span></div>' +
          "</div>" +
          '<div class="card-grid">' +
            cell("Market", P.escapeHtml(P.marketLabel(r.market)) + " " +
              '<span class="' + sideCls + '">' + P.escapeHtml(r.side || "—") + "</span> " +
              (r.line != null ? P.escapeHtml(String(r.line)) : "")) +
            cell("Odds", P.formatAmerican(r.odds_american) +
              (r.book ? ' <span class="muted">@ ' + P.escapeHtml(r.book) + "</span>" : "")) +
            cell("Model", P.formatProb(r.model_prob)) +
            cell("Fair", P.formatAmerican(r.fair_odds_american)) +
            cell("Edge", P.formatSignedPct(r.edge_pct), P.edgeClass(r.edge_pct)) +
            cell("Stake", Number.isFinite(r.kelly_stake_pct) ? r.kelly_stake_pct.toFixed(2) + "% bankroll" : "—") +
            (liq ? cell("Liquidity", P.escapeHtml(liq)) : "") +
            cell("Conf / N", confCell(r)) +
          "</div>" +
          ((r.summary || r.drivers) ? '<div class="card-why">' + P.escapeHtml(r.summary || r.drivers) + "</div>" : "") +
        "</article>"
      );
    }).join("");
  }

  function render() {
    var visible = sortRows(applyFilters(state.rows));
    $("results-count").textContent =
      visible.length + " of " + state.rows.length + " prop" + (state.rows.length === 1 ? "" : "s");
    renderTable(visible);
    renderCards(visible);
  }

  function bind() {
    ["filter-q", "filter-game", "filter-position", "filter-market", "filter-book", "filter-failed"].forEach(function (id) {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
    var slider = $("filter-edge");
    var num = $("filter-edge-num");
    slider.addEventListener("input", function () {
      num.value = slider.value;
      render();
    });
    num.addEventListener("input", function () {
      if (num.value !== "") slider.value = num.value;
      render();
    });
    $("props-thead").addEventListener("click", function (e) {
      var th = e.target.closest("th[data-key]");
      if (!th) return;
      var key = th.getAttribute("data-key");
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "ev_per_100" || key === "edge_pct" || key === "kelly_stake_pct" || key === "model_prob" ? "desc" : "asc";
      }
      render();
    });
  }

  function showMeta(payload, rows) {
    var bits = [];
    if (payload.season != null) bits.push("Season <strong>" + P.escapeHtml(String(payload.season)) + "</strong>");
    if (payload.week != null) bits.push("Week <strong>" + P.escapeHtml(String(payload.week)) + "</strong>");
    var ts = P.lastUpdated(payload, rows);
    bits.push("Last updated <strong>" + P.escapeHtml(P.formatET(ts)) + "</strong>");
    $("page-meta").innerHTML = bits.join('<span class="muted"> · </span>');

    var banner = $("sample-banner");
    if (payload.sample) {
      banner.hidden = false;
      banner.className = "banner sample";
      banner.innerHTML = "<strong>Sample data, model outputs not published yet.</strong> These numbers are placeholders — not real edges, probabilities, or betting recommendations.";
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  function init() {
    bind();
    P.fetchJson("data/props_ev.json")
      .then(function (raw) {
        var payload = P.normalizePayload(raw);
        var rows = payload.rows.map(function (r) { return P.normalizeRow(r, payload); });
        state.payload = payload;
        state.rows = rows;
        populateFilters(rows);
        showMeta(payload, rows);
        render();
      })
      .catch(function (err) {
        $("page-meta").textContent = "";
        var banner = $("sample-banner");
        banner.hidden = false;
        banner.className = "banner err";
        banner.textContent = err && err.status === 404
          ? "No props file has been published yet (data/props_ev.json is missing)."
          : "Could not load data/props_ev.json.";
        $("results-count").textContent = "";
        $("props-tbody").innerHTML = "";
        $("props-cards").innerHTML = '<div class="empty-state">No data loaded.</div>';
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
