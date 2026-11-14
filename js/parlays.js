/* Same-game and cross-game parlays. Hidden when the published parlays file is absent.
   Published source is data/parlays.json / data/weeks/<wk>/parlays.json only. */
(function (global) {
  "use strict";
  var P = global.PropsEV;

  var TYPE_LABELS = {
    safest: "Safest",
    "best payout": "Best payout",
    best_payout: "Best payout",
    "best-payout": "Best payout",
    bestpayout: "Best payout",
    "cross-game": "Cross-game",
    cross_game: "Cross-game",
    "cross game": "Cross-game",
    crossgame: "Cross-game"
  };

  var CAVEAT = "Legs from the same game are correlated and simulated jointly. A sportsbook's same-game parlay price is usually worse than shown; compare with the real quote. These parlays are unproven until grading.";

  function typeLabel(t) {
    if (t == null || t === "") return "Parlay";
    var key = String(t).toLowerCase().trim();
    return TYPE_LABELS[key] || String(t);
  }

  function typeKey(t) {
    var k = String(t || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (k === "bestpayout") k = "best_payout";
    if (k === "crossgame") k = "cross_game";
    return k;
  }

  function isCross(t) {
    return typeKey(t) === "cross_game";
  }

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

  function normalizeLeg(raw) {
    raw = raw || {};
    return {
      player: pick(raw, ["player", "player_name", "name"]) || "",
      market: P ? P.canonicalMarket(pick(raw, ["market"]) || "") : (pick(raw, ["market"]) || ""),
      side: String(pick(raw, ["side"]) || "").toLowerCase(),
      line: num(pick(raw, ["line"])),
      odds: num(pick(raw, ["odds_american", "odds", "price", "american_odds"])),
      book: pick(raw, ["book"]) || "",
      game_id: pick(raw, ["game_id"]) || "",
      matchup: pick(raw, ["matchup", "game"]) || ""
    };
  }

  function normalizeParlay(raw, fallbackGameId) {
    raw = raw || {};
    var legs = raw.legs || raw.picks || raw.selections || [];
    if (!Array.isArray(legs)) legs = [];
    var ev = num(pick(raw, ["ev_per_100", "ev", "ev100", "expected_value_per_100"]));
    var joint = num(pick(raw, ["joint_hit_chance", "joint_hit_prob", "joint_prob", "hit_prob", "p_joint", "joint_hit", "p_hit", "prob"]));
    if (joint != null && joint > 1) joint = joint / 100;
    var payout = num(pick(raw, ["payout_american", "american_payout", "payout", "payout_to_100", "decimal_payout", "payout_decimal"]));
    var typ = pick(raw, ["type", "kind", "category", "label"]) || "";
    return {
      type: typ,
      type_key: typeKey(typ),
      type_label: typeLabel(typ),
      legs: legs.map(normalizeLeg),
      joint_hit_chance: joint,
      payout: payout,
      ev_per_100: ev,
      game_id: pick(raw, ["game_id"]) || fallbackGameId || "",
      matchup: pick(raw, ["matchup", "game"]) || "",
      note: pick(raw, ["note", "caveat"]) || ""
    };
  }

  function listFrom(val, gameId) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(function (p) { return normalizeParlay(p, gameId); });
    if (Array.isArray(val.parlays)) return val.parlays.map(function (p) { return normalizeParlay(p, gameId); });
    if (Array.isArray(val.slips)) return val.slips.map(function (p) { return normalizeParlay(p, gameId); });
    if (typeof val === "object") {
      // maybe { safest: {...}, best_payout: {...} }
      var keys = Object.keys(val);
      var typed = keys.filter(function (k) { return TYPE_LABELS[k] || TYPE_LABELS[k.replace(/_/g, " ")]; });
      if (typed.length && typed.length === keys.length) {
        return typed.map(function (k) {
          var rec = val[k];
          if (rec && typeof rec === "object" && rec.type == null) rec = Object.assign({ type: k }, rec);
          else if (rec && typeof rec === "object") rec = Object.assign({}, rec, { type: rec.type || k });
          return normalizeParlay(rec, gameId);
        });
      }
    }
    return [];
  }

  function parsePayload(data) {
    var byGame = {};
    var cross = [];
    var payload = data || {};
    if (Array.isArray(payload)) {
      payload.forEach(function (p) {
        var rec = normalizeParlay(p, p && p.game_id);
        if (isCross(rec.type) || (!rec.game_id && rec.legs.length > 1 && rec.legs.some(function (l, i, a) { return l.game_id && a[0].game_id && l.game_id !== a[0].game_id; }))) {
          cross.push(rec);
        } else if (rec.game_id) {
          (byGame[rec.game_id] || (byGame[rec.game_id] = [])).push(rec);
        } else {
          cross.push(rec);
        }
      });
      return { byGame: byGame, cross: cross, payload: payload };
    }

    var gameMap = payload.games || payload.by_game || payload.game_parlays || payload.same_game || payload.sgp || null;
    if (gameMap && typeof gameMap === "object" && !Array.isArray(gameMap)) {
      Object.keys(gameMap).forEach(function (gid) {
        byGame[gid] = listFrom(gameMap[gid], gid);
      });
    } else if (Array.isArray(gameMap)) {
      gameMap.forEach(function (g) {
        var gid = (g && (g.game_id || g.id)) || "";
        listFrom(g, gid).forEach(function (p) {
          var id = p.game_id || gid;
          if (!id) return;
          (byGame[id] || (byGame[id] = [])).push(p);
        });
      });
    }

    var all = payload.parlays || payload.slips || payload.items;
    if (Array.isArray(all)) {
      all.forEach(function (p) {
        var rec = normalizeParlay(p, p && p.game_id);
        if (isCross(rec.type)) cross.push(rec);
        else if (rec.game_id) (byGame[rec.game_id] || (byGame[rec.game_id] = [])).push(rec);
        else cross.push(rec);
      });
    }

    var crossSrc = payload.cross_game || payload.cross_game_parlays || payload.cross || payload.cross_games;
    if (crossSrc) {
      listFrom(crossSrc, "").forEach(function (p) { cross.push(p); });
    }

    return { byGame: byGame, cross: cross, payload: payload };
  }

  function formatJoint(p) {
    if (p == null || !Number.isFinite(p)) return "—";
    return P.formatProb(p);
  }

  function formatPayout(v) {
    if (v == null || !Number.isFinite(v)) return "—";
    // American odds if reasonably in that range; otherwise treat as dollars-to-100 or decimal.
    if (Math.abs(v) >= 100 && Math.abs(v) === Math.round(Math.abs(v))) {
      return P.formatAmerican(v);
    }
    if (v > 1 && v < 100) {
      // decimal odds like 3.5
      return v.toFixed(2) + "x";
    }
    return P.formatAmerican(v);
  }

  function formatEv(v) {
    if (v == null || !Number.isFinite(v)) return "—";
    return P.formatMoney(v);
  }

  function legText(leg) {
    var market = P.marketLabel(leg.market) || leg.market || "prop";
    var bits = [];
    if (leg.player) bits.push(leg.player);
    if (leg.side && leg.line != null) bits.push(leg.side + " " + leg.line + " " + market);
    else if (leg.side) bits.push(leg.side + " " + market);
    else bits.push(market);
    if (leg.odds != null) bits.push(P.formatAmerican(leg.odds));
    return bits.join(" · ");
  }

  function typeOrder(k) {
    if (k === "safest") return 0;
    if (k === "best_payout") return 1;
    if (k === "cross_game") return 2;
    return 3;
  }

  function parlayCard(p) {
    var legs = (p.legs || []).map(function (leg) {
      return "<li>" + P.escapeHtml(legText(leg)) +
        (leg.matchup ? '<span class="sub"> ' + P.escapeHtml(leg.matchup) + "</span>" : "") +
        "</li>";
    }).join("");
    return (
      '<article class="parlay-card">' +
        '<div class="parlay-top">' +
          '<h3>' + P.escapeHtml(p.type_label) + "</h3>" +
          '<div class="parlay-metrics">' +
            '<div><span class="label">Hit chance</span><span>' + formatJoint(p.joint_hit_chance) + "</span></div>" +
            '<div><span class="label">Payout</span><span>' + P.escapeHtml(String(formatPayout(p.payout))) + "</span></div>" +
            '<div><span class="label">EV / $100</span><span class="sublabel">model estimate, unproven</span><span class="' + P.evClass(p.ev_per_100) + '">' + formatEv(p.ev_per_100) + "</span></div>" +
          "</div>" +
        "</div>" +
        (legs ? '<ul class="parlay-legs">' + legs + "</ul>" : "") +
      "</article>"
    );
  }

  function sectionHtml(title, parlays, opts) {
    opts = opts || {};
    var list = (parlays || []).slice().sort(function (a, b) {
      var d = typeOrder(a.type_key) - typeOrder(b.type_key);
      if (d) return d;
      var ea = Number.isFinite(a.ev_per_100) ? a.ev_per_100 : -Infinity;
      var eb = Number.isFinite(b.ev_per_100) ? b.ev_per_100 : -Infinity;
      return eb - ea;
    });
    if (!list.length) return "";
    var banner = (P && P.SITE_BACKTEST_BANNER) || "Backtested on 2026 weeks 1–9 at Kalshi prices: break-even. Picks are a paper test, not proven profit.";
    var href = (P && P.SITE_BACKTEST_HREF) || "track-record.html#kalshi-backtest";
    return '<section class="panel parlay-panel" id="' + P.escapeHtml(opts.id || "parlays-panel") + '">' +
      "<h2>" + P.escapeHtml(title) + "</h2>" +
      '<a class="site-backtest-banner" href="' + P.escapeHtml(href) + '">' + P.escapeHtml(banner) + "</a>" +
      '<div class="parlay-list">' + list.map(parlayCard).join("") + "</div>" +
      '<p class="panel-note">' + P.escapeHtml(CAVEAT) + "</p>" +
    "</section>";
  }

  function padWeek(week) {
    var n = Number(week);
    if (!Number.isFinite(n)) return String(week);
    return (n < 10 ? "0" : "") + String(n);
  }

  function urlsFor(season, week) {
    var urls = [];
    if (season != null && week != null) {
      urls.push("data/weeks/" + String(season) + "-wk" + padWeek(week) + "/parlays.json");
    }
    urls.push("data/parlays.json");
    return urls;
  }

  function fetchFirst(urls) {
    var chain = Promise.reject(new Error("start"));
    urls.forEach(function (url) {
      chain = chain.catch(function () { return P.fetchJson(url); });
    });
    return chain;
  }

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.innerHTML = "";
  }

  function renderInto(el, title, parlays, opts) {
    if (!el) return;
    var html = sectionHtml(title, parlays, opts);
    if (!html) {
      hide(el);
      return;
    }
    el.hidden = false;
    el.innerHTML = html;
  }

  var cache = {};

  function load(season, week) {
    var key = String(season || "") + "|" + String(week || "");
    if (cache[key]) return cache[key];
    cache[key] = fetchFirst(urlsFor(season, week))
      .then(parsePayload)
      .catch(function () { return null; });
    return cache[key];
  }

  function fillGame(el, gameId, season, week) {
    if (!el) return Promise.resolve();
    if (!gameId) { hide(el); return Promise.resolve(); }
    return load(season, week).then(function (parsed) {
      if (!parsed) { hide(el); return; }
      var list = parsed.byGame[gameId] || parsed.byGame[String(gameId)] || [];
      // also match if payload games keyed loosely
      if (!list.length) {
        Object.keys(parsed.byGame).forEach(function (k) {
          if (String(k) === String(gameId)) list = parsed.byGame[k];
        });
      }
      renderInto(el, "Parlays", list, { id: "game-parlays-panel" });
    });
  }

  function fillCross(el, season, week) {
    if (!el) return Promise.resolve();
    return load(season, week).then(function (parsed) {
      if (!parsed || !parsed.cross || !parsed.cross.length) { hide(el); return; }
      renderInto(el, "Cross-game parlays", parsed.cross, { id: "cross-parlays-panel" });
    });
  }

  global.PropsParlays = {
    parsePayload: parsePayload,
    normalizeParlay: normalizeParlay,
    sectionHtml: sectionHtml,
    fillGame: fillGame,
    fillCross: fillCross,
    load: load,
    CAVEAT: CAVEAT
  };
})(window);
