"use strict";
/* Shared data loading, definitions, and formatting for both pages.
   Every number on the report and the dashboard is computed here from cup_next_gen.csv. */

// Printed under the report title.
var AUTHOR = "Tyler Eldringhoff";

var DATA_FILE = "cup_next_gen.csv";
var SEASONS = [2019, 2020, 2021, 2022, 2023, 2024];
var ERAS = ["Gen 6", "Next Gen"];          // 2019-2021 and 2022-2024 (the file's Period column)
var ROTATING_MIN_DRIVERS = 15;            // flag: 15+ different drivers in either era
var THIN_MAX_ROWS = 150;                  // flag: under 150 results in either era (about one car)

var SHORT_NAMES = {
  "Front Row Motorsports": "Front Row",
  "Hendrick Motorsports": "Hendrick",
  "JTG Daugherty Racing": "JTG Daugherty",
  "Joe Gibbs Racing": "Joe Gibbs",
  "Legacy Motor Club": "Legacy",
  "RFK Racing": "RFK",
  "Richard Childress Racing": "Richard Childress",
  "Rick Ware Racing": "Rick Ware",
  "Spire Motorsports": "Spire",
  "Stewart-Haas Racing": "Stewart-Haas",
  "Team Penske": "Penske",
  "Wood Brothers Racing": "Wood Brothers"
};
function shortName(g) { return SHORT_NAMES[g] || g; }

/* ---------- loading ---------- */

function parseCSV(text) {
  var rows = [], row = [], field = "", inQ = false, i = 0, c;
  while (i < text.length) {
    c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; } }
      else { field += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else { field += c; }
    i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  var head = rows.shift();
  return rows.map(function (r) {
    var o = {};
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  });
}

function loadRows() {
  return fetch(DATA_FILE).then(function (res) {
    if (!res.ok) throw new Error("Could not load " + DATA_FILE + " (HTTP " + res.status + ")");
    return res.text();
  }).then(function (text) {
    return parseCSV(text).map(function (r) {
      var finish = +r.Finish;
      return {
        season: +r.Season, race: +r.Race, track: r.Track, finish: finish, start: +r.Start,
        car: r.Car, driver: r.Driver, group: r.TeamGroup, laps: +r.Laps, led: +r.Led,
        status: r.Status, win: +r.Win,
        era: r.Period === "2019-2021" ? "Gen 6" : "Next Gen",
        top10: finish <= 10 ? 1 : 0,                 // finished 1st through 10th
        dnf: r.Status !== "running" ? 1 : 0          // Status is anything other than "running"
      };
    });
  });
}

/* ---------- the four summary numbers ---------- */

function summarize(rows) {
  var n = rows.length, f = 0, t = 0, d = 0;
  for (var i = 0; i < n; i++) { f += rows[i].finish; t += rows[i].top10; d += rows[i].dnf; }
  return { n: n, finish: n ? f / n : NaN, top10: n ? t / n : NaN, dnf: n ? d / n : NaN };
}

var MEASURES = {
  finish: { key: "finish", label: "Average finish", lowerBetter: true, unit: "positions" },
  top10: { key: "top10", label: "Top-10 rate", lowerBetter: false, unit: "points" },
  dnf: { key: "dnf", label: "Did-not-finish rate", lowerBetter: true, unit: "points" }
};

/* ---------- team-level statistics ---------- */

function distinct(rows, key) {
  var s = {}, c = 0;
  rows.forEach(function (r) { if (!s[r[key]]) { s[r[key]] = 1; c++; } });
  return c;
}

// One row per team group: era summaries, positions gained, and the two flags.
// Flags are computed on the full file, so a dashboard filter never changes them.
function teamTable(rows) {
  var names = [];
  rows.forEach(function (r) { if (names.indexOf(r.group) < 0) names.push(r.group); });
  return names.map(function (g) {
    var mine = rows.filter(function (r) { return r.group === g; });
    var a = mine.filter(function (r) { return r.era === "Gen 6"; });
    var b = mine.filter(function (r) { return r.era === "Next Gen"; });
    var sa = summarize(a), sb = summarize(b);
    var da = distinct(a, "driver"), db = distinct(b, "driver");
    return {
      group: g, all: summarize(mine), sa: sa, sb: sb, da: da, db: db,
      gained: sa.finish - sb.finish,                 // positions gained: positive = moved up
      top10Gain: (sb.top10 - sa.top10) * 100,        // percentage points: positive = better
      dnfGain: (sa.dnf - sb.dnf) * 100,              // percentage points fewer: positive = better
      rotating: da >= ROTATING_MIN_DRIVERS || db >= ROTATING_MIN_DRIVERS,
      thin: sa.n < THIN_MAX_ROWS || sb.n < THIN_MAX_ROWS
    };
  });
}

