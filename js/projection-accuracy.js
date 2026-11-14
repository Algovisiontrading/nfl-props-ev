/* Shared Projection accuracy table for Track Record and Projections pages.
   Source: data/projection_accuracy.json only (walk-forward 2023–25). */
(function () {
  "use strict";
  var P = window.PropsEV;
  if (!P) return;

  function $(id) { return document.getElementById(id); }

  function firstNum(obj, keys) {
    if (!obj) return null;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "" && Number.isFinite(Number(obj[keys[i]]))) {
        return Number(obj[keys[i]]);
      }
    }
    return null;
  }

  function formatAccNum(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    if (Math.abs(n) >= 10) return String(Number(n.toFixed(1)));
    return String(Number(n.toFixed(2)));
  }

  function formatInside(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    var pct = (Math.abs(n) <= 1) ? n * 100 : n;
    return P.formatPct(pct, 1);
  }

  function marketRows(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.by_market || data.rows || data.markets || data.stats || data.data || [];
  }

  function normalize(r) {
    r = r || {};
    var market = r.market || r.stat || r.name || r.label || "";
    return {
      market: market,
      stat: P.marketLabel(market) || market || "—",
      games: firstNum(r, ["n", "games", "count"]),
      our_miss: firstNum(r, ["mae_model", "miss_model", "our_avg_miss", "our_miss", "mae"]),
      our_miss_mean: firstNum(r, ["mae_model_mean", "miss_model_mean"]),
      season_miss: firstNum(r, ["mae_season_avg", "season_avg_miss", "mae_season"]),
      last8_miss: firstNum(r, ["mae_last8", "miss_recent8", "last8_avg_miss", "miss_last8"]),
      inside: firstNum(r, ["coverage_p25_p75", "inside_range", "inside_our_range", "coverage"]),
      plain_english: r.plain_english || r.plain || r.summary || r.blurb || "",
      by_season: r.by_season || r.seasons || null,
      raw: r
    };
  }

  function missCell(n) {
    return '<td class="num">' + formatAccNum(n) + "</td>";
  }

  function seasonLine(bySeason) {
    if (!bySeason || typeof bySeason !== "object") return "";
    var years = Object.keys(bySeason).sort();
    if (!years.length) return "";
    var bits = years.map(function (yr) {
      var s = normalize(bySeason[yr]);
      var parts = [yr];
      if (s.our_miss != null) parts.push("our miss " + formatAccNum(s.our_miss));
      if (s.season_miss != null) parts.push("season avg " + formatAccNum(s.season_miss));
      if (s.last8_miss != null) parts.push("last-8 " + formatAccNum(s.last8_miss));
      if (s.inside != null) parts.push("inside " + formatInside(s.inside));
      return parts.join(" · ");
    });
    return '<div class="acc-seasons">' + P.escapeHtml(bits.join("  |  ")) + "</div>";
  }

  function render(data) {
    var panel = $("projection-accuracy-panel");
    var tbody = $("projection-accuracy-tbody");
    if (!panel || !tbody) return;
    var rows = marketRows(data).map(normalize).filter(function (r) { return r.stat && r.stat !== "—"; });
    if (!rows.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    var thead = panel.querySelector("thead tr");
    if (thead) {
      thead.innerHTML =
        "<th>Stat</th>" +
        '<th class="num">Games</th>' +
        '<th class="num">Our miss</th>' +
        '<th class="num">Season avg miss</th>' +
        '<th class="num">Last-8 miss</th>' +
        '<th class="num">Inside our range</th>';
    }

    tbody.innerHTML = rows.map(function (r) {
      var meanNote = "";
      if (r.our_miss_mean != null && r.our_miss != null && Math.abs(r.our_miss_mean - r.our_miss) >= 0.005) {
        meanNote = '<span class="sub">mean ' + formatAccNum(r.our_miss_mean) + "</span>";
      }
      var html = "<tr>" +
        "<td>" + P.escapeHtml(r.stat) + "</td>" +
        '<td class="num">' + (r.games != null ? P.formatInt(r.games) : "—") + "</td>" +
        '<td class="num">' + formatAccNum(r.our_miss) + meanNote + "</td>" +
        missCell(r.season_miss) +
        missCell(r.last8_miss) +
        '<td class="num">' + formatInside(r.inside) + "</td>" +
        "</tr>";
      if (r.plain_english || r.by_season) {
        html += '<tr class="acc-detail"><td colspan="6">' +
          (r.plain_english ? '<p class="acc-plain">' + P.escapeHtml(r.plain_english) + "</p>" : "") +
          seasonLine(r.by_season) +
          "</td></tr>";
      }
      return html;
    }).join("");

    var intro = $("projection-accuracy-intro");
    if (intro) {
      var seasons = data && data.seasons;
      var seasonType = data && data.season_type;
      var cadence = data && data.refit_cadence;
      var bits = ["Walk-forward test"];
      if (Array.isArray(seasons) && seasons.length) {
        bits.push("on " + seasons[0] + "–" + seasons[seasons.length - 1] +
          (seasonType ? " (" + seasonType + ")" : ""));
      }
      bits.push("with weekly refits using only earlier games.");
      intro.textContent = bits.join(" ");
    }

    var noteEl = $("projection-accuracy-note");
    if (noteEl) {
      var notes = [];
      if (data && data.lowcount_note) notes.push(data.lowcount_note);
      else notes.push("Pass TDs, interceptions, rush TDs, receiving TDs, and anytime TD are roughly a tie with the season and last-8 averages when compared on projected means — the fair comparison for these mostly 0-or-1 stats.");
      if (data && data.coverage_note) {
        /* keep the page note short; coverage detail stays in the file for anyone who wants it */
      }
      noteEl.textContent = notes.join(" ");
    }
  }

  function init() {
    if (!$("projection-accuracy-panel")) return;
    P.fetchJson("data/projection_accuracy.json")
      .then(function (data) {
        render(data);
      })
      .catch(function () {
        if ($("projection-accuracy-panel")) $("projection-accuracy-panel").hidden = true;
      });
  }

  window.PropsAccuracy = { render: render, init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
