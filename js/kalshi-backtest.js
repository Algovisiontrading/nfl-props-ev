/* Kalshi 2026 weeks 1–9 props backtest. Renders only the out-of-sample
   variant from data/kalshi_backtest_2026.json. Never presents the leaky
   live_as_published (+$3.84 in-sample) figures. */
(function (global) {
  "use strict";
  var P = global.PropsEV;
  var URLS = ["data/kalshi_backtest_2026.json", "data/kalshi_backtest.json"];

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function pick(obj, keys) {
    if (!obj) return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
    }
    return undefined;
  }

  function formatSigned(v, digits) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    var d = digits == null ? 2 : digits;
    var abs = Math.abs(n).toFixed(d);
    if (n > 0) return "+" + abs;
    if (n < 0) return "−" + abs;
    return abs;
  }

  function formatProfit(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    var abs = Math.abs(n).toFixed(2);
    if (n > 0) return "+$" + abs;
    if (n < 0) return "−$" + abs;
    return "$" + abs;
  }

  function formatRange(ci) {
    if (!Array.isArray(ci) || ci.length < 2) return "—";
    var a = num(ci[0]);
    var b = num(ci[1]);
    if (a == null || b == null) return "—";
    return formatSigned(a, 1) + " to " + formatSigned(b, 1);
  }

  function formatRecord(row) {
    var w = num(pick(row, ["wins"]));
    var l = num(pick(row, ["losses"]));
    if (w != null && l != null) return P.formatInt(w) + "–" + P.formatInt(l);
    var rec = pick(row, ["record"]);
    if (rec == null) return "—";
    return String(rec).replace(/-/g, "–");
  }

  function formatMiss(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (Math.abs(n) >= 10) return n.toFixed(1);
    return n.toFixed(3);
  }

  function formatPct(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (n <= 1 && n >= 0) n = n * 100;
    return n.toFixed(1) + "%";
  }

  function ciOf(row) {
    var ci = pick(row, ["roi_ci95_game_cluster", "roi_ci95", "ci95", "profit_ci95", "ci"]);
    if (Array.isArray(ci)) return ci;
    if (ci && typeof ci === "object") {
      var lo = num(pick(ci, ["lo", "low", "lower", 0]));
      var hi = num(pick(ci, ["hi", "high", "upper", 1]));
      if (lo != null && hi != null) return [lo, hi];
    }
    return null;
  }

  function normalizeGroup(label, row) {
    row = row || {};
    return {
      group: label,
      bets: num(pick(row, ["bets", "n", "n_bets"])),
      record: formatRecord(row),
      profit: num(pick(row, ["roi_per_100", "profit_per_100", "pnl_per_100", "roi"])),
      ci: ciOf(row),
      raw: row
    };
  }

  function headlineBlock(oos) {
    if (!oos) return null;
    return oos.headline_one_bet_per_player_market || oos.headline || null;
  }

  /* Strict: only the out-of-sample variant. Never live_as_published. */
  function extractOos(data) {
    if (!data || typeof data !== "object") return null;
    var variants = data.variants;
    if (variants && typeof variants === "object") {
      if (variants.oos) return { oos: variants.oos, root: data };
      return null;
    }
    if (data.oos && typeof data.oos === "object") return { oos: data.oos, root: data };
    // Bare headline file is acceptable only if it is not labeled as live/leaky.
    if (data.headline_one_bet_per_player_market && data.live_as_published == null) {
      return { oos: data, root: data };
    }
    return null;
  }

  function groupRows(headline) {
    if (!headline) return [];
    var rows = [];
    if (headline.all) rows.push(normalizeGroup("All", headline.all));
    var tiers = headline.by_tier || headline.tiers || {};
    ["Strong", "Lean", "Pass"].forEach(function (t) {
      var rec = tiers[t] || tiers[t.toLowerCase()];
      if (rec) rows.push(normalizeGroup(t, rec));
    });
    var markets = headline.by_market || headline.markets || {};
    var mkeys = Object.keys(markets);
    mkeys.sort(function (a, b) {
      var pa = num(pick(markets[a], ["roi_per_100", "profit_per_100"])) || 0;
      var pb = num(pick(markets[b], ["roi_per_100", "profit_per_100"])) || 0;
      return pb - pa;
    });
    mkeys.forEach(function (k) {
      var label = (P.marketLabel(k) || k);
      rows.push(normalizeGroup(label, markets[k]));
    });
    return rows;
  }

  function rangesIncludeZero(rows) {
    if (!rows.length) return false;
    return rows.every(function (r) {
      if (!r.ci || r.ci.length < 2) return false;
      var a = num(r.ci[0]);
      var b = num(r.ci[1]);
      return a != null && b != null && a <= 0 && b >= 0;
    });
  }

  function groupsTable(rows) {
    var body = rows.map(function (r) {
      return "<tr>" +
        "<td>" + P.escapeHtml(r.group) + "</td>" +
        '<td class="num">' + (r.bets != null ? P.formatInt(r.bets) : "—") + "</td>" +
        "<td>" + P.escapeHtml(r.record) + "</td>" +
        '<td class="num ' + P.evClass(r.profit) + '">' + formatProfit(r.profit) + "</td>" +
        '<td class="num">' + P.escapeHtml(formatRange(r.ci)) + "</td>" +
        "</tr>";
    }).join("");
    return '<div class="table-wrap" style="border:0;background:transparent;">' +
      '<table class="plain" aria-label="Kalshi backtest groups">' +
      "<thead><tr>" +
      "<th>Group</th><th class=\"num\">Bets</th><th>Record</th>" +
      "<th class=\"num\">Profit per $100</th><th class=\"num\">95% range</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function baselineNote(oos) {
    var base = oos && (oos.naive_market_baseline || oos.baseline);
    if (!base) return "";
    var over = base.buy_over_every_rung || base.buy_every_over || base.every_over;
    var under = base.buy_under_every_rung || base.buy_every_under || base.every_under;
    var overRoi = over ? num(pick(over, ["roi_per_100", "profit_per_100"])) : null;
    var underRoi = under ? num(pick(under, ["roi_per_100", "profit_per_100"])) : null;
    function loseAmt(v) {
      if (v == null) return null;
      return "$" + Math.abs(v).toFixed(2);
    }
    var parts = [];
    if (overRoi != null) parts.push("buying every over loses " + loseAmt(overRoi) + "/$100");
    if (underRoi != null) parts.push("every under " + loseAmt(underRoi) + "/$100");
    if (!parts.length) return "";
    return "For reference, " + parts[0] + (parts[1] ? ", " + parts[1] : "") + ".";
  }

  function pvmRows(block) {
    if (!block) return [];
    var src = block.by_market || block.markets || block.rows;
    var list = [];
    if (Array.isArray(src)) list = src.slice();
    else if (src && typeof src === "object") {
      Object.keys(src).forEach(function (k) {
        var rec = src[k] || {};
        if (rec.market == null) rec = Object.assign({ market: k }, rec);
        list.push(rec);
      });
    }
    return list;
  }

  function pvmTable(block) {
    var rows = pvmRows(block);
    if (!rows.length) return "";
    var body = rows.map(function (r) {
      var market = r.market || r.stat || r.name || "—";
      var label = P.marketLabel(market) || market;
      if (r.published === false) label += " (unpublished)";
      var our = num(pick(r, ["mae_our_median", "our_miss", "mae_model", "mae_ours"]));
      var mkt = num(pick(r, ["mae_market_median", "market_miss", "mae_market"]));
      var closer = num(pick(r, ["head_to_head_we_closer", "pct_closer", "we_closer"]));
      var n = num(pick(r, ["n", "games", "count"]));
      return "<tr>" +
        "<td>" + P.escapeHtml(label) + "</td>" +
        '<td class="num">' + (n != null ? P.formatInt(n) : "—") + "</td>" +
        '<td class="num">' + formatMiss(our) + "</td>" +
        '<td class="num">' + formatMiss(mkt) + "</td>" +
        '<td class="num">' + formatPct(closer) + "</td>" +
        "</tr>";
    }).join("");
    var intro = "Our miss versus the market’s implied-median miss, and how often our projection was closer. " +
      "Numbers are from the file’s out-of-sample comparison (not the in-sample live models).";
    return '<h3 class="tally-heading">Projection vs. market implied median</h3>' +
      '<p class="panel-intro">' + intro + "</p>" +
      '<div class="table-wrap" style="border:0;background:transparent;">' +
      '<table class="plain" aria-label="Projection versus market implied median">' +
      "<thead><tr>" +
      "<th>Stat</th><th class=\"num\">Games</th>" +
      "<th class=\"num\">Our miss</th>" +
      "<th class=\"num\">Market implied median miss</th>" +
      "<th class=\"num\">% closer</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function render(data) {
    var empty = document.getElementById("kalshi-backtest-empty");
    var content = document.getElementById("kalshi-backtest-content");
    var panel = document.getElementById("kalshi-backtest") || document.getElementById("kalshi-backtest-panel");
    if (!content) return;
    var extracted = extractOos(data);
    if (!extracted || !headlineBlock(extracted.oos)) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "The out-of-sample Kalshi backtest is not in this file, so no results are shown.";
      }
      content.innerHTML = "";
      return;
    }
    var rows = groupRows(headlineBlock(extracted.oos));
    if (!rows.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "No Kalshi weeks 1–9 props backtest has been published yet. It will appear here when the modeler results file is available.";
      }
      content.innerHTML = "";
      return;
    }
    var notes = [];
    notes.push("Models were refit on data through 2025 only.");
    notes.push("Fees are included.");
    notes.push("Prices are the last quote before kickoff.");
    notes.push("One bet per player-market.");
    if (rangesIncludeZero(rows)) {
      notes.push("Every 95% range in this table includes zero.");
    }
    var ref = baselineNote(extracted.oos);
    if (ref) notes.push(ref);

    var html = groupsTable(rows) +
      '<p class="panel-note">' + P.escapeHtml(notes.join(" ")) + "</p>" +
      pvmTable(extracted.root.projection_vs_market || extracted.oos.projection_vs_market);

    if (empty) empty.hidden = true;
    content.hidden = false;
    content.innerHTML = html;
    if (panel) panel.hidden = false;
  }

  function showEmpty() {
    var empty = document.getElementById("kalshi-backtest-empty");
    var content = document.getElementById("kalshi-backtest-content");
    if (empty) empty.hidden = false;
    if (content) {
      content.hidden = true;
      content.innerHTML = "";
    }
  }

  function loadNext(i) {
    if (i >= URLS.length) {
      showEmpty();
      return;
    }
    P.fetchJson(URLS[i]).then(render).catch(function () {
      loadNext(i + 1);
    });
  }

  function start() {
    if (!document.getElementById("kalshi-backtest-content")) return;
    loadNext(0);
  }

  global.PropsKalshiBacktest = { render: render, extractOos: extractOos, groupRows: groupRows };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