function flagMark(t) { return (t.rotating ? "†" : "") + (t.thin ? "‡" : ""); }

// The four groups with the best average finish in 2019-2021.
function bigFour(table) {
  return table.slice().sort(function (x, y) { return x.sa.finish - y.sa.finish; })
    .slice(0, 4).map(function (t) { return t.group; });
}

// Share of the ten top-10 finishing positions per race that the file's groups held.
function top10Share(rows, seasons) {
  var races = {}, held = 0;
  rows.forEach(function (r) {
    if (seasons.indexOf(r.season) >= 0) { races[r.season + "-" + r.race] = 1; held += r.top10; }
  });
  var nRaces = Object.keys(races).length;
  return { held: held, races: nRaces, share: nRaces ? held / (10 * nRaces) : NaN };
}

/* ---------- formatting ---------- */

function isNum(v) { return typeof v === "number" && isFinite(v); }
function f1(v) { return isNum(v) ? v.toFixed(1) : "—"; }
function f2(v) { return isNum(v) ? v.toFixed(2) : "—"; }
function pct1(v) { return isNum(v) ? (v * 100).toFixed(1) + "%" : "—"; }
function int(v) { return isNum(v) ? v.toLocaleString("en-US") : "—"; }
function signed1(v) {
  if (!isNum(v)) return "—";
  var s = Math.abs(v).toFixed(1);
  return (Number(s) === 0 ? "" : v > 0 ? "+" : "−") + s;
}
function signedInt(v) { return v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v); }
function seasonLabel(list) {
  if (!list.length) return "no seasons";
  var s = list.slice().sort(), contiguous = s.every(function (v, i) { return i === 0 || v === s[i - 1] + 1; });
  return s.length === 1 ? String(s[0]) : contiguous ? s[0] + "–" + s[s.length - 1] : s.join(", ");
}

/* ---------- small DOM helpers (text always goes in with textContent) ---------- */

function el(tag, attrs, kids) {
  var e = document.createElement(tag), k;
  if (attrs) for (k in attrs) {
    if (k === "text") e.textContent = attrs[k];
    else if (k === "class") e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return e;
}

// cols: [{head, get(row) -> string}], rows: array, opts: {caption, total: {cells...}}
function buildTable(cols, rows, opts) {
  opts = opts || {};
  var table = el("table"), thead = el("thead"), tr = el("tr"), tbody = el("tbody");
  if (opts.caption) table.appendChild(el("caption", { text: opts.caption }));
  cols.forEach(function (c) { tr.appendChild(el("th", { scope: "col", text: c.head })); });
  thead.appendChild(tr); table.appendChild(thead);
  rows.forEach(function (r) {
    var row = el("tr");
    cols.forEach(function (c) { row.appendChild(el("td", { text: c.get(r) })); });
    tbody.appendChild(row);
  });
  if (opts.total) {
    var t = el("tr", { class: "total" });
    opts.total.forEach(function (v) { t.appendChild(el("td", { text: v })); });
    tbody.appendChild(t);
  }
  table.appendChild(tbody);
  return el("div", { class: "table-wrap" }, [table]);
}

/* ---------- theme toggle (light / dark, remembered when storage is available) ---------- */

function initTheme() {
  var root = document.documentElement, btn = document.getElementById("theme-btn");
  if (!btn) return;
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) { /* storage blocked: fall back to the OS setting */ }
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  function current() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function label() {
    btn.textContent = current() === "dark" ? "Light theme" : "Dark theme";
    btn.setAttribute("aria-label", "Switch to " + (current() === "dark" ? "light" : "dark") + " theme");
  }
  btn.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
    label();
  });
  label();
}

function showError(msg) {
  var box = el("p", { class: "note", role: "alert", text: msg + " If you opened this file straight from disk, run it from a web server instead (for example: python -m http.server)." });
  var host = document.querySelector("main") || document.body;
  host.insertBefore(box, host.firstChild);
}
