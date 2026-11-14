/* Shared board UI: week loading, games cards, tooltips, More details, pick tables. */
(function (global) {
  "use strict";
  var P = global.PropsEV;

  var COLUMN_TIPS = {
    player: "Player the prop is written on.",
    position: "Player position.",
    tier: "Strong, Lean, or Pass after site safety guards. Check means edge is over 15%. Thin market means a Kalshi market with no size or a wide bid–ask spread. Those flags also cap the tier.",
    matchup: "Game matchup and kickoff time in Eastern Time (ET).",
    market: "The prop market, such as receiving yards or anytime touchdown.",
    side: "Over or under the posted line.",
    line: "The sportsbook or exchange line.",
    odds_american: "American odds at the listed book.",
    book: "Source of the line. Volume and open interest are shown when the book provides them.",
    ev_per_100: "Expected profit per $100 staked, at the posted odds, using the model probability. Positive means the model thinks the bet has value.",
    summary: "A plain-English line from the modeler, or a fallback built from the EV and edge thresholds.",
    model_prob: "Model probability that this side hits, frozen as a pregame estimate.",
    fair_odds_american: "Fair American odds implied by the model probability.",
    edge_pct: "Model probability minus the no-vig (or raw) implied probability, in percentage points.",
    kelly_stake_pct: "Suggested stake as a quarter-Kelly fraction of bankroll, capped at 2%. Not betting advice.",
    confidence: "Model confidence and the sample size behind the projection.",
  };

  var BOARD_COLUMNS = [
    { key: "player", label: "Player" },
    { key: "position", label: "Pos" },
    { key: "tier", label: "Tier" },
    { key: "matchup", label: "Matchup", hideOnGame: true },
    { key: "market", label: "Market" },
    { key: "side", label: "Side" },
    { key: "line", label: "Line", num: true },
    { key: "odds_american", label: "Odds", num: true },
    { key: "book", label: "Book" },
    { key: "ev_per_100", label: "EV / $100", num: true },
    { key: "summary", label: "Summary", wrap: true },
    { key: "model_prob", label: "Model", num: true, detail: true },
    { key: "fair_odds_american", label: "Fair", num: true, detail: true },
    { key: "edge_pct", label: "Edge", num: true, detail: true },
    { key: "kelly_stake_pct", label: "Stake", num: true, detail: true },
    { key: "confidence", label: "Conf / N", detail: true },
  ];

  function $(id) { return document.getElementById(id); }

  function queryParams() {
    var q = new URLSearchParams(window.location.search);
    var week = q.get("week");
    var season = q.get("season");
    return {
      week: week != null && week !== "" ? Number(week) : null,
      season: season != null && season !== "" ? Number(season) : null,
      game: q.get("game") || null,
    };
  }

  function padWeek(week) {
    var n = Number(week);
    if (!Number.isFinite(n)) return String(week);
    return (n < 10 ? "0" : "") + String(n);
  }

  function weekFileName(season, week) {
    return String(season) + "-wk" + padWeek(week) + ".json";
  }

  function weekLabel(season, week) {
    var bits = [];
    if (season != null) bits.push(String(season));
    if (week != null) bits.push("Week " + String(week));
    return bits.join(" ") || "Week";
  }

  function manifestWeeks(manifest) {
    if (!manifest) return [];
    return (manifest.weeks || []).slice().sort(function (a, b) {
      var sa = Number(a.season) || 0, sb = Number(b.season) || 0;
      if (sa !== sb) return sb - sa;
      return (Number(b.week) || 0) - (Number(a.week) || 0);
    });
  }

  function currentFromManifest(manifest) {
    if (!manifest) return { season: null, week: null };
    var season = manifest.current_season != null ? manifest.current_season : (manifest.current && manifest.current.season);
    var week = manifest.current_week != null ? manifest.current_week : (manifest.current && manifest.current.week);
    if (season == null || week == null) {
      var weeks = manifestWeeks(manifest);
      if (weeks.length) {
        season = weeks[0].season;
        week = weeks[0].week;
      }
    }
    return { season: season, week: week };
  }

  function findWeekEntry(manifest, season, week) {
    var weeks = manifestWeeks(manifest);
    for (var i = 0; i < weeks.length; i++) {
      if (Number(weeks[i].season) === Number(season) && Number(weeks[i].week) === Number(week)) return weeks[i];
    }
    return null;
  }

  function loadManifest() {
    return P.fetchJson("data/weeks/index.json").catch(function (err) {
      if (err && err.status === 404) return null;
      throw err;
    });
  }

  function normalizeAndRows(raw) {
    var payload = P.normalizePayload(raw);
    var rows = payload.rows.map(function (r) { return P.normalizeRow(r, payload); });
    return { payload: payload, rows: rows };
  }

  function weekStem(season, week) {
    return String(season) + "-wk" + padWeek(week);
  }

  function loadFirstJson(urls) {
    function next(i) {
      if (i >= urls.length) {
        var err = new Error("not_found");
        err.status = 404;
        return Promise.reject(err);
      }
      return P.fetchJson(urls[i]).then(function (raw) {
        return { raw: raw, url: urls[i] };
      }).catch(function () {
        return next(i + 1);
      });
    }
    return next(0);
  }

  function topUrlsFor(manifest, season, week) {
    var entry = manifest ? findWeekEntry(manifest, season, week) : null;
    var stem = (season != null && week != null) ? weekStem(season, week) : null;
    var cur = currentFromManifest(manifest);
    var urls = [];
    if (entry && entry.top_file) urls.push("data/weeks/" + entry.top_file);
    if (stem) urls.push("data/weeks/" + stem + "/top.json");
    if (manifest && Number(cur.season) === Number(season) && Number(cur.week) === Number(week)) {
      urls.push("data/props_top.json");
    }
    return urls;
  }

  function passUrlsFor(manifest, season, week) {
    var entry = manifest ? findWeekEntry(manifest, season, week) : null;
    var stem = (season != null && week != null) ? weekStem(season, week) : null;
    var urls = [];
    if (entry && entry.all_file) urls.push("data/weeks/" + entry.all_file);
    if (stem) urls.push("data/weeks/" + stem + "/all.json");
    if (entry && entry.file) urls.push("data/weeks/" + entry.file);
    if (stem) urls.push("data/weeks/" + weekFileName(season, week));
    urls.push("data/props_ev.json");
    return urls;
  }

  function gameUrlsFor(manifest, season, week, gameId) {
    var entry = manifest ? findWeekEntry(manifest, season, week) : null;
    var stem = (season != null && week != null) ? weekStem(season, week) : null;
    var urls = [];
    if (!gameId) return urls;
    if (entry && entry.games_dir) urls.push("data/weeks/" + entry.games_dir + gameId + ".json");
    if (stem) urls.push("data/weeks/" + stem + "/games/" + gameId + ".json");
    return urls;
  }

  function packBoard(raw, url, manifest, season, week, passLoaded) {
    var out = normalizeAndRows(raw);
    return {
      payload: out.payload,
      rows: out.rows,
      games: (raw && raw.games && raw.games.length) ? raw.games : null,
      manifest: manifest,
      season: out.payload.season != null ? out.payload.season : season,
      week: out.payload.week != null ? out.payload.week : week,
      source: url,
      passLoaded: !!passLoaded,
      passUrls: passUrlsFor(manifest, out.payload.season != null ? out.payload.season : season, out.payload.week != null ? out.payload.week : week),
      passRowsExpected: raw && raw.pass_rows,
    };
  }

  function loadBoardData(opts) {
    opts = opts || {};
    var wantAll = !!opts.wantAll;
    var params = queryParams();
    return loadManifest().then(function (manifest) {
      var cur = currentFromManifest(manifest);
      var season = Number.isFinite(params.season) ? params.season : cur.season;
      var week = Number.isFinite(params.week) ? params.week : cur.week;
      var tops = topUrlsFor(manifest, season, week);
      var alls = passUrlsFor(manifest, season, week);
      if (wantAll) {
        return loadFirstJson(alls).then(function (got) {
          return packBoard(got.raw, got.url, manifest, season, week, true);
        });
      }
      return loadFirstJson(tops).then(function (got) {
        return packBoard(got.raw, got.url, manifest, season, week, false);
      }).catch(function () {
        return loadFirstJson(alls).then(function (got) {
          return packBoard(got.raw, got.url, manifest, season, week, true);
        });
      });
    }).catch(function () {
      return P.fetchJson("data/props_ev.json").then(function (raw) {
        return packBoard(raw, "data/props_ev.json", null, raw.season, raw.week, true);
      });
    });
  }

  function loadPassRows(board) {
    if (!board || board.passLoaded) return Promise.resolve(board);
    var urls = board.passUrls && board.passUrls.length ? board.passUrls : ["data/props_ev.json"];
    var keepGames = board.games;
    return loadFirstJson(urls).then(function (got) {
      var next = packBoard(got.raw, got.url, board.manifest, board.season, board.week, true);
      if (keepGames && keepGames.length && !(got.raw && got.raw.games && got.raw.games.length)) {
        next.games = keepGames;
      }
      return next;
    });
  }

  function loadGameData() {
    var params = queryParams();
    var gid = params.game;
    return loadManifest().then(function (manifest) {
      var cur = currentFromManifest(manifest);
      var season = Number.isFinite(params.season) ? params.season : cur.season;
      var week = Number.isFinite(params.week) ? params.week : cur.week;
      function fromRaw(raw, url, filtered) {
        var out = normalizeAndRows(raw);
        var rows = out.rows;
        if (filtered && gid) {
          rows = rows.filter(function (r) {
            return String(r.game_id || "") === String(gid) ||
              String(r.matchup || "") === String(gid) ||
              String(r.game || "") === String(gid);
          });
        }
        copyWinnerFields(raw, out.payload);
        return {
          payload: out.payload,
          rows: rows,
          manifest: manifest,
          season: out.payload.season != null ? out.payload.season : season,
          week: out.payload.week != null ? out.payload.week : week,
          source: url,
          gameId: gid,
        };
      }
      var slim = gameUrlsFor(manifest, season, week, gid);
      return loadFirstJson(slim).then(function (got) {
        return fromRaw(got.raw, got.url, false);
      }).catch(function () {
        return loadFirstJson(passUrlsFor(manifest, season, week)).then(function (got) {
          return fromRaw(got.raw, got.url, true);
        });
      });
    }).catch(function () {
      return P.fetchJson("data/props_ev.json").then(function (raw) {
        var out = normalizeAndRows(raw);
        var rows = out.rows;
        if (gid) {
          rows = rows.filter(function (r) {
            return String(r.game_id || "") === String(gid) ||
              String(r.matchup || "") === String(gid) ||
              String(r.game || "") === String(gid);
          });
        }
        return {
          payload: out.payload,
          rows: rows,
          manifest: null,
          season: out.payload.season,
          week: out.payload.week,
          source: "data/props_ev.json",
          gameId: gid,
        };
      });
    });
  }

  function fillWeekSelector(sel, manifest, season, week) {
    if (!sel) return;
    var weeks = manifestWeeks(manifest);
    if (!weeks.length) {
      if (season != null && week != null) {
        sel.innerHTML = "";
        var o = document.createElement("option");
        o.value = String(season) + "|" + String(week);
        o.textContent = weekLabel(season, week);
        o.selected = true;
        sel.appendChild(o);
        sel.disabled = true;
        sel.closest("label") && (sel.closest("label").hidden = false);
      } else if (sel.closest("label")) {
        sel.closest("label").hidden = true;
      }
      return;
    }
    sel.disabled = false;
    if (sel.closest("label")) sel.closest("label").hidden = false;
    sel.innerHTML = "";
    weeks.forEach(function (w) {
      var o = document.createElement("option");
      o.value = String(w.season) + "|" + String(w.week);
      o.textContent = weekLabel(w.season, w.week);
      if (Number(w.season) === Number(season) && Number(w.week) === Number(week)) o.selected = true;
      sel.appendChild(o);
    });
  }

  function bindWeekSelector(sel, page) {
    if (!sel || sel._boundWeek) return;
    sel._boundWeek = true;
    sel.addEventListener("change", function () {
      var parts = String(sel.value || "").split("|");
      var season = parts[0], week = parts[1];
      if (page === "game") {
        window.location.href = "index.html?season=" + encodeURIComponent(season) + "&week=" + encodeURIComponent(week) + "#games";
        return;
      }
      var url = "index.html?season=" + encodeURIComponent(season) + "&week=" + encodeURIComponent(week);
      window.location.href = url;
    });
  }

  function gameHref(season, week, gameId) {
    return "game.html?week=" + encodeURIComponent(week) + "&game=" + encodeURIComponent(gameId) +
      (season != null ? "&season=" + encodeURIComponent(season) : "");
  }

  function passingRows(rows) {
    return (rows || []).filter(function (r) { return !P.isFailed(r); });
  }

  function groupGames(rows) {
    var map = {};
    var order = [];
    passingRows(rows).forEach(function (r) {
      var id = r.game_id || r.matchup || r.game || "";
      if (!id) return;
      if (!map[id]) {
        map[id] = {
          game_id: r.game_id || id,
          matchup: r.matchup || r.game || id,
          kickoff: r.kickoff,
          picks: 0,
          strong: 0,
          lean: 0,
        };
        order.push(id);
      }
      var g = map[id];
      g.picks += 1;
      if (r.tier === "Strong") g.strong += 1;
      else if (r.tier === "Lean") g.lean += 1;
      if (r.kickoff && (!g.kickoff || String(r.kickoff) < String(g.kickoff))) g.kickoff = r.kickoff;
    });
    return order.map(function (id) { return map[id]; }).sort(function (a, b) {
      var ka = a.kickoff || "";
      var kb = b.kickoff || "";
      if (ka !== kb) return ka < kb ? -1 : 1;
      return String(a.matchup).localeCompare(String(b.matchup));
    });
  }

  function gamesForBoard(board) {
    if (board && board.games && board.games.length) {
      return board.games.slice().sort(function (a, b) {
        var ka = a.kickoff || "";
        var kb = b.kickoff || "";
        if (ka !== kb) return ka < kb ? -1 : 1;
        return String(a.matchup || "").localeCompare(String(b.matchup || ""));
      });
    }
    return groupGames(board && board.rows ? board.rows : []);
  }

  function hasGuardFlag(row) {
    var badges = row.badges || [];
    for (var i = 0; i < badges.length; i++) {
      if (badges[i] === "Check" || badges[i] === "Thin market") return true;
    }
    return false;
  }

  function tierRank(row) {
    if (row.tier === "Strong") return 0;
    if (row.tier === "Lean") return 1;
    return 2;
  }

  function sortGamePicks(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var fa = hasGuardFlag(a) ? 1 : 0;
      var fb = hasGuardFlag(b) ? 1 : 0;
      if (fa !== fb) return fa - fb;
      var ta = tierRank(a);
      var tb = tierRank(b);
      if (ta !== tb) return ta - tb;
      var ea = Number.isFinite(a.ev_per_100) ? a.ev_per_100 : -Infinity;
      var eb = Number.isFinite(b.ev_per_100) ? b.ev_per_100 : -Infinity;
      if (ea !== eb) return eb - ea;
      return String(a.player || "").localeCompare(String(b.player || ""));
    });
  }

  function unique(rows, key) {
    var set = {};
    var out = [];
    (rows || []).forEach(function (r) {
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

  function tipButton(key) {
    var text = COLUMN_TIPS[key];
    if (!text) return "";
    return '<button type="button" class="tip" aria-expanded="false" aria-label="About ' + P.escapeHtml(key) + '">?<span class="tip-bubble" role="tooltip">' + P.escapeHtml(text) + "</span></button>";
  }

  function bindTooltips(root) {
    if (!root || root._tipsBound) return;
    root._tipsBound = true;
    function closeAll() {
      root.querySelectorAll(".tip[aria-expanded='true']").forEach(function (b) {
        b.setAttribute("aria-expanded", "false");
      });
    }
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".tip");
      if (!btn) {
        closeAll();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      var open = btn.getAttribute("aria-expanded") === "true";
      closeAll();
      if (!open) btn.setAttribute("aria-expanded", "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });
  }

  function tierBadge(row) {
    var html = "";
    if (row.tier) {
      html += '<span class="badge tier-' + P.escapeHtml(String(row.tier).toLowerCase()) + '">' + P.escapeHtml(row.tier) + "</span>";
    }
    (row.badges || []).forEach(function (b) {
      var extra = b === "Check" ? " check" : b === "Thin market" ? " thin" : "";
      html += ' <span class="badge' + extra + '">' + P.escapeHtml(b) + "</span>";
    });
    return html || "—";
  }

  function confCell(row) {
    var parts = [];
    if (row.confidence) parts.push(P.escapeHtml(String(row.confidence)));
    if (row.sample_size != null) parts.push("n=" + P.escapeHtml(String(row.sample_size)));
    return parts.join(" · ") || "—";
  }

  function visibleColumns(opts) {
    opts = opts || {};
    return BOARD_COLUMNS.filter(function (c) {
      if (opts.hideMatchup && c.hideOnGame) return false;
      if (!opts.moreDetails && c.detail) return false;
      return true;
    });
  }

  function renderThead(cols, sortKey, sortDir) {
    return "<tr>" + cols.map(function (c) {
      var sort = c.key === sortKey ? ' aria-sort="' + (sortDir === "asc" ? "ascending" : "descending") + '"' : "";
      var cls = ((c.num ? " num" : "") + (c.wrap ? " wrap" : "") + (c.detail ? " detail" : "")).trim();
      return '<th scope="col" data-key="' + c.key + '" class="' + cls + '"' + sort + ">" +
        P.escapeHtml(c.label) + tipButton(c.key) + "</th>";
    }).join("") + "</tr>";
  }

  function renderRow(r, cols, opts) {
    opts = opts || {};
    var failed = P.isFailed(r) ? " failed" : "";
    var liq = P.liquidityLine(r);
    var chips = opts.hideMatchup ? "" : P.contextChips(r);
    var matchup = P.escapeHtml(r.matchup || "—") +
      (r.kickoff ? '<span class="sub">' + P.escapeHtml(P.formatKickoff(r.kickoff)) + "</span>" : "") +
      chips;
    var book = P.escapeHtml(r.book || "—") +
      (liq ? '<span class="sub">' + P.escapeHtml(liq) + "</span>" : "");
    var sideCls = r.side === "over" ? "pill over" : r.side === "under" ? "pill under" : "pill";
    var why = P.escapeHtml(r.summary || r.drivers || "—");
    if (opts.moreDetails && r.summary && r.drivers && r.summary !== r.drivers) {
      why += '<span class="sub">' + P.escapeHtml(r.drivers) + "</span>";
    }
    var map = {
      player: '<td><span class="player-cell">' + P.escapeHtml(r.player || "—") + "</span>" +
        (r.team ? '<span class="sub">' + P.escapeHtml(r.team + (r.opponent ? " vs " + r.opponent : "")) + "</span>" : "") +
        "</td>",
      position: '<td class="pos">' + P.escapeHtml(r.position || "—") + "</td>",
      tier: "<td>" + tierBadge(r) + "</td>",
      matchup: '<td class="wrap">' + matchup + "</td>",
      market: "<td>" + P.escapeHtml(P.marketLabel(r.market)) + "</td>",
      side: "<td><span class=\"" + sideCls + "\">" + P.escapeHtml(r.side || "—") + "</span></td>",
      line: '<td class="num">' + (r.line != null ? r.line : "—") + "</td>",
      odds_american: '<td class="num">' + P.formatAmerican(r.odds_american) + "</td>",
      book: "<td>" + book + "</td>",
      ev_per_100: '<td class="num ' + P.evClass(r.ev_per_100) + '">' + P.formatMoney(r.ev_per_100) + "</td>",
      summary: '<td class="wrap">' + why + "</td>",
      model_prob: '<td class="num detail">' + P.formatProb(r.model_prob) + "</td>",
      fair_odds_american: '<td class="num detail">' + P.formatAmerican(r.fair_odds_american) + "</td>",
      edge_pct: '<td class="num detail ' + P.edgeClass(r.edge_pct) + '">' + P.formatSignedPct(r.edge_pct) + "</td>",
      kelly_stake_pct: '<td class="num detail">' + (Number.isFinite(r.kelly_stake_pct) ? r.kelly_stake_pct.toFixed(2) + "%" : "—") + "</td>",
      confidence: '<td class="detail">' + confCell(r) + "</td>",
    };
    var cells = cols.map(function (c) { return map[c.key] || "<td>—</td>"; });
    return '<tr class="' + failed.trim() + '">' + cells.join("") + "</tr>";
  }

  function renderTable(thead, tbody, rows, opts) {
    opts = opts || {};
    var cols = visibleColumns(opts);
    thead.innerHTML = renderThead(cols, opts.sortKey, opts.sortDir);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="muted">No props match the current filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) { return renderRow(r, cols, opts); }).join("");
  }

  function renderCards(root, rows, opts) {
    opts = opts || {};
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = '<div class="empty-state">No props match the current filters.</div>';
      return;
    }
    root.innerHTML = rows.map(function (r) {
      var failed = P.isFailed(r) ? " failed" : "";
      var liq = P.liquidityLine(r);
      var chips = P.contextChips(r);
      var sideCls = r.side === "over" ? "pill over" : r.side === "under" ? "pill under" : "pill";
      function cell(label, value, cls, detail) {
        return '<div' + (detail ? ' class="detail-only"' : "") + '><span class="label">' + label + '</span><span class="' + (cls || "") + '">' + value + "</span></div>";
      }
      return (
        '<article class="card' + failed + (opts.moreDetails ? "" : " compact") + '">' +
          '<div class="card-top">' +
            "<div>" +
              '<div class="player-cell">' + P.escapeHtml(r.player || "—") +
                ' <span class="pos">' + P.escapeHtml(r.position || "") + "</span> " + tierBadge(r) + "</div>" +
              (opts.hideMatchup ? "" : ('<div class="sub">' + P.escapeHtml(r.matchup || "") +
                (r.kickoff ? " · " + P.escapeHtml(P.formatKickoff(r.kickoff)) : "") + "</div>")) +
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
            cell("Model", P.formatProb(r.model_prob), "", true) +
            cell("Fair", P.formatAmerican(r.fair_odds_american), "", true) +
            cell("Edge", P.formatSignedPct(r.edge_pct), P.edgeClass(r.edge_pct), true) +
            cell("Stake", Number.isFinite(r.kelly_stake_pct) ? r.kelly_stake_pct.toFixed(2) + "% bankroll" : "—", "", true) +
            (liq ? cell("Liquidity", P.escapeHtml(liq), "", true) : "") +
            cell("Conf / N", confCell(r), "", true) +
          "</div>" +
          ((r.summary || r.drivers) ? '<div class="card-why">' + P.escapeHtml(r.summary || r.drivers) + "</div>" : "") +
        "</article>"
      );
    }).join("");
  }

  function copyWinnerFields(from, to) {
    if (!from || !to) return to;
    ["likely_winner", "likely_winner_prob", "home_win_prob", "away_win_prob",
     "winner_source", "winner_source_label", "winner_tooltip", "winner_updated_at",
     "winner_n_books", "home_team", "away_team", "matchup", "kickoff", "game_id",
     "market", "model", "model_winner", "model_winner_prob", "model_source_label",
     "model_tooltip", "model_updated_at", "model_home_win_prob", "model_away_win_prob"].forEach(function (k) {
      if (from[k] != null && to[k] == null) to[k] = from[k];
    });
    return to;
  }

  function tipButtonText(text, ariaLabel) {
    if (!text) return "";
    return '<button type="button" class="tip" aria-expanded="false" aria-label="' +
      P.escapeHtml(ariaLabel) + '">?<span class="tip-bubble" role="tooltip">' +
      P.escapeHtml(text) + "</span></button>";
  }

  function oneWinnerLine(prefix, team, prob, tip, ariaLabel, cls) {
    if (!team || prob == null) return "";
    var pct = Math.round(Number(prob) * 100);
    if (!Number.isFinite(pct) || pct <= 50) return "";
    return (
      '<div class="' + (cls || "game-winner") + '">' + P.escapeHtml(prefix) +
      ": <strong>" + P.escapeHtml(String(team)) + " (" + pct + "%)</strong>" +
      tipButtonText(tip, ariaLabel) + "</div>"
    );
  }

  function winnerLineHtml(g) {
    if (!g) return "";
    var model = g.model || {};
    var modelTeam = model.likely_winner || g.model_winner;
    var modelProb = model.likely_winner_prob != null ? model.likely_winner_prob : g.model_winner_prob;
    var modelTip = model.tooltip || model.winner_tooltip || g.model_tooltip || "";
    return oneWinnerLine(
      "Our model",
      modelTeam,
      modelProb,
      modelTip,
      "About our win model",
      "game-winner game-winner-model"
    );
  }

  function mergeWinner(target, rec) {
    if (!target || !rec) return target;
    ["likely_winner", "likely_winner_prob", "home_win_prob", "away_win_prob",
     "winner_source", "winner_source_label", "winner_tooltip", "winner_updated_at",
     "winner_n_books", "home_team", "away_team", "market", "model",
     "model_winner", "model_winner_prob", "model_source_label", "model_tooltip",
     "model_updated_at", "model_home_win_prob", "model_away_win_prob"].forEach(function (k) {
      if (rec[k] != null) target[k] = rec[k];
    });
    return target;
  }

  function winnersUrl(season, week) {
    if (season == null || week == null) return null;
    return "data/weeks/" + weekStem(season, week) + "/winners.json";
  }

  function loadWinners(season, week) {
    var url = winnersUrl(season, week);
    if (!url) return Promise.resolve(null);
    return P.fetchJson(url).catch(function () { return null; });
  }

  function winnerForGame(winners, gameId, matchup) {
    if (!winners || !winners.games) return null;
    var gid = String(gameId || "");
    var mu = String(matchup || "");
    for (var i = 0; i < winners.games.length; i++) {
      var rec = winners.games[i];
      if (gid && String(rec.game_id || "") === gid) return rec;
      if (mu && String(rec.matchup || "") === mu) return rec;
    }
    return null;
  }

  function renderGames(root, games, season, week) {
    if (!root) return;
    if (!games.length) {
      root.innerHTML = '<div class="empty-state">No games in this week.</div>';
      return;
    }
    root.innerHTML = games.map(function (g) {
      var href = gameHref(season, week, g.game_id);
      var winner = winnerLineHtml(g);
      return (
        '<div class="game-card">' +
          '<a class="game-card-link" href="' + P.escapeHtml(href) + '">' +
            '<div class="game-card-matchup">' + P.escapeHtml(g.matchup) + "</div>" +
            '<div class="sub">' + P.escapeHtml(g.kickoff ? P.formatKickoff(g.kickoff) : "") + "</div>" +
          "</a>" +
          winner +
          '<a class="game-card-link" href="' + P.escapeHtml(href) + '">' +
            '<div class="game-card-counts">' +
              P.escapeHtml(String(g.picks)) + " pick" + (g.picks === 1 ? "" : "s") +
              " · <strong>" + g.strong + " Strong</strong>" +
              " · <strong>" + g.lean + " Lean</strong>" +
            "</div>" +
          "</a>" +
        "</div>"
      );
    }).join("");
  }

  function showMeta(node, payload, rows) {
    if (!node) return;
    var bits = [];
    if (payload.season != null) bits.push("Season <strong>" + P.escapeHtml(String(payload.season)) + "</strong>");
    if (payload.week != null) bits.push("Week <strong>" + P.escapeHtml(String(payload.week)) + "</strong>");
    var ts = P.lastUpdated(payload, rows);
    bits.push("Last updated <strong>" + P.escapeHtml(P.formatET(ts)) + "</strong>");
    node.innerHTML = bits.join('<span class="muted"> · </span>');
  }

  function showSampleBanner(node, payload) {
    if (!node) return;
    if (payload && payload.sample) {
      node.hidden = false;
      node.className = "banner sample";
      node.innerHTML = "<strong>Sample data, model outputs not published yet.</strong> These numbers are placeholders — not real edges, probabilities, or betting recommendations.";
    } else {
      node.hidden = true;
      node.textContent = "";
    }
  }

  var PAGE_SIZE = 100;

  global.PropsBoard = {
    PAGE_SIZE: PAGE_SIZE,
    BOARD_COLUMNS: BOARD_COLUMNS,
    COLUMN_TIPS: COLUMN_TIPS,
    queryParams: queryParams,
    weekFileName: weekFileName,
    weekLabel: weekLabel,
    loadBoardData: loadBoardData,
    loadPassRows: loadPassRows,
    loadGameData: loadGameData,
    loadWinners: loadWinners,
    winnerForGame: winnerForGame,
    mergeWinner: mergeWinner,
    fillWeekSelector: fillWeekSelector,
    bindWeekSelector: bindWeekSelector,
    gameHref: gameHref,
    passingRows: passingRows,
    groupGames: groupGames,
    gamesForBoard: gamesForBoard,
    hasGuardFlag: hasGuardFlag,
    sortGamePicks: sortGamePicks,
    unique: unique,
    bindTooltips: bindTooltips,
    tierBadge: tierBadge,
    visibleColumns: visibleColumns,
    renderTable: renderTable,
    renderCards: renderCards,
    renderGames: renderGames,
    winnerLineHtml: winnerLineHtml,
    showMeta: showMeta,
    showSampleBanner: showSampleBanner,
  };
})(window);
