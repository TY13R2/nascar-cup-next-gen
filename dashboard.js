"use strict";
/* Dashboard: filters (season, team group, measure) scope the four summary numbers, three charts and the table.
   Definitions come from data.js and match the report page. */

initTheme();
loadRows().then(init).catch(function (e) { showError(e.message); });

function init(rows) {
  var FULL = {};
  teamTable(rows).forEach(function (t) { FULL[t.group] = t; });
  var GROUPS = Object.keys(FULL).sort();
  var state = { seasons: new Set(SEASONS), teams: new Set(GROUPS), measure: "finish" };

  function pctAxis(v) { return Math.round(v * 100) + "%"; }
  var M = {
    finish: { label: "Average finish", fmt: f1, tip: f2, axis: f1, val: function (s) { return s.finish; }, change: function (t) { return t.gained; },
              changeTitle: "Positions gained", unit: "positions", better: "Gained positions (finished higher)", worse: "Lost positions (finished lower)",
              hint: "Lower is better." },
    top10: { label: "Top-10 rate", fmt: pct1, tip: pct1, axis: pctAxis, val: function (s) { return s.top10; }, change: function (t) { return t.top10Gain; },
             changeTitle: "Change in top-10 rate (points)", unit: "points", better: "Higher top-10 rate", worse: "Lower top-10 rate",
             hint: "Higher is better." },
    dnf: { label: "Did-not-finish rate", fmt: pct1, tip: pct1, axis: pctAxis, val: function (s) { return s.dnf; }, change: function (t) { return t.dnfGain; },
           changeTitle: "Change in did-not-finish rate (points; positive = fewer)", unit: "points", better: "Fewer non-finishes", worse: "More non-finishes",
           hint: "Lower is better." }
  };
  var lowerBetter = { finish: true, top10: false, dnf: true };

  /* ----- controls ----- */
  var controls = document.getElementById("controls");
  var seasonInputs = {}, teamInputs = {}, measureInputs = {};

  var seasonChips = el("div", { "class": "chips", role: "group", "aria-label": "Seasons" });
  SEASONS.forEach(function (s) {
    var inp = el("input", { type: "checkbox", value: String(s), checked: "checked" });
    inp.addEventListener("change", function () { if (inp.checked) state.seasons.add(s); else state.seasons["delete"](s); render(); });
    seasonInputs[s] = inp;
    seasonChips.appendChild(el("label", { "class": "chip" }, [inp, el("span", { text: String(s) })]));
  });
  var quick = el("div", { "class": "chips" });
  [["All seasons", SEASONS], ["2019–2021 (Gen 6)", [2019, 2020, 2021]], ["2022–2024 (Next Gen)", [2022, 2023, 2024]]].forEach(function (q) {
    var b = el("button", { "class": "btn", type: "button", text: q[0] });
    b.addEventListener("click", function () { state.seasons = new Set(q[1]); syncControls(); render(); });
    quick.appendChild(b);
  });

  var seg = el("div", { "class": "seg", role: "radiogroup", "aria-label": "Measure shown in the charts" });
  ["finish", "top10", "dnf"].forEach(function (k) {
    var inp = el("input", { type: "radio", name: "measure", value: k });
    if (k === state.measure) inp.checked = true;
    inp.addEventListener("change", function () { if (inp.checked) { state.measure = k; render(); } });
    measureInputs[k] = inp;
    seg.appendChild(el("label", {}, [inp, el("span", { text: M[k].label })]));
  });

  var resetBtn = el("button", { "class": "btn primary", type: "button", text: "Reset filters" });
  resetBtn.addEventListener("click", function () {
    state.seasons = new Set(SEASONS); state.teams = new Set(GROUPS); state.measure = "finish"; syncControls(); render();
  });
  var copyBtn = el("button", { "class": "btn", type: "button", text: "Copy link to this view" });
  copyBtn.addEventListener("click", function () {
    function done(ok) { copyBtn.textContent = ok ? "Link copied" : "Copy the address bar"; setTimeout(function () { copyBtn.textContent = "Copy link to this view"; }, 2000); }
    try { navigator.clipboard.writeText(location.href).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  });

  controls.appendChild(el("div", { "class": "control-row" }, [
    el("div", { "class": "control-group" }, [el("span", { "class": "glabel", text: "Seasons" }), seasonChips]),
    el("div", { "class": "control-group" }, [el("span", { "class": "glabel", text: "Quick periods" }), quick]),
    el("div", { "class": "control-group" }, [el("span", { "class": "glabel", text: "Measure in the charts" }), seg]),
    el("div", { "class": "control-group" }, [el("span", { "class": "glabel", text: " " }), el("div", { "class": "chips" }, [resetBtn, copyBtn])])
  ]));

  /* The current view lives in the address bar: #s=2019,2021&t=Team A|Team B&m=top10 (only what differs from the defaults). */
  function readState() {
    var p = new URLSearchParams(location.hash.slice(1));
    if (p.has("s")) {
      var ys = p.get("s").split(",").map(Number).filter(function (y) { return SEASONS.indexOf(y) >= 0; });
      state.seasons = new Set(ys);
    }
    if (p.has("t")) {
      state.teams = new Set(p.get("t").split("|").filter(function (g) { return GROUPS.indexOf(g) >= 0; }));
    }
    if (p.has("m") && M[p.get("m")]) state.measure = p.get("m");
  }
  function writeState() {
    var p = new URLSearchParams();
    if (state.seasons.size !== SEASONS.length) p.set("s", SEASONS.filter(function (y) { return state.seasons.has(y); }).join(","));
    if (state.teams.size !== GROUPS.length) p.set("t", GROUPS.filter(function (g) { return state.teams.has(g); }).join("|"));
    if (state.measure !== "finish") p.set("m", state.measure);
    var h = p.toString();
    try { history.replaceState(null, "", location.pathname + location.search + (h ? "#" + h : "")); } catch (e) { /* ignore */ }
  }

  var teamGrid = el("div", { "class": "team-grid" });
  GROUPS.forEach(function (g) {
    var inp = el("input", { type: "checkbox", value: g, checked: "checked" });
    inp.addEventListener("change", function () { if (inp.checked) state.teams.add(g); else state.teams["delete"](g); render(); });
    teamInputs[g] = inp;
    teamGrid.appendChild(el("label", {}, [inp, el("span", { text: g + " " + flagMark(FULL[g]) })]));
  });
  var teamCount = el("span", { text: "" });
  var allBtn = el("button", { "class": "btn", type: "button", text: "Select all" });
  var noneBtn = el("button", { "class": "btn", type: "button", text: "Clear all" });
  allBtn.addEventListener("click", function () { state.teams = new Set(GROUPS); syncControls(); render(); });
  noneBtn.addEventListener("click", function () { state.teams = new Set(); syncControls(); render(); });
  var teamsBox = el("details", { "class": "teams", open: "open" }, [
    el("summary", {}, [teamCount]),
    el("div", { "class": "chips", style: "margin:8px 0" }, [allBtn, noneBtn]),
    teamGrid
  ]);
  controls.appendChild(teamsBox);

  function syncControls() {
    SEASONS.forEach(function (s) { seasonInputs[s].checked = state.seasons.has(s); });
    GROUPS.forEach(function (g) { teamInputs[g].checked = state.teams.has(g); });
    Object.keys(measureInputs).forEach(function (k) { measureInputs[k].checked = state.measure === k; });
  }

  /* ----- rendering ----- */
  function text(id, t) { document.getElementById(id).textContent = t; }

  function render() {
    var m = M[state.measure];
    writeState();
    var sel = rows.filter(function (r) { return state.seasons.has(r.season) && state.teams.has(r.group); });
    var seasonsOnly = rows.filter(function (r) { return state.seasons.has(r.season); });
    var s = summarize(sel);
    teamCount.textContent = "Team groups (" + state.teams.size + " of " + GROUPS.length + " selected)";

    text("scope", sel.length
      ? "Showing " + int(s.n) + " of " + int(rows.length) + " driver-race results: " + state.teams.size + " team group" + (state.teams.size === 1 ? "" : "s") + ", seasons " + seasonLabel(Array.from(state.seasons)) + "."
      : "No results match the current filters. Choose at least one season and one team group, or reset the filters.");

    /* four summary numbers */
    var tiles = document.getElementById("tiles");
    tiles.textContent = "";
    [
      ["Driver-race results", int(s.n), "One row per driver per race"],
      ["Average finish", f2(s.finish), "Mean finishing position; lower is better"],
      ["Top-10 rate", pct1(s.top10), "Share of results finishing 1st–10th"],
      ["Did-not-finish rate", pct1(s.dnf), "Share of results with a Status other than “running”"]
    ].forEach(function (c) {
      tiles.appendChild(el("li", { "class": "tile" }, [
        el("p", { "class": "label", text: c[0] }), el("p", { "class": "value", text: c[1] }), el("p", { "class": "sub", text: c[2] })
      ]));
    });

    /* chart A: measure by season */
    text("a-title", m.label + " by season");
    text("a-sub", m.hint + " Shows the selected team groups" + (state.teams.size < GROUPS.length ? " and, for context, all 12 groups." : "."));
    var series = [];
    if (state.teams.size < GROUPS.length) {
      series.push({ name: "All 12 groups", color: "var(--context)", values: SEASONS.map(function (y) {
        return state.seasons.has(y) ? m.val(summarize(seasonsOnly.filter(function (r) { return r.season === y; }))) : null; }) });
    }
    series.push({ name: state.teams.size === GROUPS.length ? "All 12 groups" : "Selected groups", color: "var(--series-1)", values: SEASONS.map(function (y) {
      return state.seasons.has(y) ? m.val(summarize(sel.filter(function (r) { return r.season === y; }))) : null; }) });
    Charts.lineChart(document.getElementById("chart-a"), {
      xs: SEASONS, series: series, yFormat: m.axis, tipFormat: m.tip, ariaLabel: "Line chart of " + m.label + " by season for the current filters"
    });

    /* per-team numbers for the current filters; flags always come from the whole file */
    var T = teamTable(sel).filter(function (t) { return t.all.n > 0; }).map(function (t) {
      t.flag = flagMark(FULL[t.group]); return t;
    });
    function better(a, b) { return lowerBetter[state.measure] ? m.val(a.all) - m.val(b.all) : m.val(b.all) - m.val(a.all); }
    T.sort(better);

    /* chart B: both periods, per team */
    text("b-title", m.label + " by team group, 2019–2021 and 2022–2024");
    text("b-sub", m.hint + " Best team first; a period with no selected seasons has no bar.");
    var maxV = 0;
    T.forEach(function (t) { [t.sa, t.sb].forEach(function (x) { var v = m.val(x); if (isNum(v) && v > maxV) maxV = v; }); });
    Charts.groupedBars(document.getElementById("chart-b"), {
      items: T.map(function (t) {
        var a = t.sa.n ? m.val(t.sa) : null, b = t.sb.n ? m.val(t.sb) : null;
        return { label: shortName(t.group) + (t.flag ? " " + t.flag : ""), head: t.group + " " + t.flag, values: [a, b],
          extra: [int(t.sa.n) + " and " + int(t.sb.n) + " results"] };
      }),
      series: [{ name: "2019–2021 (Gen 6)", color: "var(--series-1)" }, { name: "2022–2024 (Next Gen)", color: "var(--series-2)" }],
      domainMax: maxV || 1, fmt: m.tip, tickFmt: m.axis, ariaLabel: "Grouped bar chart of " + m.label + " by team group and period"
    });

    /* chart C: change between periods */
    text("c-title", m.changeTitle + ", 2019–2021 to 2022–2024");
    text("c-sub", "Needs selected seasons from both periods. Positive means better.");
    var both = T.filter(function (t) { return t.sa.n > 0 && t.sb.n > 0; }).sort(function (a, b) { return m.change(b) - m.change(a); });
    Charts.divergingBars(document.getElementById("chart-c"), {
      items: both.map(function (t) {
        return { label: shortName(t.group), flag: t.flag, value: m.change(t), head: t.group + " " + t.flag,
          extra: [m.label + " " + m.tip(m.val(t.sa)) + " → " + m.tip(m.val(t.sb)), int(t.sa.n) + " and " + int(t.sb.n) + " results"] };
      }),
      fmt: signed1, tickFmt: signedInt, posName: m.better, negName: m.worse,
      valueNameFor: function (v) { return v >= 0 ? m.unit + " better" : m.unit + " worse"; },
      emptyMessage: "Select seasons from both 2019–2021 and 2022–2024, and at least one team group, to see the change.",
      ariaLabel: "Bar chart of the change in " + m.label + " between periods by team group"
    });

    /* table */
    text("t-sub", "One row per selected team group, best first by " + m.label.toLowerCase() + ". The last row is the whole current view.");
    var tbl = document.getElementById("table");
    tbl.textContent = "";
    if (!T.length) { tbl.appendChild(el("p", { "class": "note", text: "No results match the current filters." })); return; }
    tbl.appendChild(buildTable([
      { head: "Team group", get: function (t) { return t.group + " " + t.flag; } },
      { head: "Results", get: function (t) { return int(t.all.n); } },
      { head: "Avg finish", get: function (t) { return f2(t.all.finish); } },
      { head: "Top-10 rate", get: function (t) { return pct1(t.all.top10); } },
      { head: "Did-not-finish rate", get: function (t) { return pct1(t.all.dnf); } },
      { head: m.label + " 2019–21", get: function (t) { return t.sa.n ? m.tip(m.val(t.sa)) : "—"; } },
      { head: m.label + " 2022–24", get: function (t) { return t.sb.n ? m.tip(m.val(t.sb)) : "—"; } },
      { head: "Change (" + m.unit + ", + is better)", get: function (t) { return t.sa.n && t.sb.n ? signed1(m.change(t)) : "—"; } }
    ], T, { total: ["Current view", int(s.n), f2(s.finish), pct1(s.top10), pct1(s.dnf),
      "", "", ""] }));
  }

  readState();
  syncControls();
  render();
}
