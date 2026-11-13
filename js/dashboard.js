/* Dashboard: index.html — best bets plus the Games section. */
(function () {
  "use strict";
  var P = window.PropsEV;
  var B = window.PropsBoard;
  var state = {
    payload: null,
    rows: [],
    manifest: null,
    season: null,
    week: null,
    sortKey: "ev_per_100",
    sortDir: "desc",
    moreDetails: false,
  };

  function $(id) { return document.getElementById(id); }

  function fillSelectSimple(sel, values, placeholder, labelFn) {
    if (!sel) return;
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

  function populateFilters(rows) {
    fillSelectSimple($("filter-game"), B.unique(rows, "matchup"), "All games");
    fillSelectSimple($("filter-position"), B.unique(rows, "position"), "All positions");
    fillSelectSimple($("filter-market"), B.unique(rows, "market"), "All markets", P.marketLabel);
    fillSelectSimple($("filter-book"), B.unique(rows, "book"), "All books");
  }

  function filters() {
    var minEdgeRaw = $("filter-edge-num") ? $("filter-edge-num").value : "";
    var minEdge = minEdgeRaw === "" ? null : Number(minEdgeRaw);
    if (minEdge != null && !Number.isFinite(minEdge)) minEdge = null;
    return {
      q: ($("filter-q") && $("filter-q").value || "").trim().toLowerCase(),
      game: $("filter-game") ? $("filter-game").value : "",
      position: $("filter-position") ? $("filter-position").value : "",
      market: $("filter-market") ? $("filter-market").value : "",
      book: $("filter-book") ? $("filter-book").value : "",
      minEdge: minEdge,
      showFailed: $("filter-failed") ? $("filter-failed").checked : false,
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
      if (numeric.indexOf(key) !== -1) return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" }) * dir;
    });
    return copy;
  }

  function render() {
    var visible = sortRows(applyFilters(state.rows));
    if ($("results-count")) {
      $("results-count").textContent =
        visible.length + " of " + state.rows.length + " prop" + (state.rows.length === 1 ? "" : "s");
    }
    var opts = {
      moreDetails: state.moreDetails,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
    };
    B.renderTable($("props-thead"), $("props-tbody"), visible, opts);
    B.renderCards($("props-cards"), visible, opts);
    B.renderGames($("games-grid"), B.groupGames(state.rows), state.season, state.week);
    var nGames = B.groupGames(state.rows).length;
    if ($("games-count")) {
      $("games-count").textContent = nGames + " game" + (nGames === 1 ? "" : "s") + " this week";
    }
  }

  function bind() {
    ["filter-q", "filter-game", "filter-position", "filter-market", "filter-book", "filter-failed"].forEach(function (id) {
      if (!$(id)) return;
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
    var slider = $("filter-edge");
    var num = $("filter-edge-num");
    if (slider && num) {
      slider.addEventListener("input", function () {
        num.value = slider.value;
        render();
      });
      num.addEventListener("input", function () {
        if (num.value !== "") slider.value = num.value;
        render();
      });
    }
    if ($("more-details")) {
      $("more-details").addEventListener("change", function () {
        state.moreDetails = $("more-details").checked;
        document.body.classList.toggle("more-details", state.moreDetails);
        render();
      });
    }
    if ($("props-thead")) {
      $("props-thead").addEventListener("click", function (e) {
        if (e.target.closest(".tip")) return;
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
    B.bindTooltips(document);
    B.bindWeekSelector($("week-select"), "index");
  }

  function init() {
    bind();
    B.loadBoardData()
      .then(function (data) {
        state.payload = data.payload;
        state.rows = data.rows;
        state.manifest = data.manifest;
        state.season = data.season;
        state.week = data.week;
        B.fillWeekSelector($("week-select"), data.manifest, data.season, data.week);
        populateFilters(data.rows);
        B.showMeta($("page-meta"), data.payload, data.rows);
        B.showSampleBanner($("sample-banner"), data.payload);
        render();
      })
      .catch(function (err) {
        $("page-meta").textContent = "";
        var banner = $("sample-banner");
        banner.hidden = false;
        banner.className = "banner err";
        banner.textContent = err && err.status === 404
          ? "No props file has been published yet."
          : "Could not load this week's props.";
        $("results-count").textContent = "";
        $("props-tbody").innerHTML = "";
        $("props-cards").innerHTML = '<div class="empty-state">No data loaded.</div>';
        if ($("games-grid")) $("games-grid").innerHTML = '<div class="empty-state">No data loaded.</div>';
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
