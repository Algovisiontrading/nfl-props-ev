/* Player projections page: games in kickoff order, player search, accuracy table. */
(function () {
  "use strict";
  var P = window.PropsEV;
  var B = window.PropsBoard;

  function $(id) { return document.getElementById(id); }

  var MARKET_ORDER = [
    "pass_yds", "pass_completions", "pass_tds", "pass_ints",
    "rush_yds", "rush_attempts", "rush_tds",
    "rec_yds", "receptions", "rec_tds",
    "anytime_td"
  ];
  var POS_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, FB: 4, K: 5 };

  var PROJ_ACC_NOTE = "Tested on games the model never saw (2025 + 2026 weeks 1–9). Trained on 2018–23. The benchmark is each player's last-8-game average.";

  function padWeek(week) {
    var n = Number(week);
    if (!Number.isFinite(n)) return String(week);
    return (n < 10 ? "0" : "") + String(n);
  }

  function weekStem(season, week) {
    return String(season) + "-wk" + padWeek(week);
  }

  function normalizeProjRow(raw) {
    var row = {
      season: P.num(P.pick(raw, ["season"])),
      week: P.num(P.pick(raw, ["week"])),
      game_id: P.pick(raw, ["game_id"]) || "",
      kickoff: P.pick(raw, ["kickoff"]),
      matchup: P.pick(raw, ["matchup", "game"]) || "",
      player: P.pick(raw, ["player", "player_name"]) || "",
      player_id: P.pick(raw, ["player_id"]) || "",
      position: P.pick(raw, ["position", "pos"]) || "",
      team: P.pick(raw, ["team"]) || "",
      opponent: P.pick(raw, ["opponent", "opp"]) || "",
      market: P.canonicalMarket(P.pick(raw, ["market"]) || ""),
      model_mean: P.num(P.pick(raw, ["model_mean", "mean", "proj_mean"])),
      proj_median: P.num(P.pick(raw, ["proj_median", "median", "model_median"])),
      proj_p25: P.num(P.pick(raw, ["proj_p25", "p25", "model_p25", "q25"])),
      proj_p75: P.num(P.pick(raw, ["proj_p75", "p75", "model_p75", "q75"])),
      sample_size: P.num(P.pick(raw, ["sample_size", "n"])),
      market_passed: raw.market_passed,
      check: raw.check,
      promoted_by_absence: raw.promoted_by_absence,
      role_flags: raw.role_flags,
      line: P.num(P.pick(raw, ["line", "typical_line"])),
    };
    if (!row.matchup && row.team && row.opponent) row.matchup = row.team + " vs " + row.opponent;
    return row;
  }

  function marketRank(m) {
    var i = MARKET_ORDER.indexOf(m);
    return i === -1 ? 100 : i;
  }

  function posRank(p) {
    var k = String(p || "").toUpperCase();
    return POS_ORDER[k] != null ? POS_ORDER[k] : 50;
  }

  function awayHome(matchup) {
    var s = String(matchup || "");
    var m = s.split(/\s+@\s+/);
    if (m.length === 2) return { away: m[0].trim(), home: m[1].trim() };
    var v = s.split(/\s+vs\.?\s+/i);
    if (v.length === 2) return { away: v[0].trim(), home: v[1].trim() };
    return { away: "", home: "" };
  }

  function teamSideRank(team, matchup) {
    var sides = awayHome(matchup);
    if (team && sides.away && team === sides.away) return 0;
    if (team && sides.home && team === sides.home) return 1;
    return 2;
  }

  function kickoffMs(iso) {
    if (!iso) return Infinity;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? Infinity : d.getTime();
  }

  function groupByGame(rows) {
    var map = {};
    var order = [];
    rows.forEach(function (r) {
      var id = r.game_id || r.matchup || "";
      if (!id) return;
      if (!map[id]) {
        map[id] = { game_id: r.game_id || id, matchup: r.matchup || id, kickoff: r.kickoff, players: {} };
        order.push(id);
      }
      var g = map[id];
      if (!g.kickoff && r.kickoff) g.kickoff = r.kickoff;
      if (!g.matchup && r.matchup) g.matchup = r.matchup;
      var pk = r.player_id || r.player;
      if (!g.players[pk]) {
        g.players[pk] = {
          player: r.player,
          player_id: r.player_id,
          position: r.position,
          team: r.team,
          opponent: r.opponent,
          stats: []
        };
      }
      g.players[pk].stats.push(r);
    });
    order.sort(function (a, b) {
      var da = kickoffMs(map[a].kickoff) - kickoffMs(map[b].kickoff);
      if (da) return da;
      return String(map[a].matchup).localeCompare(String(map[b].matchup));
    });
    return order.map(function (id) {
      var g = map[id];
      var players = Object.keys(g.players).map(function (k) { return g.players[k]; });
      players.forEach(function (p) {
        p.stats.sort(function (a, b) { return marketRank(a.market) - marketRank(b.market); });
      });
      players.sort(function (a, b) {
        var sa = teamSideRank(a.team, g.matchup) - teamSideRank(b.team, g.matchup);
        if (sa) return sa;
        var pa = posRank(a.position) - posRank(b.position);
        if (pa) return pa;
        return String(a.player || "").localeCompare(String(b.player || ""));
      });
      g.playerList = players;
      return g;
    });
  }

  function statCell(row) {
    var label = P.escapeHtml(P.marketLabel(row.market) || row.market || "—");
    var val = P.escapeHtml(P.formatProjection(row));
    var flags = [];
    if (row.market_passed === false || row.market_passed === "false") {
      flags.push('<span class="proj-flag" title="No live calibration-passed model. Shown for information only, never priced.">informational</span>');
    }
    if (row.promoted_by_absence) {
      flags.push('<span class="proj-flag">promoted</span>');
    }
    return '<div class="proj-stat"><span class="label">' + label + "</span>" +
      '<span class="proj-val">' + val + "</span>" + flags.join(" ") + "</div>";
  }

  function playerCard(p) {
    var href = "";
    return (
      '<article class="proj-player">' +
        '<div class="player-cell">' + P.escapeHtml(p.player || "—") +
          ' <span class="pos">' + P.escapeHtml(p.position || "") + "</span>" +
          (p.team ? '<span class="sub"> ' + P.escapeHtml(p.team + (p.opponent ? " vs " + p.opponent : "")) + "</span>" : "") +
        "</div>" +
        '<div class="proj-stats">' + p.stats.map(statCell).join("") + "</div>" +
      "</article>"
    );
  }

  function renderGames(games, query) {
    var root = $("proj-games");
    var empty = $("proj-empty");
    var q = String(query || "").trim().toLowerCase();
    var shown = 0;
    var html = games.map(function (g) {
      var players = g.playerList || [];
      if (q) {
        players = players.filter(function (p) {
          return String(p.player || "").toLowerCase().indexOf(q) !== -1 ||
            String(p.team || "").toLowerCase().indexOf(q) !== -1;
        });
      }
      if (!players.length) return "";
      shown += players.length;
      var ko = g.kickoff ? P.formatKickoff(g.kickoff) : "";
      var href = (g.game_id && state.season != null && state.week != null)
        ? B.gameHref(state.season, state.week, g.game_id)
        : "";
      var title = href
        ? '<a href="' + P.escapeHtml(href) + '">' + P.escapeHtml(g.matchup) + "</a>"
        : P.escapeHtml(g.matchup);
      return '<section class="panel proj-game">' +
        "<h2>" + title + "</h2>" +
        (ko ? '<p class="proj-kickoff">' + P.escapeHtml(ko) + "</p>" : "") +
        '<div class="proj-players">' + players.map(playerCard).join("") + "</div>" +
      "</section>";
    }).join("");
    if (!html) {
      root.innerHTML = "";
      empty.hidden = false;
      empty.textContent = q ? "No players match “" + query + "”." : "No projections have been published for this week yet.";
      return;
    }
    empty.hidden = true;
    root.innerHTML = html;
  }

  function formatAccNum(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(Number(n.toFixed(2)));
  }

  function firstNum(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "" && Number.isFinite(Number(obj[keys[i]]))) return Number(obj[keys[i]]);
    }
    return null;
  }

  function normalizeAccRow(r) {
    r = r || {};
    var market = r.market || r.stat || r.name || r.label || "";
    return {
      stat: P.marketLabel(market) || market || "—",
      games: firstNum(r, ["n", "games", "count"]),
      avg_actual: firstNum(r, ["avg_actual", "average_actual"]),
      miss_model: firstNum(r, ["miss_model", "our_avg_miss", "model_miss", "mae_model", "mae"]),
      miss_recent8: firstNum(r, ["miss_recent8", "last8_avg_miss", "miss_last8", "mae_last8", "mae_recent8"]),
      better_pct: firstNum(r, ["better_pct", "better_by", "better", "pct_better_vs_last8"])
    };
  }

  function accRowsFromPayload(data) {
    if (!data) return { rows: [], note: null };
    if (Array.isArray(data)) return { rows: data, note: null };
    var rows = data.rows || data.by_market || data.markets || data.stats || data.data || [];
    var note = data.note || data.intro || data.caption || null;
    if (!note && Array.isArray(data.seasons) && data.seasons.length) {
      note = "Walk-forward test on " + data.seasons.join("–") +
        (data.season_type ? " (" + data.season_type + ")" : "") +
        ". The benchmark is each player's last-8-game average.";
    }
    return { rows: rows, note: note };
  }

  function accUsable(rows) {
    return (rows || []).filter(function (r) {
      var n = normalizeAccRow(r);
      return n.miss_model != null || n.miss_recent8 != null || n.better_pct != null;
    });
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
      var n = r.better_pct == null || !Number.isFinite(Number(r.better_pct)) ? null : Number(r.better_pct);
      var pct = (n != null && Math.abs(n) < 1 && n !== 0) ? n * 100 : n;
      var betterHtml = pct == null ? "—" : P.formatSignedPct(pct, 1);
      return "<tr>" +
        "<td>" + P.escapeHtml(r.stat) + "</td>" +
        '<td class="num">' + (r.games != null ? P.formatInt(r.games) : "—") + "</td>" +
        '<td class="num">' + formatAccNum(r.avg_actual) + "</td>" +
        '<td class="num">' + formatAccNum(r.miss_model) + "</td>" +
        '<td class="num">' + formatAccNum(r.miss_recent8) + "</td>" +
        '<td class="num ' + P.evClass(pct) + '">' + betterHtml + "</td>" +
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

  function initProjectionAccuracy() {
    var jsonP = P.fetchJson("data/projection_accuracy.json").then(accRowsFromPayload).catch(function () { return { rows: [], note: null }; });
    var csvP = fetch("data/projection_accuracy.csv", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("csv");
        return res.text();
      })
      .then(function (text) { return { rows: parseCsv(text), note: null }; })
      .catch(function () { return { rows: [], note: null }; });
    Promise.all([jsonP, csvP]).then(function (pair) {
      var js = pair[0], csv = pair[1];
      var jsonUse = accUsable(js.rows);
      var csvUse = accUsable(csv.rows);
      // Prefer JSON when it is at least as complete as the CSV; a one-market work-in-progress should not hide the CSV table.
      if (jsonUse.length && jsonUse.length >= csvUse.length) {
        renderProjectionAccuracy(js.rows, js.note);
      } else if (csvUse.length) {
        renderProjectionAccuracy(csv.rows, csv.note);
      } else if (jsonUse.length) {
        renderProjectionAccuracy(js.rows, js.note);
      } else if ($("projection-accuracy-panel")) {
        $("projection-accuracy-panel").hidden = true;
      }
    });
  }

  function loadAccCsv() {
    return fetch("data/projection_accuracy.csv", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("csv");
        return res.text();
      })
      .then(function (text) {
        renderProjectionAccuracy(parseCsv(text), null);
      })
      .catch(function () {
        if ($("projection-accuracy-panel")) $("projection-accuracy-panel").hidden = true;
      });
  }

  var state = { games: [], season: null, week: null, payload: null };

  function showPayload(payload) {
    state.payload = payload || {};
    var rawRows = [];
    if (Array.isArray(payload)) rawRows = payload;
    else rawRows = (payload && (payload.rows || payload.projections || payload.data)) || [];
    var rows = rawRows.map(normalizeProjRow).filter(function (r) { return r.player && r.market; });
    state.season = payload && payload.season != null ? payload.season : (rows[0] && rows[0].season);
    state.week = payload && payload.week != null ? payload.week : (rows[0] && rows[0].week);
    state.games = groupByGame(rows);
    var bits = [];
    var ts = payload && (payload.generated_at || payload.updated_at);
    if (ts) bits.push("Last updated <strong>" + P.escapeHtml(P.formatET(ts)) + "</strong>");
    if (state.season != null && state.week != null) {
      bits.push(P.escapeHtml((state.season ? String(state.season) + " " : "") + "Week " + String(state.week)));
    }
    bits.push(rows.length + " projection" + (rows.length === 1 ? "" : "s") + " · " + state.games.length + " game" + (state.games.length === 1 ? "" : "s"));
    $("page-meta").innerHTML = bits.join('<span class="muted"> · </span>');
    var noteEl = $("proj-file-note");
    if (noteEl) {
      if (payload && payload.note) {
        noteEl.hidden = false;
        noteEl.textContent = payload.note;
      } else {
        noteEl.hidden = true;
        noteEl.textContent = "";
      }
    }
    var banner = $("sample-banner");
    if (payload && payload.sample) {
      banner.hidden = false;
      banner.className = "banner sample";
      banner.innerHTML = "<strong>Sample data.</strong> These projections are placeholders.";
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
    renderGames(state.games, $("proj-q") ? $("proj-q").value : "");
  }

  function loadProjections(manifest, season, week) {
    var urls = [];
    if (season != null && week != null) {
      urls.push("data/weeks/" + weekStem(season, week) + "/projections.json");
    }
    urls.push("data/projections.json");
    var chain = Promise.reject(new Error("start"));
    urls.forEach(function (url) {
      chain = chain.catch(function () { return P.fetchJson(url); });
    });
    return chain;
  }

  function start() {
    initProjectionAccuracy();
    var params = B.queryParams();
    P.fetchJson("data/weeks/index.json").then(function (manifest) {
      var cur = manifest && (manifest.current_season != null || manifest.current_week != null)
        ? { season: manifest.current_season, week: manifest.current_week }
        : {};
      var season = Number.isFinite(params.season) ? params.season : cur.season;
      var week = Number.isFinite(params.week) ? params.week : cur.week;
      B.fillWeekSelector($("week-select"), manifest, season, week);
      B.bindWeekSelector($("week-select"), "projections");
      return loadProjections(manifest, season, week).then(function (payload) {
        // If a week was requested and the file is a different week, still show it
        showPayload(payload);
      });
    }).catch(function () {
      if ($("week-select") && $("week-select").closest("label")) $("week-select").closest("label").hidden = true;
      return P.fetchJson("data/projections.json").then(showPayload);
    }).catch(function () {
      $("page-meta").textContent = "";
      $("proj-empty").hidden = false;
      $("proj-games").innerHTML = "";
    });

    var q = $("proj-q");
    if (q && !q._bound) {
      q._bound = true;
      q.addEventListener("input", function () {
        renderGames(state.games, q.value);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
