/* Game page: game.html?week=N&game=<game_id> */
(function () {
  "use strict";
  var P = window.PropsEV;
  var B = window.PropsBoard;
  var PAGE = B.PAGE_SIZE || 100;
  var state = {
    payload: null,
    rows: [],
    allGameRows: [],
    manifest: null,
    season: null,
    week: null,
    gameId: null,
    moreDetails: false,
    player: "",
    page: 0,
  };

  function $(id) { return document.getElementById(id); }

  function showWinner(payload, gameId, matchup) {
    var node = $("game-winner");
    if (!node) return Promise.resolve();
    function paint(rec) {
      var html = B.winnerLineHtml(rec || {});
      if (!html) {
        node.hidden = true;
        node.innerHTML = "";
        return;
      }
      node.hidden = false;
      node.innerHTML = html;
    }
    if (payload && payload.likely_winner) {
      paint(payload);
      return Promise.resolve();
    }
    return B.loadWinners(payload && payload.season, payload && payload.week).then(function (winners) {
      paint(B.winnerForGame(winners, gameId, matchup) || payload);
    }).catch(function () { paint(null); });
  }


  function applyFilters(rows) {
    var showFailed = $("filter-failed") ? $("filter-failed").checked : false;
    var player = state.player;
    return rows.filter(function (r) {
      if (!showFailed && P.isFailed(r)) return false;
      if (player && r.player !== player) return false;
      return true;
    });
  }

  function renderPlayerChips(rows) {
    var root = $("player-chips");
    if (!root) return;
    var names = B.unique(rows, "player");
    if (!names.length) {
      root.innerHTML = "";
      return;
    }
    var html = '<button type="button" class="chip-btn' + (state.player ? "" : " on") + '" data-player="">All players</button>';
    names.forEach(function (name) {
      html += '<button type="button" class="chip-btn' + (state.player === name ? " on" : "") + '" data-player="' + P.escapeHtml(name) + '">' + P.escapeHtml(name) + "</button>";
    });
    root.innerHTML = html;
  }

  function updatePager(visible) {
    if (state.page * PAGE >= visible.length && visible.length) state.page = 0;
    var start = visible.length ? state.page * PAGE : 0;
    var end = Math.min(start + PAGE, visible.length);
    var prev = $("show-prev");
    var more = $("show-more");
    if (prev) prev.hidden = state.page <= 0;
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

  function render() {
    var visible = B.sortGamePicks(applyFilters(state.allGameRows));
    var pageRows = updatePager(visible);
    if ($("results-count")) {
      var start = visible.length ? state.page * PAGE + 1 : 0;
      var end = Math.min((state.page + 1) * PAGE, visible.length);
      var range = visible.length ? ("Showing " + start + "–" + end + " of " + visible.length) : "0";
      $("results-count").textContent =
        range + " of " + state.allGameRows.length + " pick" + (state.allGameRows.length === 1 ? "" : "s") +
        ", Strong then Lean then Pass, EV within each tier. Check and Thin market rows are at the bottom.";
    }
    var opts = {
      moreDetails: state.moreDetails,
      hideMatchup: true,
      sortKey: null,
      sortDir: null,
    };
    B.renderTable($("props-thead"), $("props-tbody"), pageRows, opts);
    B.renderCards($("props-cards"), pageRows, opts);
    renderPlayerChips(state.allGameRows);
  }

  function bind() {
    if ($("filter-failed")) $("filter-failed").addEventListener("change", function () {
      state.page = 0;
      render();
    });
    if ($("more-details")) {
      $("more-details").addEventListener("change", function () {
        state.moreDetails = $("more-details").checked;
        document.body.classList.toggle("more-details", state.moreDetails);
        render();
      });
    }
    if ($("player-chips")) {
      $("player-chips").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-player]");
        if (!btn) return;
        state.player = btn.getAttribute("data-player") || "";
        state.page = 0;
        render();
      });
    }
    if ($("show-more")) {
      $("show-more").addEventListener("click", function () {
        state.page += 1;
        render();
        var board = $("game-board");
        if (board && board.scrollIntoView) board.scrollIntoView({ block: "start" });
      });
    }
    if ($("show-prev")) {
      $("show-prev").addEventListener("click", function () {
        if (state.page > 0) state.page -= 1;
        render();
        var board = $("game-board");
        if (board && board.scrollIntoView) board.scrollIntoView({ block: "start" });
      });
    }
    B.bindTooltips(document);
    B.bindWeekSelector($("week-select"), "game");
  }

  function init() {
    bind();
    var params = B.queryParams();
    state.gameId = params.game;
    B.loadGameData()
      .then(function (data) {
        state.payload = data.payload;
        state.rows = data.rows;
        state.manifest = data.manifest;
        state.season = data.season;
        state.week = data.week;
        B.fillWeekSelector($("week-select"), data.manifest, data.season, data.week);
        B.showMeta($("page-meta"), data.payload, data.rows);
        B.showSampleBanner($("sample-banner"), data.payload);

        var back = $("back-link");
        if (back) {
          back.href = "index.html?season=" + encodeURIComponent(data.season) + "&week=" + encodeURIComponent(data.week) + "#games";
        }

        state.allGameRows = data.rows || [];

        if (!params.game || !state.allGameRows.length) {
          if ($("game-title")) $("game-title").textContent = "Game not found";
          if ($("game-kickoff")) $("game-kickoff").textContent = "";
          if ($("game-winner")) { $("game-winner").hidden = true; $("game-winner").innerHTML = ""; }
          if ($("game-missing")) {
            $("game-missing").hidden = false;
            $("game-missing").textContent = params.game
              ? "No picks for this game in " + B.weekLabel(data.season, data.week) + "."
              : "Choose a game from the dashboard.";
          }
          if ($("game-board")) $("game-board").hidden = true;
          return;
        }

        var g = state.allGameRows[0];
        if ($("game-title")) $("game-title").textContent = g.matchup || params.game;
        if ($("game-kickoff")) $("game-kickoff").textContent = g.kickoff ? P.formatKickoff(g.kickoff) : "";
        document.title = (g.matchup || "Game") + " · NFL Player Props EV";
        showWinner(Object.assign({}, data.payload, g), params.game, g.matchup || data.payload.matchup).then(function () { render(); });
        return;
      })
      .catch(function (err) {
        if ($("page-meta")) $("page-meta").textContent = "";
        var banner = $("sample-banner");
        if (banner) {
          banner.hidden = false;
          banner.className = "banner err";
          banner.textContent = "Could not load this week's props.";
        }
        if ($("game-missing")) {
          $("game-missing").hidden = false;
          $("game-missing").textContent = (err && err.message) || "Could not load this week's props.";
        }
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
