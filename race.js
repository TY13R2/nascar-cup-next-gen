"use strict";
/* Racetrack hero. Twelve cars, one per team group, circle an oval. Their ORDER is the rank by average
   finish for the chosen season or period (best = out front); spacing between cars is the same for everyone and
   is not to scale. The leaderboard beside the track carries the real numbers. Motion is decoration only. */

var Race = (function () {
  var NS = "http://www.w3.org/2000/svg";

  var SPANS = [
    { key: "2019", label: "2019", seasons: [2019], cap: "Season" },
    { key: "2020", label: "2020", seasons: [2020], cap: "Season" },
    { key: "2021", label: "2021", seasons: [2021], cap: "Season" },
    { key: "2022", label: "2022", seasons: [2022], cap: "Season" },
    { key: "2023", label: "2023", seasons: [2023], cap: "Season" },
    { key: "2024", label: "2024", seasons: [2024], cap: "Season" },
    { key: "gen6", label: "Gen 6 · 2019–2021", big: "2019–21", seasons: [2019, 2020, 2021], cap: "Gen 6 car" },
    { key: "nextgen", label: "Next Gen · 2022–2024", big: "2022–24", seasons: [2022, 2023, 2024], cap: "Next Gen car" }
  ];

  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  function init(rows, T, host) {
    var groups = T.map(function (t) { return t.group; });
    var TB = {}; T.forEach(function (t) { TB[t.group] = t; });

    /* ----- standings for every season and period ----- */
    var stand = {}, spanBy = {};
    SPANS.forEach(function (sp) {
      spanBy[sp.key] = sp;
      var arr = groups.map(function (g) {
        var s = summarize(rows.filter(function (r) { return r.group === g && sp.seasons.indexOf(r.season) >= 0; }));
        return { group: g, n: s.n, finish: s.finish };
      });
      arr.sort(function (a, b) { return a.finish - b.finish || (a.group < b.group ? -1 : 1); });
      arr.forEach(function (x, i) {
        x.rank = i;                                                    // car position (ties are placed alphabetically)
        var tied = (i > 0 && x.finish === arr[i - 1].finish) || (i < arr.length - 1 && x.finish === arr[i + 1].finish);
        x.place = i > 0 && x.finish === arr[i - 1].finish ? arr[i - 1].place : i + 1;   // tied teams share a place
        x.tie = tied;
      });
      stand[sp.key] = arr;
    });
    function placeIn(key, g) { var x = stand[key].filter(function (y) { return y.group === g; })[0]; return x.place; }
    function placeText(x) { return x.place + (x.tie ? "=" : ""); }

    var state = { span: "gen6", sel: null, hot: null, narrow: false, motion: !REDUCED_MOTION, playing: false };
    var cur = {}, tgt = {}, base = 0, raf = 0, last = 0, onScreen = true, playTimer = 0, track = null;
    var carEls = {};

    /* ----- DOM scaffold ----- */
    host.className = "race";
    host.setAttribute("aria-labelledby", "race-h");
    host.textContent = "";
    host.appendChild(el("h2", { id: "race-h", text: "The 12 teams, season by season" }));
    host.appendChild(el("p", { "class": "note", text: "Cars are ordered by average finish in the season or period you pick, best out front. The gaps between cars are the same for everyone; the leaderboard has the real numbers. Rows counted: " + int(rows.length) + " driver-race results, 2019–2024; each view uses the results from its own seasons." }));

    var seg = el("div", { "class": "seg", role: "radiogroup", "aria-label": "Season or period" });
    var segInputs = {};
    SPANS.forEach(function (sp) {
      var inp = el("input", { type: "radio", name: "race-span", value: sp.key });
      inp.addEventListener("change", function () { if (inp.checked) { stopPlay(); setSpan(sp.key); } });
      segInputs[sp.key] = inp;
      seg.appendChild(el("label", {}, [inp, el("span", { text: sp.label })]));
    });
    var playBtn = el("button", { "class": "btn", type: "button", "aria-pressed": "false", text: "▶ Play seasons" });
    var motionBtn = el("button", { "class": "btn", type: "button", "aria-pressed": "false", text: "Pause motion" });

    var input = el("input", { id: "team-search", type: "text", role: "combobox", "aria-expanded": "false", "aria-controls": "team-list",
      "aria-autocomplete": "list", autocomplete: "off", placeholder: "Find a team…", "aria-label": "Find a team" });
    var list = el("ul", { id: "team-list", role: "listbox", "aria-label": "Teams", hidden: "hidden" });
    var combo = el("div", { "class": "combo" }, [input, list]);

    host.appendChild(el("div", { "class": "race-controls" }, [seg, playBtn, motionBtn, combo]));

    var trackWrap = el("div", { "class": "track-wrap" });
    var board = el("ol", { "class": "board", "aria-label": "Leaderboard by average finish" });
    host.appendChild(el("div", { "class": "race-body" }, [trackWrap, board]));
    var spot = el("div", { "class": "spot", "aria-live": "polite" });
    host.appendChild(spot);

    /* ----- the track ----- */
    function buildTrack(narrow) {
      state.narrow = narrow;
      trackWrap.textContent = "";
      var P = narrow
        ? { VW: 600, VH: 400, m: 50, tw: 54, gap: 92, pillW: 66, pillH: 26, font: 15, carS: 1.45, big: 84, cap: 17 }
        : { VW: 1000, VH: 440, m: 56, tw: 62, gap: 124, pillW: 54, pillH: 19, font: 11.5, carS: 1.05, big: 100, cap: 15 };
      var w = P.VW - 2 * P.m, h = P.VH - 2 * P.m, r = h / 2;
      var d = "M" + (P.m + r) + "," + (P.m + h) + " H" + (P.m + w - r) + " A" + r + "," + r + " 0 0 0 " + (P.m + w - r) + "," + P.m +
              " H" + (P.m + r) + " A" + r + "," + r + " 0 0 0 " + (P.m + r) + "," + (P.m + h) + " Z";
      var s = svg("svg", { viewBox: "0 0 " + P.VW + " " + P.VH, role: "img",
        "aria-label": "Animated oval racetrack with one car for each of the 12 team groups, ordered by average finish. The leaderboard beside it lists the same order." }, trackWrap);

      var defs = svg("defs", {}, s);
      var pat = svg("pattern", { id: "chk", width: 12, height: 12, patternUnits: "userSpaceOnUse" }, defs);
      svg("rect", { width: 12, height: 12, fill: "#f2f2ee" }, pat);
      svg("rect", { width: 6, height: 6, fill: "#111" }, pat);
      svg("rect", { x: 6, y: 6, width: 6, height: 6, fill: "#111" }, pat);

      svg("path", { d: d, "class": "infield" }, s);
      svg("path", { d: d, "class": "track-edge", "stroke-width": P.tw + 7 }, s);
      svg("path", { d: d, "class": "track-asphalt", "stroke-width": P.tw }, s);
      var line = svg("path", { d: d, "class": "track-center" }, s);
      var L = line.getTotalLength();

      // start / finish line across the middle of the bottom straight
      svg("rect", { x: P.m + w / 2 - 6, y: P.m + h - P.tw / 2, width: 12, height: P.tw, fill: "url(#chk)" }, s);

      var yr = svg("text", { x: P.VW / 2, y: P.VH / 2 + 4, "class": "year-big", "font-size": P.big }, s);
      var cp = svg("text", { x: P.VW / 2, y: P.VH / 2 + 4 + P.cap * 2.1, "class": "year-cap", "font-size": P.cap }, s);

      carEls = {};
      var carsG = svg("g", {}, s);
      groups.forEach(function (g) {
        var color = teamColor(g);
        var car = svg("g", { "class": "car", tabindex: 0, role: "button", "aria-label": g }, carsG);
        var body = svg("g", {}, car);                                   // rotates with the track
        svg("path", { d: "M-17,-6.5 Q-17,-8 -15,-8 H10 Q17,-8 17,0 Q17,8 10,8 H-15 Q-17,8 -17,6.5 Z", fill: color, "class": "car-body", transform: "scale(" + P.carS + ")" }, body);
        svg("rect", { x: 1 * P.carS, y: -5 * P.carS, width: 7 * P.carS, height: 10 * P.carS, rx: 2, "class": "car-glass" }, body);
        var pill = svg("g", {}, car);                                   // stays upright above the car
        svg("rect", { x: -P.pillW / 2, y: -P.pillH / 2, width: P.pillW, height: P.pillH, rx: P.pillH / 2, "class": "pill-bg", stroke: color }, pill);
        var txt = svg("text", { "class": "pill-text", "font-size": P.font, y: 1 }, pill);
        car.addEventListener("pointerenter", function () { setHot(g); });
        car.addEventListener("pointerleave", function () { setHot(null); });
        car.addEventListener("focus", function () { setHot(g); });
        car.addEventListener("blur", function () { setHot(null); });
        car.addEventListener("click", function () { choose(g); });
        car.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(g); } });
        carEls[g] = { car: car, body: body, pill: pill, txt: txt };
      });
      track = { svg: s, path: line, L: L, P: P, yr: yr, cp: cp, lift: P.pillH / 2 + 10 * P.carS };
      paintTexts();            // callers set the targets and then place the cars
    }

    function place(g) {
      var t = track, c = carEls[g];
      var dist = (((base - cur[g]) % t.L) + t.L) % t.L;
      var p = t.path.getPointAtLength(dist), q = t.path.getPointAtLength((dist + 1) % t.L);
      var ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      c.body.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ") rotate(" + ang.toFixed(1) + ")");
      c.pill.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + (p.y - t.lift).toFixed(1) + ")");
    }
    function placeAll() { groups.forEach(place); }

    function paintTexts() {
      var sp = spanBy[state.span];
      track.yr.textContent = sp.big || sp.label;
      track.cp.textContent = sp.cap + " · best average finish leads";
      stand[state.span].forEach(function (x) {
        carEls[x.group].txt.textContent = placeText(x) + " " + teamAbbr(x.group);
        carEls[x.group].car.setAttribute("aria-label", x.group + ", " + (x.tie ? "tied for " : "") + ordinal(x.place) + ", average finish " + f2(x.finish));
      });
    }

    /* ----- animation loop ----- */
    function frame(ts) {
      raf = 0;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
      last = ts;
      var moving = state.motion && onScreen && !document.hidden;
      if (moving) base = (base + track.L / 26 * dt) % track.L;
      var settled = true, k = 1 - Math.exp(-dt / 0.28);
      groups.forEach(function (g) {
        var diff = tgt[g] - cur[g];
        if (Math.abs(diff) > 0.4) { cur[g] += diff * k; settled = false; } else cur[g] = tgt[g];
      });
      placeAll();
      if (moving || !settled) schedule();
      else last = 0;
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(frame); }

    /* ----- state changes ----- */
    function setTargets(snap) {
      stand[state.span].forEach(function (x) { tgt[x.group] = x.rank * track.P.gap; if (snap || cur[x.group] === undefined) cur[x.group] = tgt[x.group]; });
    }
    function setSpan(key) {
      state.span = key;
      segInputs[key].checked = true;
      setTargets(!state.motion);
      paintTexts();
      renderBoard();
      writeHash();
      schedule();
    }
    function setHot(g) {
      state.hot = g;
      groups.forEach(function (x) {
        carEls[x].car.classList.toggle("hot", x === g);
        carEls[x].car.classList.toggle("dim", !!g && x !== g);
      });
      Array.prototype.forEach.call(board.children, function (li) { li.firstChild.classList.toggle("hot", li.firstChild.dataset.group === g); });
    }
    function choose(g) { select(state.sel === g ? null : g); }
    function select(g) {
      state.sel = g;
      groups.forEach(function (x) { carEls[x].car.classList.toggle("sel", x === g); });
      Array.prototype.forEach.call(board.children, function (li) { li.firstChild.classList.toggle("sel", li.firstChild.dataset.group === g); });
      renderSpot();
      writeHash();
    }

    function renderBoard() {
      board.textContent = "";
      stand[state.span].forEach(function (x) {
        var row = el("button", { "class": "board-row", type: "button", "data-group": x.group }, [
          el("span", { "class": "rk", text: placeText(x) }), badgeEl(x.group),
          el("span", { "class": "nm", text: x.group + (flagMark(TB[x.group]) ? " " + flagMark(TB[x.group]) : "") }),
          el("span", { "class": "vl", text: f2(x.finish) })
        ]);
        row.setAttribute("aria-label", (x.tie ? "Tied for " : "") + ordinal(x.place) + ": " + x.group + ", average finish " + f2(x.finish) + " over " + int(x.n) + " results");
        row.addEventListener("pointerenter", function () { setHot(x.group); });
        row.addEventListener("pointerleave", function () { setHot(null); });
        row.addEventListener("focus", function () { setHot(x.group); });
        row.addEventListener("blur", function () { setHot(null); });
        row.addEventListener("click", function () { choose(x.group); });
        row.classList.toggle("sel", x.group === state.sel);
        board.appendChild(el("li", {}, [row]));
      });
    }

    /* ----- spotlight card for one team ----- */
    function renderSpot() {
      spot.textContent = "";
      var g = state.sel;
      if (!g) { spot.appendChild(el("p", { "class": "spot-empty", text: "Click a car, a leaderboard row, or search for a team to see its own history against the other 11." })); return; }
      var t = TB[g], rA = placeIn("gen6", g) - 1, rB = placeIn("nextgen", g) - 1;
      var card = el("div", { "class": "spot-card" });
      var clear = el("button", { "class": "btn", type: "button", text: "Clear" });
      clear.addEventListener("click", function () { select(null); input.value = ""; });
      card.appendChild(el("div", { "class": "spot-head" }, [badgeEl(g), el("h3", { text: g + (flagMark(t) ? " " + flagMark(t) : "") }), clear]));
      card.appendChild(el("p", { text: g + " averaged " + f1(t.sa.finish) + " in 2019–2021 (" + ordinal(rA + 1) + " of the 12 groups) and " + f1(t.sb.finish) +
        " in 2022–2024 (" + ordinal(rB + 1) + "), a change of " + signed1(t.gained) + " positions." +
        (t.rotating || t.thin ? " Read this change with care: " + (t.rotating ? "it used " + t.da + " and " + t.db + " different drivers" : "it had about one car") + "." : "") }));
      var dl = el("dl", { "class": "spot-stats" });
      [["Results", int(t.all.n)], ["Average finish", f2(t.sa.finish) + " → " + f2(t.sb.finish)], ["Positions gained", signed1(t.gained)],
       ["Top-10 rate", pct1(t.sa.top10) + " → " + pct1(t.sb.top10)], ["Did-not-finish rate", pct1(t.sa.dnf) + " → " + pct1(t.sb.dnf)],
       ["Different drivers", t.da + " → " + t.db]].forEach(function (p) {
        dl.appendChild(el("div", {}, [el("dt", { text: p[0] }), el("dd", { text: p[1] })]));
      });
      card.appendChild(dl);
      card.appendChild(el("p", { "class": "note", text: "Average finish by season: " + g + " against all 12 groups (lower is better)." }));
      var chart = el("div", { "class": "chart spot-chart" });
      card.appendChild(chart);
      spot.appendChild(card);
      Charts.lineChart(chart, {
        xs: SEASONS, height: 220,
        series: [
          { name: shortName(g), color: "var(--series-1)", values: SEASONS.map(function (y) { return summarize(rows.filter(function (r) { return r.group === g && r.season === y; })).finish; }) },
          { name: "All 12 groups", color: "var(--context)", values: SEASONS.map(function (y) { return summarize(rows.filter(function (r) { return r.season === y; })).finish; }) }
        ],
        yFormat: f1, tipFormat: f2, ariaLabel: "Line chart of " + g + " average finish by season against all 12 groups"
      });
    }

    /* ----- search with autocomplete ----- */
    var activeIdx = -1, shown = [];
    function openList(items) {
      shown = items; activeIdx = -1; list.textContent = "";
      items.forEach(function (g, i) {
        var li = el("li", { role: "option", id: "opt-" + i, "aria-selected": "false", text: g + "  (" + teamAbbr(g) + ")" });
        li.addEventListener("pointerdown", function (e) { e.preventDefault(); pick(g); });
        list.appendChild(li);
      });
      list.hidden = !items.length;
      input.setAttribute("aria-expanded", items.length ? "true" : "false");
    }
    function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    function matches(q) {
      q = q.trim().toLowerCase();
      return groups.slice().sort().filter(function (g) { return !q || g.toLowerCase().indexOf(q) >= 0 || teamAbbr(g).toLowerCase().indexOf(q) === 0; });
    }
    function highlight(i) {
      Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      activeIdx = i;
      if (i >= 0) input.setAttribute("aria-activedescendant", "opt-" + i); else input.removeAttribute("aria-activedescendant");
    }
    function pick(g) { input.value = g; closeList(); select(g); }
    input.addEventListener("input", function () { openList(matches(input.value)); });
    input.addEventListener("focus", function () { openList(matches(input.value)); });
    input.addEventListener("blur", function () { setTimeout(closeList, 120); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) openList(matches(input.value)); highlight(Math.min(shown.length - 1, activeIdx + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(0, activeIdx - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); var g = shown[activeIdx >= 0 ? activeIdx : 0]; if (g) pick(g); }
      else if (e.key === "Escape") { closeList(); }
    });

    /* ----- controls ----- */
    function stopPlay() {
      state.playing = false; clearInterval(playTimer);
      playBtn.setAttribute("aria-pressed", "false"); playBtn.textContent = "▶ Play seasons";
    }
    playBtn.addEventListener("click", function () {
      if (state.playing) { stopPlay(); return; }
      state.playing = true; playBtn.setAttribute("aria-pressed", "true"); playBtn.textContent = "❚❚ Stop";
      var order = ["2019", "2020", "2021", "2022", "2023", "2024"], i = Math.max(0, order.indexOf(state.span));
      if (state.span === "gen6" || state.span === "nextgen") i = -1;
      function next() { i = (i + 1) % order.length; setSpan(order[i]); }
      next(); playTimer = setInterval(next, 3200);
    });
    function setMotion(on) {
      state.motion = on;
      motionBtn.setAttribute("aria-pressed", on ? "false" : "true");
      motionBtn.textContent = on ? "Pause motion" : "Resume motion";
      if (on) { last = 0; schedule(); }
    }
    motionBtn.addEventListener("click", function () { setMotion(!state.motion); });
    if (REDUCED_MOTION) { motionBtn.hidden = true; }

    /* ----- shareable view: #season=2022&team=Spire%20Motorsports ----- */
    function writeHash() {
      var p = new URLSearchParams();
      if (state.span !== "gen6") p.set("season", state.span);
      if (state.sel) p.set("team", state.sel);
      var h = p.toString();
      try { history.replaceState(null, "", location.pathname + location.search + (h ? "#" + h : "")); } catch (e) { /* ignore */ }
    }
    function readHash() {
      var p = new URLSearchParams(location.hash.slice(1));
      var s = p.get("season"), t = p.get("team");
      if (s && spanBy[s]) state.span = s;
      if (t && TB[t]) state.sel = t;
    }

    /* ----- start ----- */
    readHash();
    buildTrack(trackWrap.clientWidth > 0 ? trackWrap.clientWidth < 600 : window.innerWidth < 720);
    setTargets(true);
    segInputs[state.span].checked = true;
    paintTexts(); placeAll();
    renderBoard();
    select(state.sel);       // draws the spotlight card (or its hint) and applies the selection ring
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var narrow = trackWrap.clientWidth > 0 && trackWrap.clientWidth < 600;
        if (narrow !== state.narrow) { buildTrack(narrow); setTargets(true); placeAll(); select(state.sel); }
      }).observe(trackWrap);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) { last = 0; schedule(); } }).observe(host);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = 0; schedule(); } });
    if (state.motion) schedule();
    return { state: state, stand: stand };
  }

  return { init: init };
})();
