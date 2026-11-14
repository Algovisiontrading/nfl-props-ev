/* Track record / calibration page. */
(function () {
  "use strict";
  var P = window.PropsEV;

  function $(id) { return document.getElementById(id); }

  function numPick(obj, keys) {
    return P.num(P.pick(obj, keys));
  }

  function normalizeOverall(raw) {
    raw = raw || {};
    return {
      log_loss: numPick(raw, ["log_loss", "logloss"]),
      brier: numPick(raw, ["brier", "brier_score"]),
      n: numPick(raw, ["n", "sample_size"]),
      roi_pct: numPick(raw, ["roi_pct", "roi"]),
      clv_pct: numPick(raw, ["clv_pct", "clv"]),
      crps: numPick(raw, ["crps"]),
    };
  }

  function normalizeGroup(row) {
    row = row || {};
    return {
      market: P.canonicalMarket(P.pick(row, ["market"]) || ""),
      season: P.pick(row, ["season"]),
      split: P.pick(row, ["split"]),
      log_loss: numPick(row, ["log_loss", "logloss"]),
      brier: numPick(row, ["brier", "brier_score"]),
      n: numPick(row, ["n", "sample_size"]),
      roi_pct: numPick(row, ["roi_pct", "roi"]),
      clv_pct: numPick(row, ["clv_pct", "clv"]),
      crps: numPick(row, ["crps"]),
      passed: row.passed != null ? row.passed : row.model_passed,
    };
  }

  function normalizeBin(b) {
    b = b || {};
    var lo = numPick(b, ["bin_lo", "lo", "pred_lo", "min"]);
    var hi = numPick(b, ["bin_hi", "hi", "pred_hi", "max"]);
    var predicted = numPick(b, ["predicted", "pred", "mean_predicted", "avg_pred"]);
    if (predicted == null && lo != null && hi != null) predicted = (lo + hi) / 2;
    return {
      bin: P.pick(b, ["bin", "label"]) || (lo != null && hi != null ? lo.toFixed(2) + "–" + hi.toFixed(2) : ""),
      bin_lo: lo,
      bin_hi: hi,
      predicted: predicted,
      actual: numPick(b, ["actual", "observed", "mean_actual", "hit_rate"]),
      n: numPick(b, ["n", "sample_size"]),
      market: P.canonicalMarket(P.pick(b, ["market"]) || ""),
    };
  }

  function fmtScore(v, d) {
    return Number.isFinite(v) ? v.toFixed(d == null ? 3 : d) : "—";
  }

  function showMeta(payload) {
    var bits = [];
    var ts = payload.generated_at || payload.updated_at;
    if (ts) bits.push("Last updated <strong>" + P.escapeHtml(P.formatET(ts)) + "</strong>");
    var seasons = [];
    if (payload.train_seasons) seasons.push("train " + [].concat(payload.train_seasons).join(", "));
    if (payload.validation_seasons) seasons.push("validate " + [].concat(payload.validation_seasons).join(", "));
    if (payload.test_seasons) seasons.push("test " + [].concat(payload.test_seasons).join(", "));
    if (seasons.length) bits.push(P.escapeHtml(seasons.join(" · ")));
    $("page-meta").innerHTML = bits.join('<span class="muted"> · </span>');

    var banner = $("sample-banner");
    if (payload.sample) {
      banner.hidden = false;
      banner.className = "banner sample";
      banner.innerHTML = "<strong>Sample data, model outputs not published yet.</strong> These backtest figures are placeholders — not real calibration, ROI, or CLV results.";
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  function renderMetrics(o) {
    var items = [
      { label: "Log loss", value: fmtScore(o.log_loss), hint: "Lower is better" },
      { label: "Brier score", value: fmtScore(o.brier), hint: "Lower is better" },
      { label: "Sample size", value: Number.isFinite(o.n) ? P.formatInt(o.n) : "—", hint: "Labeled plays" },
      { label: "Hypothetical ROI", value: P.formatSignedPct(o.roi_pct), hint: "Not live betting results", cls: P.evClass(o.roi_pct) },
      { label: "CLV", value: P.formatSignedPct(o.clv_pct), hint: "Closing line value", cls: P.evClass(o.clv_pct) },
    ];
    $("metrics").innerHTML = items.map(function (it) {
      return '<div class="metric"><div class="label">' + it.label + '</div><div class="value ' + (it.cls || "") + '">' + it.value + '</div><div class="hint">' + it.hint + "</div></div>";
    }).join("");
  }

  function renderCalibration(bins) {
    var wrap = $("calibration-chart");
    var usable = bins.filter(function (b) {
      return Number.isFinite(b.predicted) && Number.isFinite(b.actual);
    });
    if (!usable.length) {
      wrap.innerHTML = '<p class="muted">No calibration bins in this file.</p>';
      return;
    }

    var W = 720, H = 420;
    var padL = 56, padR = 24, padT = 20, padB = 52;
    var iW = W - padL - padR, iH = H - padT - padB;
    var maxN = 1;
    usable.forEach(function (b) { if (b.n > maxN) maxN = b.n; });

    function x(v) { return padL + v * iW; }
    function y(v) { return padT + (1 - v) * iH; }
    function r(n) { return 5 + 10 * Math.sqrt((n || 0) / maxN); }

    var ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
    var grid = ticks.map(function (t) {
      return '<line x1="' + x(0) + '" y1="' + y(t) + '" x2="' + x(1) + '" y2="' + y(t) + '" stroke="#2a3140" stroke-width="1"/>' +
        '<line x1="' + x(t) + '" y1="' + y(0) + '" x2="' + x(t) + '" y2="' + y(1) + '" stroke="#2a3140" stroke-width="1"/>' +
        '<text x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" fill="#8b93a3" font-size="11" font-family="ui-sans-serif, system-ui, sans-serif">' + t.toFixed(1) + "</text>" +
        '<text x="' + x(t) + '" y="' + (H - padB + 20) + '" text-anchor="middle" fill="#8b93a3" font-size="11" font-family="ui-sans-serif, system-ui, sans-serif">' + t.toFixed(1) + "</text>";
    }).join("");

    var diagonal = '<line x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(1) + '" y2="' + y(1) + '" stroke="#6a7384" stroke-dasharray="4 4" stroke-width="1.5"/>';

    var pts = usable.map(function (b) {
      var title = P.escapeHtml(
        (b.bin || "") + " pred " + b.predicted.toFixed(3) + " vs actual " + b.actual.toFixed(3) + (b.n != null ? " (n=" + b.n + ")" : "")
      );
      return '<circle cx="' + x(b.predicted) + '" cy="' + y(b.actual) + '" r="' + r(b.n) + '" fill="rgba(62,207,142,0.85)" stroke="#0c0e12" stroke-width="1"><title>' + title + "</title></circle>";
    }).join("");

    var svg =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Calibration reliability diagram, predicted probability versus actual frequency">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#14181f" rx="8"/>' +
        grid + diagonal + pts +
        '<text x="' + (padL + iW / 2) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#e9eef6" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif">Predicted probability</text>' +
        '<text x="16" y="' + (padT + iH / 2) + '" text-anchor="middle" fill="#e9eef6" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" transform="rotate(-90 16 ' + (padT + iH / 2) + ')">Actual frequency</text>' +
      "</svg>" +
      '<p class="chart-caption">Reliability diagram: points on the dashed diagonal are perfectly calibrated. Point size scales with sample size.</p>';

    wrap.innerHTML = svg;

    var tbody = $("cal-tbody");
    tbody.innerHTML = usable.map(function (b) {
      var gap = Number.isFinite(b.predicted) && Number.isFinite(b.actual) ? (b.actual - b.predicted) * 100 : null;
      return "<tr>" +
        "<td>" + P.escapeHtml(b.bin || "—") + "</td>" +
        '<td class="num">' + fmtScore(b.predicted) + "</td>" +
        '<td class="num">' + fmtScore(b.actual) + "</td>" +
        '<td class="num ' + P.edgeClass(gap) + '">' + (gap == null ? "—" : P.formatSignedPct(gap, 1)) + "</td>" +
        '<td class="num">' + (b.n != null ? P.formatInt(b.n) : "—") + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderTable(id, rows, kind) {
    var tbody = $(id);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">No rows.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var failed = r.passed === false || r.passed === "false" ? " failed" : "";
      var name = kind === "market"
        ? P.escapeHtml(P.marketLabel(r.market) || "—")
        : P.escapeHtml(r.season != null ? String(r.season) : "—");
      var extra = kind === "market"
        ? (r.passed === false ? '<span class="sub">did not pass calibration</span>' : "")
        : (r.split ? '<span class="sub">' + P.escapeHtml(String(r.split)) + "</span>" : "");
      return '<tr class="' + failed.trim() + '">' +
        "<td>" + name + extra + "</td>" +
        '<td class="num">' + fmtScore(r.log_loss) + "</td>" +
        '<td class="num">' + fmtScore(r.brier) + "</td>" +
        '<td class="num ' + P.evClass(r.roi_pct) + '">' + P.formatSignedPct(r.roi_pct) + "</td>" +
        '<td class="num ' + P.evClass(r.clv_pct) + '">' + P.formatSignedPct(r.clv_pct) + "</td>" +
        '<td class="num">' + (r.n != null ? P.formatInt(r.n) : "—") + "</td>" +
        "</tr>";
    }).join("");
  }

  function showEmpty(msg, isSample) {
    $("track-content").hidden = true;
    var banner = $("sample-banner");
    banner.hidden = false;
    banner.className = "banner empty";
    banner.textContent = msg;
  }


  function normalizeModels(raw) {
    if (!raw) return [];
    var list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (typeof raw === "object") {
      list = Object.keys(raw).map(function (k) {
        var v = raw[k] || {};
        if (v.name == null) v = Object.assign({ name: k }, v);
        return v;
      });
    }
    return list.map(function (m) {
      m = m || {};
      var name = m.name != null ? String(m.name) : "";
      var flag = m.uses_market_inputs;
      var usesMarket;
      if (flag === false || flag === "false" || flag === 0) usesMarket = false;
      else if (flag === true || flag === "true" || flag === 1) usesMarket = true;
      else usesMarket = null; // missing — fall back to name suffix
      var noMarketInputs = usesMarket === false || (usesMarket == null && /_stats_only$/i.test(name));
      var family = null;
      var lower = name.toLowerCase();
      if (lower.indexOf("baseline") === 0 || lower.indexOf("baseline_") !== -1 || lower === "baseline") family = "baseline";
      else if (lower === "ml" || lower.indexOf("ml_") === 0) family = "ml";
      var col = null;
      if (usesMarket === false || (usesMarket == null && /_stats_only$/i.test(name))) col = "stats_only";
      else if (usesMarket === true || (usesMarket == null && /_market$/i.test(name))) col = "market";
      return {
        name: name,
        uses_market_inputs: usesMarket,
        noMarketInputs: noMarketInputs,
        family: family,
        col: col,
        overall: normalizeOverall(m.overall || m),
        by_market: (m.by_market || m.markets || []).map(normalizeGroup),
      };
    });
  }

  function prettyFamily(family) {
    if (family === "baseline") return "Baseline";
    if (family === "ml") return "ML";
    return family || "Other";
  }

  function modelTitle(m) {
    var bits = [];
    if (m.family) bits.push(prettyFamily(m.family));
    if (m.col === "stats_only") bits.push("Stats-only");
    else if (m.col === "market") bits.push("With market inputs");
    if (!bits.length) bits.push(m.name || "Unnamed");
    return bits.join(" · ");
  }

  function metricsInline(row) {
    if (!row) return '<div class="compare-cell empty">No result</div>';
    var parts = [
      "<span>Log loss " + fmtScore(row.log_loss) + "</span>",
      "<span>Brier " + fmtScore(row.brier) + "</span>",
      "<span class=\"" + P.evClass(row.roi_pct) + "\">ROI " + P.formatSignedPct(row.roi_pct) + "</span>",
      "<span class=\"" + P.evClass(row.clv_pct) + "\">CLV " + P.formatSignedPct(row.clv_pct) + "</span>",
      "<span>n=" + (row.n != null ? P.formatInt(row.n) : "—") + "</span>",
    ];
    if (row.crps != null && Number.isFinite(row.crps)) {
      parts.push("<span>CRPS " + fmtScore(row.crps, 1) + "</span>");
    }
    if (row.passed === false || row.passed === "false") {
      parts.push('<span class="muted">did not pass</span>');
    }
    return parts.join("");
  }

  function compareCell(model, row) {
    if (!model) return '<td class="compare-cell empty">—</td>';
    var tag = model.noMarketInputs
      ? '<div class="tag">no betting-market inputs</div>'
      : "";
    var body = row
      ? '<div class="metrics-line">' + metricsInline(row) + "</div>"
      : '<div class="compare-cell empty">No result</div>';
    return (
      '<td class="compare-cell">' +
        '<div class="cell-name">' + P.escapeHtml(modelTitle(model)) + "</div>" +
        body +
        tag +
      "</td>"
    );
  }

  function marketRow(models, market) {
    var map = {};
    models.forEach(function (m) {
      var hit = null;
      (m.by_market || []).forEach(function (r) {
        if (r.market === market) hit = r;
      });
      map[m.name] = hit;
    });
    return map;
  }

  function uniqueMarkets(models, fallback) {
    var seen = {};
    var out = [];
    function add(m) {
      if (!m || seen[m]) return;
      seen[m] = true;
      out.push(m);
    }
    (fallback || []).forEach(function (r) { add(r.market); });
    models.forEach(function (mod) {
      (mod.by_market || []).forEach(function (r) { add(r.market); });
    });
    return out;
  }

  function renderModelComparison(models, fallbackByMarket) {
    var panel = $("model-compare-panel");
    var root = $("model-compare");
    var legend = $("compare-legend");
    if (!panel || !root) return;
    if (!models.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    legend.textContent = "Stats-only = no betting-market inputs (spread, implied total, moneyline, and similar). Label is applied when uses_market_inputs is false, or when that flag is missing and the model name ends in _stats_only.";

    var gridModels = models.filter(function (m) {
      return (m.family === "baseline" || m.family === "ml") && (m.col === "stats_only" || m.col === "market");
    });
    var others = models.filter(function (m) { return gridModels.indexOf(m) === -1; });

    function findModel(family, col) {
      for (var i = 0; i < gridModels.length; i++) {
        if (gridModels[i].family === family && gridModels[i].col === col) return gridModels[i];
      }
      return null;
    }

    var html = "";
    // Overall 2×2
    if (gridModels.length) {
      var bS = findModel("baseline", "stats_only");
      var bM = findModel("baseline", "market");
      var mS = findModel("ml", "stats_only");
      var mM = findModel("ml", "market");
      html += '<div class="compare-market"><h3>Overall</h3>';
      html += '<table class="compare-table" aria-label="Overall model comparison">';
      html += "<thead><tr><th class=\"stub\"></th>" +
        "<th>Stats-only <span class=\"muted\">(no betting-market inputs)</span></th>" +
        "<th>With market inputs</th></tr></thead><tbody>";
      html += "<tr><th class=\"stub\" scope=\"row\">Baseline</th>" +
        compareCell(bS, bS && bS.overall) + compareCell(bM, bM && bM.overall) + "</tr>";
      html += "<tr><th class=\"stub\" scope=\"row\">ML</th>" +
        compareCell(mS, mS && mS.overall) + compareCell(mM, mM && mM.overall) + "</tr>";
      html += "</tbody></table></div>";
    }

    var markets = uniqueMarkets(models, fallbackByMarket);
    markets.forEach(function (market) {
      var rows = marketRow(gridModels, market);
      if (!gridModels.length) return;
      var bS = findModel("baseline", "stats_only");
      var bM = findModel("baseline", "market");
      var mS = findModel("ml", "stats_only");
      var mM = findModel("ml", "market");
      html += '<div class="compare-market"><h3>' + P.escapeHtml(P.marketLabel(market)) + "</h3>";
      html += '<table class="compare-table" aria-label="Model comparison for ' + P.escapeHtml(P.marketLabel(market)) + '">';
      html += "<thead><tr><th class=\"stub\"></th>" +
        "<th>Stats-only <span class=\"muted\">(no betting-market inputs)</span></th>" +
        "<th>With market inputs</th></tr></thead><tbody>";
      html += "<tr><th class=\"stub\" scope=\"row\">Baseline</th>" +
        compareCell(bS, bS && rows[bS.name]) + compareCell(bM, bM && rows[bM.name]) + "</tr>";
      html += "<tr><th class=\"stub\" scope=\"row\">ML</th>" +
        compareCell(mS, mS && rows[mS.name]) + compareCell(mM, mM && rows[mM.name]) + "</tr>";
      html += "</tbody></table></div>";
    });

    if (others.length) {
      html += '<div class="other-models"><h3>Other models</h3>';
      html += '<table class="plain" aria-label="Other models"><thead><tr><th>Model</th><th>Market</th><th class="num">Log loss</th><th class="num">Brier</th><th class="num">Hyp. ROI</th><th class="num">CLV</th><th class="num">N</th></tr></thead><tbody>';
      others.forEach(function (m) {
        var tag = m.noMarketInputs ? ' <span class="sub">no betting-market inputs</span>' : "";
        var rows = (m.by_market && m.by_market.length) ? m.by_market : [Object.assign({ market: "overall" }, m.overall)];
        rows.forEach(function (r) {
          html += "<tr><td>" + P.escapeHtml(m.name || "Unnamed") + tag + "</td>" +
            "<td>" + P.escapeHtml(P.marketLabel(r.market || "overall")) + "</td>" +
            '<td class="num">' + fmtScore(r.log_loss) + "</td>" +
            '<td class="num">' + fmtScore(r.brier) + "</td>" +
            '<td class="num ' + P.evClass(r.roi_pct) + '">' + P.formatSignedPct(r.roi_pct) + "</td>" +
            '<td class="num ' + P.evClass(r.clv_pct) + '">' + P.formatSignedPct(r.clv_pct) + "</td>" +
            '<td class="num">' + (r.n != null ? P.formatInt(r.n) : "—") + "</td></tr>";
        });
      });
      html += "</tbody></table></div>";
    }

    root.innerHTML = html;
  }

  function init() {
    P.fetchJson("data/track_record.json")
      .then(function (raw) {
        if (!raw || (raw.sample !== true && !raw.overall && !raw.calibration && !raw.by_market && !Array.isArray(raw))) {
          // still try to render whatever is there
        }
        var payload = raw;
        if (Array.isArray(raw)) payload = { calibration: raw, sample: false };
        showMeta(payload);
        var overall = normalizeOverall(payload.overall || payload.metrics || payload);
        var byMarket = (payload.by_market || payload.markets || []).map(normalizeGroup);
        var bySeason = (payload.by_season || payload.seasons || []).map(normalizeGroup);
        var bins = (payload.calibration || payload.bins || []).map(normalizeBin);
        $("track-content").hidden = false;
        renderMetrics(overall);
        renderCalibration(bins);
        renderTable("by-market-tbody", byMarket, "market");
        renderTable("by-season-tbody", bySeason, "season");
        renderModelComparison(normalizeModels(payload.models || payload.model_comparison), byMarket);
      })
      .catch(function (err) {
        $("page-meta").textContent = "";
        if (err && err.status === 404) {
          showEmpty("Backtest not published yet. When models/track_record.json is available, publish.sh will copy it here.");
        } else {
          var banner = $("sample-banner");
          banner.hidden = false;
          banner.className = "banner err";
          banner.textContent = "Could not load data/track_record.json.";
        }
        $("track-content").hidden = true;
      });
  }


  var GRADED_BUCKETS = [
    { lo: 0.50, hi: 0.55, label: "50–55%" },
    { lo: 0.55, hi: 0.60, label: "55–60%" },
    { lo: 0.60, hi: 0.65, label: "60–65%" },
    { lo: 0.65, hi: 0.70, label: "65–70%" },
    { lo: 0.70, hi: 0.80, label: "70–80%" },
    { lo: 0.80, hi: Infinity, label: "80%+" },
  ];

  var GRADED_COLS = [
    { key: "week_label", label: "Week" },
    { key: "player", label: "Player" },
    { key: "game", label: "Game" },
    { key: "market", label: "Market" },
    { key: "side", label: "Side" },
    { key: "line", label: "Line", num: true },
    { key: "actual", label: "Actual", num: true },
    { key: "model_prob", label: "Model", num: true },
    { key: "edge_pct", label: "Edge", num: true },
    { key: "result", label: "Result" },
    { key: "source", label: "Source" },
    { key: "model_name", label: "Model name" },
  ];

  var gradedState = { rows: [], sortKey: "kickoff", sortDir: "desc", bound: false };

  function parseTs(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function isInvalidSnapshot(row) {
    var snap = parseTs(row.snapshot_at);
    var ko = parseTs(row.kickoff);
    if (!snap) return false; // missing snapshot_at is unverified, not invalid
    if (!ko) return false;
    return snap.getTime() >= ko.getTime();
  }

  function isUnverifiedSnapshot(row) {
    return !row.snapshot_at || !parseTs(row.snapshot_at);
  }

  function normalizePick(raw) {
    raw = raw || {};
    var row = {
      season: P.num(P.pick(raw, ["season"])),
      week: P.num(P.pick(raw, ["week"])),
      game: P.pick(raw, ["game", "matchup"]) || "",
      kickoff: P.pick(raw, ["kickoff"]),
      player: P.pick(raw, ["player", "player_name"]) || "",
      position: P.pick(raw, ["position", "pos"]) || "",
      market: P.canonicalMarket(P.pick(raw, ["market"]) || ""),
      side: String(P.pick(raw, ["side"]) || "").toLowerCase(),
      line: P.num(P.pick(raw, ["line"])),
      odds_american: P.num(P.pick(raw, ["odds_american", "odds"])),
      book: P.pick(raw, ["book"]) || "",
      model_prob: P.num(P.pick(raw, ["model_prob", "prob"])),
      edge_pct: P.num(P.pick(raw, ["edge_pct", "edge"])),
      model_name: P.pick(raw, ["model_name", "model"]) || "",
      snapshot_at: P.pick(raw, ["snapshot_at", "snapshot"]),
      actual: P.num(P.pick(raw, ["actual", "actual_value", "stat"])),
      result: String(P.pick(raw, ["result"]) || "").toLowerCase(),
      source: String(P.pick(raw, ["source"]) || "").toLowerCase(),
      tier: normalizeTier(P.pick(raw, ["tier", "ev_tier", "signal", "recommendation"]) || ""),
      pick_type: (function () {
        var rawType = P.pick(raw, ["pick_type", "type", "bet_type"]);
        if (rawType) return pickTypeLabel(rawType) ? String(rawType) : String(rawType);
        return "prop";
      })(),
      profit_per_100: numPick(raw, ["profit_per_100", "profit", "pnl_per_100", "pnl"]),
      beat_close: (function () {
        var v = P.pick(raw, ["beat_close", "beat_closing_line", "clv_flag", "beat_cl", "clv_positive"]);
        var f = flag01(v);
        if (f != null) return f;
        var clv = numPick(raw, ["clv", "clv_pct", "closing_line_value"]);
        if (clv == null) return null;
        return clv > 0;
      })(),
    };
    row.invalid = isInvalidSnapshot(row);
    row.unverified = !row.invalid && isUnverifiedSnapshot(row);
    row.week_label = (row.season != null ? String(row.season) + " " : "") + (row.week != null ? "W" + String(row.week) : "");
    row.week_key = (row.season != null ? String(row.season) : "") + "|" + (row.week != null ? String(row.week) : "");
    return row;
  }

  function inBucket(p, b) {
    if (!Number.isFinite(p.model_prob)) return false;
    if (b.hi === Infinity) return p.model_prob >= b.lo;
    return p.model_prob >= b.lo && p.model_prob < b.hi;
  }

  function renderBuckets(rows) {
    var usable = rows.filter(function (r) {
      return !r.invalid && r.result !== "push" && r.result !== "void";
    });
    $("graded-buckets-tbody").innerHTML = GRADED_BUCKETS.map(function (b) {
      var set = usable.filter(function (r) { return inBucket(r, b); });
      var n = set.length;
      var hits = set.filter(function (r) { return r.result === "hit"; }).length;
      var rate = n ? hits / n : null;
      var avg = n ? set.reduce(function (s, r) { return s + r.model_prob; }, 0) / n : null;
      var gap = rate != null && avg != null ? (rate - avg) * 100 : null;
      return "<tr>" +
        "<td>" + P.escapeHtml(b.label) + "</td>" +
        '<td class="num">' + n + "</td>" +
        '<td class="num">' + hits + "</td>" +
        '<td class="num">' + (rate == null ? "—" : P.formatPct(rate * 100)) + "</td>" +
        '<td class="num">' + (avg == null ? "—" : P.formatProb(avg)) + "</td>" +
        '<td class="num ' + P.edgeClass(gap) + '">' + (gap == null ? "—" : P.formatSignedPct(gap)) + "</td>" +
        "</tr>";
    }).join("");
  }

  function fillGradedSelect(sel, values, placeholder, labelFn) {
    var current = sel.value;
    sel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.value != null ? v.value : v;
      o.textContent = labelFn ? labelFn(v) : (v.label != null ? v.label : v);
      sel.appendChild(o);
    });
    var keys = values.map(function (v) { return v.value != null ? v.value : v; });
    if (current && keys.indexOf(current) !== -1) sel.value = current;
  }

  function populateGradedFilters(rows) {
    var weeks = [];
    var seenW = {};
    rows.forEach(function (r) {
      if (!r.week_key || seenW[r.week_key]) return;
      seenW[r.week_key] = true;
      weeks.push({ value: r.week_key, label: r.week_label || r.week_key, season: r.season, week: r.week });
    });
    weeks.sort(function (a, b) {
      if (a.season !== b.season) return (b.season || 0) - (a.season || 0);
      return (b.week || 0) - (a.week || 0);
    });
    fillGradedSelect($("graded-week"), weeks, "All weeks");

    var markets = [];
    var seenM = {};
    rows.forEach(function (r) {
      if (!r.market || seenM[r.market]) return;
      seenM[r.market] = true;
      markets.push(r.market);
    });
    markets.sort();
    fillGradedSelect($("graded-market"), markets, "All markets", P.marketLabel);

    var results = ["hit", "miss", "push", "void"];
    fillGradedSelect($("graded-result"), results, "All results");

    var sources = [];
    var seenS = {};
    rows.forEach(function (r) {
      if (!r.source || seenS[r.source]) return;
      seenS[r.source] = true;
      sources.push(r.source);
    });
    sources.sort();
    fillGradedSelect($("graded-source"), sources, "All sources");
  }

  function filterGraded(rows) {
    var week = $("graded-week").value;
    var market = $("graded-market").value;
    var result = $("graded-result").value;
    var source = $("graded-source").value;
    return rows.filter(function (r) {
      if (week && r.week_key !== week) return false;
      if (market && r.market !== market) return false;
      if (result && r.result !== result) return false;
      if (source && r.source !== source) return false;
      return true;
    });
  }

  function sortGraded(rows) {
    var key = gradedState.sortKey;
    var dir = gradedState.sortDir === "asc" ? 1 : -1;
    var numeric = ["line", "actual", "model_prob", "edge_pct", "week", "season", "odds_american"];
    var copy = rows.slice();
    copy.sort(function (a, b) {
      var va = a[key];
      var vb = b[key];
      if (key === "kickoff" || key === "snapshot_at") {
        va = parseTs(va);
        vb = parseTs(vb);
        if (!va && !vb) return 0;
        if (!va) return 1;
        if (!vb) return -1;
        return (va.getTime() - vb.getTime()) * dir;
      }
      var na = va == null || va === "";
      var nb = vb == null || vb === "";
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      if (numeric.indexOf(key) !== -1) return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" }) * dir;
    });
    return copy;
  }

  function resultBadge(row) {
    var res = row.result || "—";
    var cls = "badge " + (["hit", "miss", "push", "void"].indexOf(res) >= 0 ? res : "");
    var html = '<span class="' + cls + '">' + P.escapeHtml(res) + "</span>";
    if (row.invalid) html += ' <span class="badge invalid">invalid snapshot</span>';
    if (row.unverified) html += ' <span class="badge unverified">unverified</span>';
    return html;
  }

  function renderGradedTable(rows) {
    $("graded-thead").innerHTML = "<tr>" + GRADED_COLS.map(function (c) {
      var sort = c.key === gradedState.sortKey ? ' aria-sort="' + (gradedState.sortDir === "asc" ? "ascending" : "descending") + '"' : "";
      var cls = c.num ? " num" : "";
      return '<th scope="col" data-key="' + c.key + '" class="' + cls + '"' + sort + ">" + c.label + "</th>";
    }).join("") + "</tr>";

    if (!rows.length) {
      $("graded-tbody").innerHTML = '<tr><td colspan="' + GRADED_COLS.length + '" class="muted">No picks match the current filters.</td></tr>';
      return;
    }
    $("graded-tbody").innerHTML = rows.map(function (r) {
      var sideCls = r.side === "over" ? "pill over" : r.side === "under" ? "pill under" : "pill";
      var cells = [
        "<td>" + P.escapeHtml(r.week_label || "—") + "</td>",
        "<td><span class=\"player-cell\">" + P.escapeHtml(r.player || "—") + "</span>" +
          (r.position ? '<span class="sub">' + P.escapeHtml(r.position) + "</span>" : "") + "</td>",
        "<td>" + P.escapeHtml(r.game || "—") +
          (r.kickoff ? '<span class="sub">' + P.escapeHtml(P.formatKickoff(r.kickoff)) + "</span>" : "") + "</td>",
        "<td>" + P.escapeHtml(P.marketLabel(r.market)) + "</td>",
        "<td><span class=\"" + sideCls + "\">" + P.escapeHtml(r.side || "—") + "</span></td>",
        '<td class="num">' + (r.line != null ? r.line : "—") + "</td>",
        '<td class="num">' + (r.actual != null ? r.actual : "—") + "</td>",
        '<td class="num">' + P.formatProb(r.model_prob) + "</td>",
        '<td class="num ' + P.edgeClass(r.edge_pct) + '">' + P.formatSignedPct(r.edge_pct) + "</td>",
        "<td>" + resultBadge(r) + "</td>",
        "<td>" + P.escapeHtml(r.source || "—") + "</td>",
        "<td>" + P.escapeHtml(r.model_name || "—") +
          (r.snapshot_at ? '<span class="sub">snap ' + P.escapeHtml(P.formatET(r.snapshot_at)) + "</span>" : "") + "</td>",
      ];
      return '<tr class="' + (r.invalid ? "invalid" : "") + '">' + cells.join("") + "</tr>";
    }).join("");
  }

  function renderGraded() {
    var visible = sortGraded(filterGraded(gradedState.rows));
    $("graded-count").textContent = visible.length + " of " + gradedState.rows.length + " pick" + (gradedState.rows.length === 1 ? "" : "s");
    renderGradedTable(visible);
  }

  function bindGraded() {
    if (gradedState.bound) return;
    gradedState.bound = true;
    ["graded-week", "graded-market", "graded-result", "graded-source"].forEach(function (id) {
      $(id).addEventListener("change", renderGraded);
    });
    $("graded-thead").addEventListener("click", function (e) {
      var th = e.target.closest("th[data-key]");
      if (!th) return;
      var key = th.getAttribute("data-key");
      if (gradedState.sortKey === key) {
        gradedState.sortDir = gradedState.sortDir === "desc" ? "asc" : "desc";
      } else {
        gradedState.sortKey = key;
        gradedState.sortDir = key === "kickoff" || key === "week_label" || key === "model_prob" || key === "edge_pct" ? "desc" : "asc";
      }
      renderGraded();
    });
  }


  function pct1(x) {
    if (x == null || !Number.isFinite(Number(x))) return "—";
    return (Number(x) * 100).toFixed(1) + "%";
  }

  function comma(n) {
    return Number(n).toLocaleString("en-US");
  }

  function renderWinnerAccuracy(data) {
    var panel = $("winner-accuracy-panel");
    if (!panel) return;
    if (!data || (!data.intro && !(data.calibration && data.calibration.buckets && data.calibration.buckets.length) && !data.note)) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var title = $("winner-accuracy-title");
    if (title) title.textContent = data.title || "Betting odds favorite accuracy";
    var intro = $("winner-accuracy-intro");
    if (intro) intro.textContent = data.intro || "";
    var note = $("winner-accuracy-note");
    if (note) note.textContent = data.note || "";
    var modelBox = $("winner-model-accuracy");
    var modelAcc = data.model_accuracy || null;
    if (modelBox) {
      var modelText = "";
      if (modelAcc) {
        var name = modelAcc.source_label || modelAcc.title || "Our model";
        var body = modelAcc.intro || modelAcc.note || "";
        modelText = body ? (name + ": " + body) : "";
      }
      if (modelText) {
        modelBox.hidden = false;
        modelBox.textContent = modelText;
      } else {
        modelBox.hidden = true;
        modelBox.textContent = "";
      }
    }
    var wrap = $("winner-cal-wrap");
    var tbody = $("winner-cal-tbody");
    var cal = data.calibration || {};
    var buckets = cal.buckets || [];
    if (wrap && tbody && buckets.length) {
      wrap.hidden = false;
      var caption = cal.label ? '<tr><th colspan="4">' + P.escapeHtml(cal.label) + "</th></tr>" : "";
      // put label as a heading above table instead of a header row if present
      tbody.innerHTML = buckets.map(function (b) {
        return "<tr>" +
          "<td>" + P.escapeHtml(b.range || b.label || "") + "</td>" +
          '<td class="num">' + pct1(b.predicted) + "</td>" +
          '<td class="num">' + pct1(b.actual) + "</td>" +
          '<td class="num">' + comma(b.n || 0) + "</td>" +
          "</tr>";
      }).join("");
      if (cal.label) {
        var h = document.createElement("h3");
        h.className = "winner-cal-label";
        h.textContent = cal.label;
        if (!wrap.querySelector(".winner-cal-label")) wrap.insertBefore(h, wrap.firstChild);
        else wrap.querySelector(".winner-cal-label").textContent = cal.label;
      }
    } else if (wrap) {
      wrap.hidden = true;
    }
  }

  function initWinnerAccuracy() {
    P.fetchJson("data/winner_accuracy.json")
      .then(renderWinnerAccuracy)
      .catch(function () {
        if ($("winner-accuracy-panel")) $("winner-accuracy-panel").hidden = true;
      });
  }

  var paperState = {
    picksPayload: null,
    picksRows: null,
    picksReal: false,
    picksError: null,
    picksLoaded: false,
    summaries: null,
    summariesLoaded: false
  };

  function initGraded() {
    P.fetchJson("data/graded_picks.json")
      .then(function (raw) {
        var payload = raw || {};
        var picks = [];
        if (Array.isArray(raw)) {
          payload = { sample: false, picks: raw };
          picks = raw;
        } else {
          picks = (raw && (raw.picks || raw.rows || raw.data)) || [];
        }
        paperState.picksPayload = payload;
        paperState.picksReal = isRealGraded(payload, picks);
        paperState.picksRows = paperState.picksReal && Array.isArray(picks) ? picks.map(normalizePick) : [];
        paperState.picksError = null;
        paperState.picksLoaded = true;
        finishPaperBets();
      })
      .catch(function (err) {
        paperState.picksPayload = null;
        paperState.picksRows = [];
        paperState.picksReal = false;
        paperState.picksError = (err && err.status === 404) ? "missing" : "error";
        paperState.picksLoaded = true;
        finishPaperBets();
      });
  }

  function adaptPaperStat(obj) {
    if (!obj || typeof obj !== "object") return null;
    var bets = numPick(obj, ["bets", "n", "count"]);
    var profit = numPick(obj, ["profit_per_100", "roi_per_100", "pnl_per_100"]);
    if (profit == null) {
      var total = numPick(obj, ["profit_flat100"]);
      if (total != null && bets) profit = total / bets;
    }
    var rate = obj.beat_close_rate != null ? obj.beat_close_rate : (
      obj.beat_closing_line_rate != null ? obj.beat_closing_line_rate : (
        obj.clv_rate != null ? obj.clv_rate : obj.clv_hit_rate
      )
    );
    return {
      bets: bets,
      wins: numPick(obj, ["wins", "hits"]),
      losses: numPick(obj, ["losses", "misses"]),
      pushes: numPick(obj, ["pushes", "push", "pushes_voids"]),
      profit_per_100: profit,
      beat_close_rate: (rate == null ? null : Number(rate)),
      record: obj.record || null
    };
  }

  function statHasGrades(st) {
    if (!st) return false;
    if (Number(st.bets) > 0) return true;
    if (Number(st.wins) > 0 || Number(st.losses) > 0) return true;
    if (st.profit_per_100 != null && Number.isFinite(Number(st.profit_per_100))) return true;
    if (st.beat_close_rate != null && Number.isFinite(Number(st.beat_close_rate))) return true;
    return false;
  }

  function parseSummaryFile(meta, data) {
    meta = meta || {};
    data = data || {};
    var season = data.season != null ? data.season : meta.season;
    var week = data.week != null ? data.week : meta.week;
    var kind = meta.kind || (week != null ? "week" : (season != null ? "season" : "other"));
    var label = meta.label || data.label;
    if (!label) {
      if (kind === "season" && season != null) label = String(season) + " season to date";
      else if (season != null && week != null) label = String(season) + " W" + String(week);
      else label = meta.file || "Summary";
    }
    var props = data.props || {};
    var winners = data.winners || {};
    var tiers = [];
    var markets = [];
    var types = [];
    var overallProps = null;
    var loggedStrongLean = null;

    function take(obj) {
      return adaptPaperStat(obj);
    }

    var tierList = props.by_tier || data.by_tier;
    if (Array.isArray(tierList)) {
      tierList.forEach(function (r) {
        var st = take(r);
        if (st) tiers.push({ label: normalizeTier(r.tier || r.label || r.name) || "—", row: st });
      });
    }
    var marketList = props.by_market || data.by_market;
    if (Array.isArray(marketList)) {
      marketList.forEach(function (r) {
        var st = take(r);
        if (st) {
          var m = r.market || r.label || r.name;
          markets.push({ label: P.marketLabel(m) || String(m || "—"), row: st });
        }
      });
    }

    Object.keys(props).forEach(function (k) {
      if (k === "by_tier" || k === "by_market" || k === "by_pick_type") return;
      var st = take(props[k]);
      if (!st) return;
      if (k === "bets_strong_plus_lean" || k === "summary" || k === "overall" || k === "strong_plus_lean") {
        overallProps = st;
        if (st.pushes != null && !statHasGrades(st)) loggedStrongLean = st.pushes;
      } else if (k === "Strong" || k === "Lean" || k === "Pass" || k === "Check" || /^tier:/i.test(k)) {
        tiers.push({ label: normalizeTier(String(k).replace(/^tier:/i, "")) || k, row: st });
      } else if (k.indexOf("market:") === 0) {
        var m = k.slice(7);
        markets.push({ label: P.marketLabel(m) || m, row: st });
      }
    });
    if (!overallProps && data.summary) overallProps = take(data.summary);

    if (overallProps) types.push({ label: "Props", row: overallProps });
    Object.keys(winners).forEach(function (k) {
      var st = take(winners[k]);
      if (!st) return;
      var lab = pickTypeLabel(k) || k;
      if (k === "betting_favorite" || k === "favorite" || k === "winner_favorite") lab = "Winner: betting favorite";
      if (k === "stats_model" || k === "model" || k === "winner_model") lab = "Winner: our stats model";
      types.push({ label: lab, row: st });
    });
    var typeList = data.by_pick_type || props.by_pick_type;
    if (Array.isArray(typeList)) {
      typeList.forEach(function (r) {
        var st = take(r);
        if (st) types.push({ label: pickTypeLabel(r.pick_type || r.type || r.label) || r.label || "—", row: st });
      });
    }

    var graded = false;
    function mark(st) { if (statHasGrades(st)) graded = true; }
    if (overallProps) mark(overallProps);
    tiers.forEach(function (x) { mark(x.row); });
    markets.forEach(function (x) { mark(x.row); });
    types.forEach(function (x) { mark(x.row); });

    return {
      season: season,
      week: week,
      kind: kind,
      label: label,
      graded: graded,
      overall: overallProps,
      tiers: tiers,
      markets: markets,
      types: types,
      loggedStrongLean: loggedStrongLean,
      data: data
    };
  }

  function renderPaperSummaries(parsedList) {
    var graded = (parsedList || []).filter(function (p) { return p.graded; });
    if (!graded.length) return false;
    var seasonFiles = graded.filter(function (p) { return p.kind === "season"; });
    var weekFiles = graded.filter(function (p) { return p.kind !== "season"; });
    weekFiles.sort(function (a, b) {
      if (a.season !== b.season) return (b.season || 0) - (a.season || 0);
      return (b.week || 0) - (a.week || 0);
    });
    var weekItems = [];
    weekFiles.forEach(function (p) {
      if (p.overall) weekItems.push({ label: p.label, row: p.overall });
    });
    var seasonItems = [];
    seasonFiles.forEach(function (p) {
      if (p.overall) seasonItems.push({ label: p.label, row: p.overall });
    });
    var breakoutSrc = seasonFiles.length ? seasonFiles[0] : (weekFiles.length === 1 ? weekFiles[0] : null);

    var html = "";
    if (seasonItems.length) {
      html += tallyTable("Season to date", "Group", seasonItems, "Paper bets season to date");
    } else if (weekItems.length === 1) {
      html += tallyTable("Season to date", "Group", [{ label: "All paper bets · " + weekItems[0].label, row: weekItems[0].row }], "Paper bets season to date");
    }
    html += tallyTable("By week", "Week", weekItems, "Paper bets by week");
    if (breakoutSrc) {
      html += tallyTable("By tier", "Tier", breakoutSrc.tiers, "Paper bets by tier");
      html += tallyTable("By market", "Market", breakoutSrc.markets, "Paper bets by market");
      html += tallyTable("By pick type", "Pick type", breakoutSrc.types, "Paper bets by pick type");
    } else if (weekItems.length > 1) {
      html += '<p class="panel-note">Tier, market, and pick-type breakouts will appear when a season total file is published.</p>';
    }
    var bad = [];
    graded.forEach(function (p) {
      var integ = p.data && p.data.integrity;
      if (integ && integ.ok === false) bad.push(p.label);
    });
    if (bad.length) {
      html += '<p class="panel-note">Integrity warning on ' + P.escapeHtml(bad.join(", ")) + ".</p>";
    }
    var wrap = $("graded-tally");
    if (!wrap) return false;
    wrap.innerHTML = html;
    wrap.hidden = !html;
    $("graded-empty").hidden = true;
    $("graded-banner").hidden = true;
    return true;
  }

  function loggedButUngradedNote(parsedList) {
    var parts = [];
    (parsedList || []).forEach(function (p) {
      if (p.graded) return;
      if (p.loggedStrongLean) {
        var wk = p.week != null ? "Week " + p.week : p.label;
        parts.push(P.formatInt(p.loggedStrongLean) + " Strong/Lean props are logged for " + wk + ".");
      }
    });
    return parts.join(" ");
  }

  function showPicksTable() {
    var rows = paperState.picksRows || [];
    gradedState.rows = rows;
    $("graded-empty").hidden = true;
    $("graded-banner").hidden = true;
    $("graded-banner").textContent = "";
    if (rows.length) {
      $("graded-content").hidden = false;
      populateGradedFilters(rows);
      renderBuckets(rows);
      bindGraded();
      renderGraded();
    } else {
      $("graded-content").hidden = true;
    }
  }

  function finishPaperBets() {
    if (!paperState.picksLoaded || !paperState.summariesLoaded) return;
    var parsed = paperState.summaries || [];
    if (renderPaperSummaries(parsed)) {
      if (paperState.picksReal && paperState.picksRows && paperState.picksRows.length) showPicksTable();
      else if ($("graded-content")) $("graded-content").hidden = true;
      return;
    }
    if (paperState.picksReal) {
      renderPaperTally(paperState.picksPayload, paperState.picksRows || []);
      showPicksTable();
      return;
    }
    if (paperState.picksError === "error" && !parsed.length) {
      $("graded-content").hidden = true;
      $("graded-banner").hidden = true;
      if ($("graded-tally")) {
        $("graded-tally").hidden = true;
        $("graded-tally").innerHTML = "";
      }
      $("graded-empty").hidden = false;
      $("graded-empty").className = "banner err";
      $("graded-empty").textContent = "Could not load data/graded_picks.json.";
      return;
    }
    showGradedEmpty();
    var extra = loggedButUngradedNote(parsed);
    if (extra) $("graded-empty").textContent = GRADED_EMPTY_TEXT + " " + extra;
  }

  function initPaperBetSummaries() {
    P.fetchJson("data/paper_bets/index.json")
      .then(function (idx) {
        var files = (idx && (idx.files || idx.summaries)) || [];
        if (!files.length) {
          paperState.summaries = [];
          paperState.summariesLoaded = true;
          finishPaperBets();
          return null;
        }
        return Promise.all(files.map(function (f) {
          var name = typeof f === "string" ? f : f.file;
          var meta = typeof f === "string" ? { file: name } : Object.assign({}, f);
          if (!name) return Promise.resolve(null);
          return P.fetchJson("data/paper_bets/" + name).then(function (data) {
            return parseSummaryFile(meta, data);
          }).catch(function () { return null; });
        })).then(function (list) {
          paperState.summaries = list.filter(Boolean);
          paperState.summariesLoaded = true;
          finishPaperBets();
        });
      })
      .catch(function () {
        paperState.summaries = [];
        paperState.summariesLoaded = true;
        finishPaperBets();
      });
  }


  function formatProfit(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    var abs = Math.abs(n).toFixed(2);
    if (n > 0) return "+$" + abs;
    if (n < 0) return "−$" + abs;
    return "$" + abs;
  }

  function formatRecord(row) {
    if (!row) return "—";
    if (row.record != null && String(row.record) !== "") return String(row.record);
    var w = row.wins;
    var l = row.losses;
    var p = row.pushes != null ? row.pushes : row.push;
    if (!Number.isFinite(Number(w)) || !Number.isFinite(Number(l))) return "—";
    var s = String(w) + "–" + String(l);
    if (Number.isFinite(Number(p)) && Number(p) > 0) s += "–" + String(p);
    return s;
  }

  function formatRate01(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (Math.abs(n) <= 1) return P.formatPct(n * 100);
    return P.formatPct(n);
  }

  function profitFromAmerican(result, odds) {
    var res = String(result || "").toLowerCase();
    if (res === "push" || res === "void") return 0;
    if (res === "miss" || res === "loss") return -100;
    if (res === "hit" || res === "win") {
      if (!Number.isFinite(odds) || odds === 0) return null;
      if (odds > 0) return odds;
      return 100 * 100 / Math.abs(odds);
    }
    return null;
  }

  function flag01(v) {
    if (v === true || v === 1 || v === "1") return true;
    if (v === false || v === 0 || v === "0") return false;
    if (v == null || v === "") return null;
    var s = String(v).toLowerCase();
    if (s === "true" || s === "yes" || s === "y" || s === "beat") return true;
    if (s === "false" || s === "no" || s === "n") return false;
    return null;
  }

  var ML_RULE_LABELS = {
    edge_0pt: "Any edge (one side every game)",
    edge_3pt: "Model 3+ points over the vig-free odds",
    edge_5pt: "Model 5+ points over",
    bet_every_favorite: "Bet every favorite (reference)"
  };
  var ML_RULE_ORDER = ["edge_0pt", "edge_3pt", "edge_5pt", "bet_every_favorite"];
  var ML_BLOCK_LABELS = {
    test_2023_2025: "2023–25",
    "2026_through_wk9": "2026 through week 9"
  };

  function mlRuleLabel(key) {
    return ML_RULE_LABELS[key] || String(key).replace(/_/g, " ");
  }

  function mlBlockEntries(block) {
    if (!block || typeof block !== "object") return [];
    var keys = Object.keys(block).filter(function (k) {
      var r = block[k];
      return k !== "games" && r && typeof r === "object" &&
        (r.bets != null || r.wins != null || r.roi_per_100 != null || r.profit_per_100 != null);
    });
    keys.sort(function (a, b) {
      var ia = ML_RULE_ORDER.indexOf(a);
      var ib = ML_RULE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map(function (k) { return { key: k, row: block[k] }; });
  }

  function mlTableBody(entries) {
    return entries.map(function (e) {
      var r = e.row || {};
      var roi = r.roi_per_100 != null ? r.roi_per_100 : r.profit_per_100;
      return "<tr>" +
        "<td>" + P.escapeHtml(mlRuleLabel(e.key)) + "</td>" +
        '<td class="num">' + (r.bets != null ? P.formatInt(r.bets) : "—") + "</td>" +
        "<td>" + P.escapeHtml(formatRecord(r)) + "</td>" +
        '<td class="num ' + P.evClass(Number(roi)) + '">' + formatProfit(roi) + "</td>" +
        "</tr>";
    }).join("");
  }

  function mlSeasonNote(entries) {
    var src = null;
    entries.forEach(function (e) {
      if (e.row && e.row.by_season && typeof e.row.by_season === "object") {
        if (!src || e.key === "edge_0pt") src = e;
      }
    });
    if (!src) return "";
    var years = Object.keys(src.row.by_season).sort();
    if (!years.length) return "";
    var parts = years.map(function (yr) {
      return yr + " " + formatProfit(src.row.by_season[yr]);
    });
    var rule = mlRuleLabel(src.key).replace(/ \(one side every game\)/, "").toLowerCase();
    return "By season (" + rule + "): " + parts.join(", ") + ".";
  }

  function mlModelLostMoney(entries) {
    var model = entries.filter(function (e) { return e.key !== "bet_every_favorite"; });
    if (!model.length) return false;
    return model.every(function (e) {
      var roi = e.row.roi_per_100 != null ? e.row.roi_per_100 : e.row.profit_per_100;
      return Number.isFinite(Number(roi)) && Number(roi) < 0;
    });
  }

  function renderMoneylineBacktest(data) {
    var panel = $("moneyline-backtest-panel");
    if (!panel) return;
    var blocks = data && data.blocks;
    if (!blocks || typeof blocks !== "object") {
      panel.hidden = true;
      return;
    }
    var mainKey = blocks.test_2023_2025 ? "test_2023_2025" : Object.keys(blocks)[0];
    var main = mainKey ? blocks[mainKey] : null;
    var entries = mlBlockEntries(main);
    if (!entries.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var intro = $("moneyline-backtest-intro");
    if (intro) {
      var games = main.games;
      intro.textContent = games != null
        ? ("Replay of " + P.formatInt(games) + " games at closing moneylines.")
        : "";
    }
    $("moneyline-backtest-tbody").innerHTML = mlTableBody(entries);

    var notes = [];
    var stake = data.stake != null ? data.stake : 100;
    notes.push("Flat $" + stake + " paper bets at closing moneylines, vig included" +
      (data.ties_excluded !== false ? ", ties excluded" : "") + ".");
    if (mlModelLostMoney(entries)) {
      notes.push("The stats model lost money, so the winner pick is a stats opinion, not a bet.");
    }
    var seasonNote = mlSeasonNote(entries);
    if (seasonNote) notes.push(seasonNote);
    var dogsRow = null;
    entries.forEach(function (e) {
      if (e.key === "edge_0pt" && e.row && e.row.dogs != null && e.row.bets) dogsRow = e.row;
    });
    if (dogsRow) {
      notes.push(P.formatInt(dogsRow.dogs) + " of " + P.formatInt(dogsRow.bets) + " any-edge bets were underdogs.");
    }
    $("moneyline-backtest-note").textContent = notes.join(" ");

    var extra = $("moneyline-backtest-extra");
    var html = "";
    Object.keys(blocks).forEach(function (bk) {
      if (bk === mainKey) return;
      var block = blocks[bk];
      var ents = mlBlockEntries(block);
      if (!ents.length) return;
      var title = ML_BLOCK_LABELS[bk] || String(bk).replace(/_/g, " ");
      var g = block.games;
      html += '<h3 class="tally-heading">' + P.escapeHtml(title) +
        (g != null ? " (" + P.formatInt(g) + " games)" : "") + "</h3>";
      html += '<div class="table-wrap" style="border:0;background:transparent;">' +
        '<table class="plain" aria-label="' + P.escapeHtml(title) + '">' +
        "<thead><tr><th>Rule</th><th class=\"num\">Bets</th><th>Record</th><th class=\"num\">Profit per $100 bet</th></tr></thead>" +
        "<tbody>" + mlTableBody(ents) + "</tbody></table></div>";
      var ciBits = [];
      ents.forEach(function (e) {
        var ci = e.row && e.row.roi_ci95;
        if (Array.isArray(ci) && ci.length >= 2 && Number.isFinite(Number(ci[0])) && Number.isFinite(Number(ci[1]))) {
          ciBits.push(mlRuleLabel(e.key) + " " + formatProfit(ci[0]) + " to " + formatProfit(ci[1]));
        }
      });
      var caveat = "This is a small sample" + (g != null ? " (" + P.formatInt(g) + " games)" : "") + ".";
      if (ciBits.length) {
        caveat += " The 95% range on profit per $100 is about " + ciBits.join("; ") +
          ", so this stretch does not change the 2023–25 result.";
      }
      html += '<p class="panel-note">' + P.escapeHtml(caveat) + "</p>";
    });
    if (extra) extra.innerHTML = html;
  }

  function initMoneylineBacktest() {
    P.fetchJson("data/moneyline_backtest.json")
      .then(renderMoneylineBacktest)
      .catch(function () {
        if ($("moneyline-backtest-panel")) $("moneyline-backtest-panel").hidden = true;
      });
  }

  var PICK_TYPE_LABELS = {
    prop: "Props",
    props: "Props",
    player_prop: "Props",
    player_props: "Props",
    winner_favorite: "Winner: betting favorite",
    favorite: "Winner: betting favorite",
    betting_favorite: "Winner: betting favorite",
    "winner: betting favorite": "Winner: betting favorite",
    winner_model: "Winner: our stats model",
    model: "Winner: our stats model",
    stats_model: "Winner: our stats model",
    "winner: our stats model": "Winner: our stats model"
  };
  var TIER_ORDER = ["Strong", "Lean", "Pass", "Check"];

  function pickTypeLabel(v) {
    if (v == null || v === "") return "";
    var key = String(v).toLowerCase();
    return PICK_TYPE_LABELS[key] || String(v);
  }

  function normalizeTier(v) {
    if (v == null || v === "") return "";
    var s = String(v);
    var lower = s.toLowerCase();
    if (lower === "strong") return "Strong";
    if (lower === "lean") return "Lean";
    if (lower === "pass") return "Pass";
    if (lower === "check") return "Check";
    return s;
  }

  function normalizeTally(raw) {
    raw = raw || {};
    var profit = numPick(raw, ["profit_per_100", "roi_per_100", "profit", "pnl_per_100", "pnl"]);
    var rate = raw.beat_close_rate != null ? raw.beat_close_rate : (
      raw.beat_closing_line_rate != null ? raw.beat_closing_line_rate : (
        raw.clv_rate != null ? raw.clv_rate : raw.clv_hit_rate
      )
    );
    return {
      bets: numPick(raw, ["bets", "n", "count"]),
      wins: numPick(raw, ["wins", "hits"]),
      losses: numPick(raw, ["losses", "misses"]),
      pushes: numPick(raw, ["pushes", "push"]),
      profit_per_100: profit,
      beat_close_rate: (rate == null ? null : Number(rate)),
      record: raw.record || null,
      label: raw.label || raw.name || raw.week_label || ""
    };
  }

  function aggregatePicks(rows) {
    var bets = 0, wins = 0, losses = 0, pushes = 0;
    var profitSum = 0, profitN = 0, beatN = 0, beatYes = 0;
    (rows || []).forEach(function (r) {
      var res = String(r.result || "").toLowerCase();
      if (res === "void" || !res) return;
      if (res === "push") pushes++;
      else if (res === "hit" || res === "win") wins++;
      else if (res === "miss" || res === "loss") losses++;
      else return;
      bets++;
      var pr = r.profit_per_100;
      if (!Number.isFinite(pr)) pr = profitFromAmerican(res, r.odds_american);
      if (Number.isFinite(pr)) {
        profitSum += pr;
        profitN++;
      }
      if (r.beat_close != null) {
        beatN++;
        if (r.beat_close) beatYes++;
      }
    });
    return {
      bets: bets,
      wins: wins,
      losses: losses,
      pushes: pushes,
      profit_per_100: profitN ? profitSum / profitN : null,
      beat_close_rate: beatN ? beatYes / beatN : null,
      record: formatRecord({ wins: wins, losses: losses, pushes: pushes })
    };
  }

  function tallyTable(title, firstHeader, items, aria) {
    if (!items || !items.length) return "";
    var body = items.map(function (it) {
      var row = it.row || it;
      return "<tr>" +
        "<td>" + P.escapeHtml(it.label || row.label || "—") + "</td>" +
        '<td class="num">' + (row.bets != null ? P.formatInt(row.bets) : "—") + "</td>" +
        "<td>" + P.escapeHtml(formatRecord(row)) + "</td>" +
        '<td class="num ' + P.evClass(Number(row.profit_per_100)) + '">' + formatProfit(row.profit_per_100) + "</td>" +
        '<td class="num">' + formatRate01(row.beat_close_rate) + "</td>" +
        "</tr>";
    }).join("");
    return '<h3 class="tally-heading">' + P.escapeHtml(title) + "</h3>" +
      '<div class="table-wrap" style="border:0;background:transparent;">' +
      '<table class="plain" aria-label="' + P.escapeHtml(aria || title) + '">' +
      "<thead><tr><th>" + P.escapeHtml(firstHeader) + "</th>" +
      '<th class="num">Bets</th><th>Record</th>' +
      '<th class="num">Profit per $100</th>' +
      '<th class="num">Beat the closing line</th></tr></thead>' +
      "<tbody>" + body + "</tbody></table></div>";
  }

  function listFromRaw(raw, labelFn) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map(function (r) {
        var row = normalizeTally(r);
        return { label: labelFn ? labelFn(r, row) : (row.label || "—"), row: row };
      });
    }
    if (typeof raw === "object") {
      return Object.keys(raw).map(function (k) {
        var v = raw[k];
        var rec = v && typeof v === "object" ? v : { profit_per_100: v };
        var row = normalizeTally(rec);
        return { label: labelFn ? labelFn(Object.assign({ key: k }, rec), row) : (row.label || k), row: row };
      });
    }
    return [];
  }

  function weekLabelFrom(r) {
    if (r.week_label) return r.week_label;
    if (r.label) return r.label;
    var season = r.season;
    var week = r.week;
    if (season != null && week != null) return String(season) + " W" + String(week);
    if (week != null) return "Week " + String(week);
    if (r.key) return String(r.key);
    return "—";
  }

  function groupPicks(rows, keyFn, labelFn, sortFn) {
    var groups = {};
    var order = [];
    rows.forEach(function (r) {
      var key = keyFn(r);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(r);
    });
    var items = order.map(function (k) {
      var set = groups[k];
      return { label: labelFn(k, set), row: aggregatePicks(set), _key: k, _rows: set };
    });
    if (sortFn) items.sort(sortFn);
    return items;
  }

  function renderPaperTally(payload, rows) {
    var wrap = $("graded-tally");
    if (!wrap) return;
    payload = payload || {};
    rows = rows || [];

    var overall = payload.summary ? normalizeTally(payload.summary) : (rows.length ? aggregatePicks(rows) : null);
    var byWeek = listFromRaw(payload.by_week || payload.weeks, function (r, row) { return weekLabelFrom(r); });
    var byTier = listFromRaw(payload.by_tier || payload.tiers, function (r, row) {
      return normalizeTier(r.tier || r.label || r.key || row.label);
    });
    var byMarket = listFromRaw(payload.by_market || payload.markets, function (r, row) {
      var m = r.market || r.label || r.key || row.label;
      return P.marketLabel(m) || m || "—";
    });
    var byType = listFromRaw(payload.by_pick_type || payload.pick_types || payload.by_type, function (r, row) {
      return pickTypeLabel(r.pick_type || r.type || r.label || r.key || row.label) || "—";
    });

    if (!byWeek.length && rows.length) {
      byWeek = groupPicks(rows, function (r) { return r.week_key || r.week_label || ""; }, function (k, set) {
        return set[0].week_label || k;
      }, function (a, b) {
        var sa = (a._rows[0] && a._rows[0].season) || 0;
        var sb = (b._rows[0] && b._rows[0].season) || 0;
        if (sa !== sb) return sb - sa;
        return ((b._rows[0] && b._rows[0].week) || 0) - ((a._rows[0] && a._rows[0].week) || 0);
      });
    }
    if (!byTier.length && rows.some(function (r) { return r.tier; })) {
      byTier = groupPicks(rows, function (r) { return r.tier || ""; }, function (k) { return k; }, function (a, b) {
        var ia = TIER_ORDER.indexOf(a._key);
        var ib = TIER_ORDER.indexOf(b._key);
        if (ia === -1 && ib === -1) return a._key.localeCompare(b._key);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    if (!byMarket.length && rows.some(function (r) { return r.market; })) {
      byMarket = groupPicks(rows, function (r) { return r.market || ""; }, function (k) {
        return P.marketLabel(k) || k;
      }, function (a, b) { return a.label.localeCompare(b.label); });
    }
    if (!byType.length && rows.some(function (r) { return r.pick_type; })) {
      byType = groupPicks(rows, function (r) { return r.pick_type || ""; }, function (k) {
        return pickTypeLabel(k) || k;
      });
    }

    if (!overall || (overall.bets == null && overall.wins == null && overall.profit_per_100 == null && !rows.length && !byWeek.length && !byTier.length && !byMarket.length && !byType.length)) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }

    var html = "";
    if (overall && (overall.bets != null || overall.wins != null || overall.profit_per_100 != null || overall.record)) {
      html += tallyTable("Season to date", "Group", [{ label: "All paper bets", row: overall }], "Paper bets season to date");
    }
    html += tallyTable("By week", "Week", byWeek, "Paper bets by week");
    html += tallyTable("By tier", "Tier", byTier, "Paper bets by tier");
    html += tallyTable("By market", "Market", byMarket, "Paper bets by market");
    html += tallyTable("By pick type", "Pick type", byType, "Paper bets by pick type");
    if (!byTier.length || !byType.length || overall.beat_close_rate == null) {
      var missing = [];
      if (!byTier.length) missing.push("tier (Strong / Lean / Pass)");
      if (!byType.length) missing.push("pick type");
      if (overall && overall.beat_close_rate == null) missing.push("beat-the-closing-line");
      if (missing.length) {
        html += '<p class="panel-note">Breakouts for ' + P.escapeHtml(missing.join(", ")) +
          " will appear when those fields are in the graded file.</p>";
      }
    }
    wrap.innerHTML = html;
    wrap.hidden = !html;
  }

  var GRADED_EMPTY_TEXT = "First graded week: Week 10, results Tuesday Nov 17.";

  function showGradedEmpty(realEmpty) {
    $("graded-content").hidden = true;
    $("graded-banner").hidden = true;
    if ($("graded-tally")) {
      $("graded-tally").hidden = true;
      $("graded-tally").innerHTML = "";
    }
    $("graded-empty").hidden = false;
    $("graded-empty").className = "banner empty";
    $("graded-empty").textContent = GRADED_EMPTY_TEXT;
  }

  function isRealGraded(payload, picks) {
    if (!payload || payload.sample === true) return false;
    if (Array.isArray(picks) && picks.length) return true;
    if (payload.summary) return true;
    if (payload.by_week || payload.by_tier || payload.by_market || payload.by_pick_type) return true;
    return false;
  }

  function renderGenericResultTable(title, rows, labelKey) {
    if (!rows || !rows.length) return "";
    var items = rows.map(function (r) {
      return {
        label: r[labelKey] || r.label || r.name || r.rule || r.market || "—",
        row: normalizeTally(r)
      };
    });
    return tallyTable(title, "Group", items, title);
  }

  function renderKalshiBacktest(data) {
    var empty = $("kalshi-backtest-empty");
    var content = $("kalshi-backtest-content");
    if (!empty || !content) return;
    if (!data || data.sample === true) {
      empty.hidden = false;
      content.hidden = true;
      content.innerHTML = "";
      return;
    }
    var html = "";
    if (data.note || data.intro) {
      html += '<p class="panel-intro">' + P.escapeHtml(data.note || data.intro) + "</p>";
    }
    if (data.summary) {
      html += tallyTable("Summary", "Group", [{ label: data.summary.label || "Kalshi weeks 1–9", row: normalizeTally(data.summary) }], "Kalshi backtest summary");
    }
    var blocks = data.blocks;
    if (blocks && typeof blocks === "object") {
      Object.keys(blocks).forEach(function (bk) {
        var ents = mlBlockEntries(blocks[bk]);
        if (!ents.length) return;
        var title = blocks[bk].title || blocks[bk].label || ML_BLOCK_LABELS[bk] || String(bk).replace(/_/g, " ");
        html += '<h3 class="tally-heading">' + P.escapeHtml(title) + "</h3>";
        html += '<div class="table-wrap" style="border:0;background:transparent;"><table class="plain" aria-label="' +
          P.escapeHtml(title) + '"><thead><tr><th>Rule</th><th class="num">Bets</th><th>Record</th><th class="num">Profit per $100 bet</th></tr></thead><tbody>' +
          mlTableBody(ents) + "</tbody></table></div>";
      });
    }
    html += renderGenericResultTable("By market", data.by_market || data.markets, "market");
    html += renderGenericResultTable("By tier", data.by_tier || data.tiers, "tier");
    html += renderGenericResultTable("Results", data.rows || data.rules || data.results, "label");
    if (data.caveat) {
      html += '<p class="panel-note">' + P.escapeHtml(data.caveat) + "</p>";
    }
    if (!html) {
      empty.hidden = false;
      content.hidden = true;
      content.innerHTML = "";
      return;
    }
    empty.hidden = true;
    content.hidden = false;
    content.innerHTML = html;
  }

  function initKalshiBacktest() {
    P.fetchJson("data/kalshi_props_backtest.json")
      .then(renderKalshiBacktest)
      .catch(function () {
        if ($("kalshi-backtest-empty")) $("kalshi-backtest-empty").hidden = false;
        if ($("kalshi-backtest-content")) {
          $("kalshi-backtest-content").hidden = true;
          $("kalshi-backtest-content").innerHTML = "";
        }
      });
  }


  var PROJ_ACC_NOTE = "Tested on games the model never saw (2025 + 2026 weeks 1–9). Trained on 2018–23. The benchmark is each player's last-8-game average.";

  function formatAccNum(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(Number(n.toFixed(2)));
  }

  function normalizeAccRow(r) {
    r = r || {};
    var market = r.market || r.stat || r.name || r.label || "";
    var better = r.better_pct != null ? r.better_pct : (
      r.better_by != null ? r.better_by : r.better
    );
    return {
      stat: P.marketLabel(market) || market || "—",
      games: r.n != null ? r.n : (r.games != null ? r.games : r.count),
      avg_actual: r.avg_actual != null ? r.avg_actual : r.average_actual,
      miss_model: r.miss_model != null ? r.miss_model : (
        r.our_avg_miss != null ? r.our_avg_miss : r.model_miss
      ),
      miss_recent8: r.miss_recent8 != null ? r.miss_recent8 : (
        r.last8_avg_miss != null ? r.last8_avg_miss : r.miss_last8
      ),
      better_pct: better
    };
  }

  function betterCell(v) {
    if (v == null || !Number.isFinite(Number(v))) return { html: "—", cls: "muted" };
    var n = Number(v);
    var pct = (Math.abs(n) < 1 && n !== 0) ? n * 100 : n;
    return { html: P.formatSignedPct(pct, 1), cls: P.evClass(pct) };
  }

  function renderProjectionAccuracy(rows, note) {
    var panel = $("projection-accuracy-panel");
    if (!panel) return;
    if (!rows || !rows.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    $("projection-accuracy-tbody").innerHTML = rows.map(function (raw) {
      var r = normalizeAccRow(raw);
      var b = betterCell(r.better_pct);
      return "<tr>" +
        "<td>" + P.escapeHtml(r.stat) + "</td>" +
        '<td class="num">' + (r.games != null ? P.formatInt(r.games) : "—") + "</td>" +
        '<td class="num">' + formatAccNum(r.avg_actual) + "</td>" +
        '<td class="num">' + formatAccNum(r.miss_model) + "</td>" +
        '<td class="num">' + formatAccNum(r.miss_recent8) + "</td>" +
        '<td class="num ' + b.cls + '">' + b.html + "</td>" +
        "</tr>";
    }).join("");
    var noteEl = $("projection-accuracy-note");
    if (noteEl) noteEl.textContent = note || PROJ_ACC_NOTE;
  }

  function parseCsv(text) {
    var lines = String(text || "").trim().split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
      var cols = line.split(",");
      var o = {};
      headers.forEach(function (h, i) {
        var v = (cols[i] != null ? cols[i] : "").trim();
        if (v === "") o[h] = null;
        else if (!isNaN(Number(v))) o[h] = Number(v);
        else o[h] = v;
      });
      return o;
    });
  }

  function rowsFromAccPayload(data) {
    if (!data) return { rows: [], note: null };
    if (Array.isArray(data)) return { rows: data, note: null };
    var rows = data.rows || data.by_market || data.markets || data.stats || data.data || [];
    var note = data.note || data.intro || data.caption || null;
    return { rows: rows, note: note };
  }

  function loadAccCsv() {
    return fetch("data/projection_accuracy.csv", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) {
          var err = new Error("csv_" + res.status);
          err.status = res.status;
          throw err;
        }
        return res.text();
      })
      .then(function (text) {
        renderProjectionAccuracy(parseCsv(text), null);
      })
      .catch(function () {
        if ($("projection-accuracy-panel")) $("projection-accuracy-panel").hidden = true;
      });
  }

  function initProjectionAccuracy() {
    P.fetchJson("data/projection_accuracy.json")
      .then(function (data) {
        var got = rowsFromAccPayload(data);
        if (got.rows && got.rows.length) {
          renderProjectionAccuracy(got.rows, got.note);
          return null;
        }
        return loadAccCsv();
      })
      .catch(function () { return loadAccCsv(); });
  }

  function start() {
    init();
    initGraded();
    initPaperBetSummaries();
    initWinnerAccuracy();
    initMoneylineBacktest();
    initKalshiBacktest();
    initProjectionAccuracy();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
