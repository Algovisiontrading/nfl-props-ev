/* Dashboard: index.html — best bets plus the Games section. */
(function () {
  "use strict";
  var P = window.PropsEV;
  var B = window.PropsBoard;
  var PAGE = B.PAGE_SIZE || 100;
  var state = {
    board: null,
    payload: null,
    rows: [],
    manifest: null,
    season: null,
    week: null,
    sortKey: "ev_per_100",
    sortDir: "desc",
    moreDetails: false,
    passLoaded: false,
    loadingPass: false,
    page: 0,
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
    var games = state.board ? B.gamesForBoard(state.board) : [];
    var matchups = games.length ? games.map(function (g) { return g.matchup; }).filter(Boolean) : B.unique(rows, "matchup");
    fillSelectSimple($("filter-game"), matchups, "All games");
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
      showPass: $("filter-show-pass") ? $("filter-show-pass").checked : false,
    };
  }

  function filtersNeedPass() {
    var f = filters();
    if (f.showPass || f.showFailed) return true;
    if (f.q || f.game || f.position || f.market || f.book) return true;
    if (f.minEdge != null) return true;
    return false;
  }

  function applyFilters(rows) {
    var f = filters();
    return rows.filter(function (r) {
      if (!f.showFailed && P.isFailed(r)) return false;
      if (!f.showPass && !state.passLoaded && r.tier === "Pass") return false;
      if (!f.showPass && state.passLoaded && r.tier === "Pass" && !f.q && !f.game && !f.position && !f.market && !f.book && f.minEdge == null && !f.showFailed) {
        return false;
      }
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

  function updatePager(visible) {
    if (state.page * PAGE >= visible.length && visible.length) state.page = 0;
    var start = visible.length ? state.page * PAGE : 0;
    var end = Math.min(start + PAGE, visible.length);
    var prev = $("show-prev");
    var more = $("show-more");
    if (prev) {
      prev.hidden = state.page <= 0;
    }
    if (more) {
      var left = visible.length - end;
      if (left > 0) {
        more.hidden = false;
        more.textContent = "Show more (" + left + " remaining)";
      } else {
        more.hidden = true;
      }
    }
    return visible.slice(start, end);
  }

  function countLabel(visible) {
    var start = visible.length ? state.page * PAGE + 1 : 0;
    var end = Math.min((state.page + 1) * PAGE, visible.length);
    if (!visible.length) return "0 props";
    var range = "Showing " + start + "–" + end + " of " + visible.length;
    if (state.passLoaded) {
      return range + " prop" + (visible.length === 1 ? "" : "s");
    }
    var passN = state.board && state.board.passRowsExpected;
    var extra = Number.isFinite(Number(passN))
      ? " Turn on Show Pass to load " + passN + " Pass row" + (Number(passN) === 1 ? "" : "s") + "."
      : " Turn on Show Pass to load the rest.";
    return range + " Strong and Lean pick" + (visible.length === 1 ? "" : "s") + "." + extra;
  }

  function render() {
    var visible = sortRows(applyFilters(state.rows));
    var pageRows = updatePager(visible);
    if ($("results-count")) $("results-count").textContent = countLabel(visible);
    var opts = {
      moreDetails: state.moreDetails,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
    };
    B.renderTable($("props-thead"), $("props-tbody"), pageRows, opts);
    B.renderCards($("props-cards"), pageRows, opts);
    var games = state.board ? B.gamesForBoard(state.board) : B.groupGames(state.rows);
    B.renderGames($("games-grid"), games, state.season, state.week);
    if ($("games-count")) {
      $("games-count").textContent = games.length + " game" + (games.length === 1 ? "" : "s") + " this week";
    }
  }

  function requestRender() {
    state.page = 0;
    if (state.passLoaded || !filtersNeedPass() || state.loadingPass) {
      render();
      return;
    }
    state.loadingPass = true;
    if ($("results-count")) $("results-count").textContent = "Loading all picks…";
    B.loadPassRows(state.board)
      .then(function (board) {
        state.board = board;
        state.payload = board.payload;
        state.rows = board.rows;
        state.passLoaded = !!board.passLoaded;
        state.loadingPass = false;
        populateFilters(board.rows);
        B.showMeta($("page-meta"), board.payload, board.rows);
        render();
      })
      .catch(function () {
        state.loadingPass = false;
        render();
      });
  }

  function bind() {
    ["filter-q", "filter-game", "filter-position", "filter-market", "filter-book", "filter-failed", "filter-show-pass"].forEach(function (id) {
      if (!$(id)) return;
      $(id).addEventListener("input", requestRender);
      $(id).addEventListener("change", requestRender);
    });
    var slider = $("filter-edge");
    var num = $("filter-edge-num");
    if (slider && num) {
      slider.addEventListener("input", function () {
        num.value = slider.value;
        requestRender();
      });
      num.addEventListener("input", function () {
        if (num.value !== "") slider.value = num.value;
        requestRender();
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
        state.page = 0;
        render();
      });
    }
    if ($("show-more")) {
      $("show-more").addEventListener("click", function () {
        state.page += 1;
        render();
        var board = $("props-board") || $("props-cards") || $("props-tbody");
        if (board && board.scrollIntoView) board.scrollIntoView({ block: "start" });
      });
    }
    if ($("show-prev")) {
      $("show-prev").addEventListener("click", function () {
        if (state.page > 0) state.page -= 1;
        render();
        var board = $("props-board") || $("props-cards") || $("props-tbody");
        if (board && board.scrollIntoView) board.scrollIntoView({ block: "start" });
      });
    }
    B.bindTooltips(document);
    B.bindWeekSelector($("week-select"), "index");
  }

  function init() {
    bind();
    B.loadBoardData()
      .then(function (data) {
        state.board = data;
        state.payload = data.payload;
        state.rows = data.rows;
        state.manifest = data.manifest;
        state.season = data.season;
        state.week = data.week;
        state.passLoaded = !!data.passLoaded;
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
