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
    var intro = $("winner-accuracy-intro");
    if (intro) intro.textContent = data.intro || "";
    var note = $("winner-accuracy-note");
    if (note) note.textContent = data.note || "";
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

  function initGraded() {
    P.fetchJson("data/graded_picks.json")
      .then(function (raw) {
        var payload = raw;
        var picks = [];
        if (Array.isArray(raw)) {
          payload = { sample: false, picks: raw };
          picks = raw;
        } else {
          picks = (raw && (raw.picks || raw.rows || raw.data)) || [];
        }
        if (!Array.isArray(picks) || !picks.length) {
          $("graded-content").hidden = true;
          $("graded-banner").hidden = true;
          $("graded-empty").hidden = false;
          $("graded-empty").textContent = "No graded picks yet.";
          return;
        }
        var rows = picks.map(normalizePick);
        gradedState.rows = rows;
        $("graded-empty").hidden = true;
        $("graded-content").hidden = false;
        var banner = $("graded-banner");
        if (payload.sample === true) {
          banner.hidden = false;
          banner.className = "banner sample";
          banner.innerHTML = "<strong>Sample data, model outputs not published yet.</strong> These graded picks are placeholders — not real results.";
        } else {
          banner.hidden = true;
          banner.textContent = "";
        }
        populateGradedFilters(rows);
        renderBuckets(rows);
        bindGraded();
        renderGraded();
      })
      .catch(function (err) {
        $("graded-content").hidden = true;
        $("graded-banner").hidden = true;
        $("graded-empty").hidden = false;
        if (err && err.status === 404) {
          $("graded-empty").textContent = "No graded picks yet.";
        } else {
          $("graded-empty").className = "banner err";
          $("graded-empty").textContent = "Could not load data/graded_picks.json.";
        }
      });
  }

  function start() {
    init();
    initGraded();
    initWinnerAccuracy();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
