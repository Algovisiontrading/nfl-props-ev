/* Game page: game.html?week=N&game=<game_id> */
(function () {
  "use strict";
  var P = window.PropsEV;
  var B = window.PropsBoard;
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
  };

  function $(id) { return document.getElementById(id); }

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

  function render() {
    var visible = B.sortGamePicks(applyFilters(state.allGameRows));
    if ($("results-count")) {
      $("results-count").textContent =
        visible.length + " of " + state.allGameRows.length + " pick" + (state.allGameRows.length === 1 ? "" : "s") +
        ", Strong then Lean then Pass, EV within each tier. Check and Thin market rows are at the bottom.";
    }
    var opts = {
      moreDetails: state.moreDetails,
      hideMatchup: true,
      sortKey: null,
      sortDir: null,
    };
    B.renderTable($("props-thead"), $("props-tbody"), visible, opts);
    B.renderCards($("props-cards"), visible, opts);
    renderPlayerChips(state.allGameRows);
  }

  function bind() {
    if ($("filter-failed")) $("filter-failed").addEventListener("change", render);
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
        render();
      });
    }
    B.bindTooltips(document);
    B.bindWeekSelector($("week-select"), "game");
  }

  function init() {
    bind();
    var params = B.queryParams();
    state.gameId = params.game;
    B.loadBoardData()
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

        var gameRows = data.rows.filter(function (r) {
          return String(r.game_id || "") === String(params.game) ||
            String(r.matchup || "") === String(params.game) ||
            String(r.game || "") === String(params.game);
        });
        state.allGameRows = gameRows;

        if (!params.game || !gameRows.length) {
          if ($("game-title")) $("game-title").textContent = "Game not found";
          if ($("game-kickoff")) $("game-kickoff").textContent = "";
          if ($("game-missing")) {
            $("game-missing").hidden = false;
            $("game-missing").textContent = params.game
              ? "No picks for this game in " + B.weekLabel(data.season, data.week) + "."
              : "Choose a game from the dashboard.";
          }
          if ($("game-board")) $("game-board").hidden = true;
          return;
        }

        var g = gameRows[0];
        if ($("game-title")) $("game-title").textContent = g.matchup || params.game;
        if ($("game-kickoff")) $("game-kickoff").textContent = g.kickoff ? P.formatKickoff(g.kickoff) : "";
        document.title = (g.matchup || "Game") + " · NFL Player Props EV";
        render();
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
