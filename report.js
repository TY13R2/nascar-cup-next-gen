"use strict";
/* Builds the report page. Every number in the text, the summary cards, the charts and the
   tables is computed from cup_next_gen.csv by the helpers in data.js. */

initTheme();
loadRows().then(build).catch(function (e) { showError(e.message); });

function floor1(v) { return Math.floor(v * 10 + 1e-9) / 10; }
function names(list, sep) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + (sep || " and ") + list[list.length - 1]; }

function build(rows) {
  var T = teamTable(rows), all = summarize(rows);
  var by = {}; T.forEach(function (t) { by[t.group] = t; });
  var sorted = T.slice().sort(function (a, b) { return b.gained - a.gained; });
  var worst = sorted[sorted.length - 1];
  var G6 = [2019, 2020, 2021], NG = [2022, 2023, 2024];
  var share6 = top10Share(rows, G6), shareNG = top10Share(rows, NG);
  var era6 = summarize(rows.filter(function (r) { return r.era === "Gen 6"; }));
  var eraNG = summarize(rows.filter(function (r) { return r.era === "Next Gen"; }));
  var races = {}; rows.forEach(function (r) { races[r.season + "-" + r.race] = 1; });
  var nRaces = Object.keys(races).length;

  /* ----- title ----- */
  document.getElementById("title").textContent =
    "Which of 12 established NASCAR Cup teams gained or lost the most average finishing position after the Next Gen car? " +
    int(all.n) + " driver-race results, 2019–2024";
  document.getElementById("byline").textContent = "By " + AUTHOR;
  document.getElementById("reader").textContent = "Written for a competition director at an established Cup team who wants to benchmark against the 11 other teams that raced every season.";

  /* ----- opening: answer first, then a recommendation ----- */
  var steady = sorted.filter(function (t) { return !t.rotating && !t.thin; });
  var steadyUp = steady.slice(0, 2), steadyDown = steady.slice().reverse().slice(0, 3);
  var pts = (share6.share - shareNG.share) * 100;
  var opening = document.getElementById("opening");
  // One paragraph: the answer is its first two sentences, and it ends with the recommendation.
  opening.appendChild(el("p", { "class": "lede", text:
    sorted[0].group + " (" + signed1(sorted[0].gained) + " positions) and " + sorted[1].group + " (" + signed1(sorted[1].gained) +
      ") improved their average finish the most after the Next Gen car arrived in 2022, while " + worst.group + " lost the most (" +
      signed1(worst.gained) + "), but the two biggest gains came from teams that used many different drivers. " +
      "Among teams with steadier lineups, " + steadyUp.map(function (t) { return t.group + " (" + signed1(t.gained) + ")"; }).join(" and ") +
      " improved most, and " + names(steadyDown.map(function (t) { return t.group + " (" + signed1(t.gained) + ")"; })) + " lost the most. " +
    "Recommendation: judge your own team against these peers by rank, not by raw finish, because these 12 groups’ share of the top-10 finishing positions fell by " + f1(pts) +
      " points, and study " + steadyUp[0].group + " and " + steadyUp[1].group + " first, since their gains came with steady lineups." }));
  var cta = el("p", {}, [el("a", { "class": "btn primary", href: "dashboard.html", style: "text-decoration:none;display:inline-block", text: "Open the dashboard →" })]);
  opening.appendChild(cta);

  /* ----- four summary numbers ----- */
  var tiles = document.getElementById("tiles");
  [
    ["Driver-race results", int(all.n), "One row per driver per race, " + nRaces + " races", all.n, function (v) { return int(Math.round(v)); }],
    ["Average finish", f2(all.finish), "Mean finishing position; lower is better", all.finish, f2],
    ["Top-10 rate", pct1(all.top10), "Share of results finishing 1st–10th", all.top10, pct1],
    ["Did-not-finish rate", pct1(all.dnf), "Share of results with a Status other than “running”", all.dnf, pct1]
  ].forEach(function (c) {
    var value = el("p", { "class": "value" });
    tiles.appendChild(el("li", { "class": "tile" }, [el("p", { "class": "label", text: c[0] }), value, el("p", { "class": "sub", text: c[2] })]));
    countUp(value, c[1], c[3], c[4]);          // counts up when scrolled into view, always ends on the exact value
  });

  /* ----- racetrack hero: cars ordered by average finish for the chosen season or period ----- */
  Race.init(rows, T, document.getElementById("race"));

  var host = document.getElementById("findings");
  function finding(n, heading, paras, fig) {
    var sec = el("section", { "class": "finding" });
    var narrow = el("div", { "class": "narrow" });
    narrow.appendChild(el("p", { "class": "num", text: "Finding " + n }));
    narrow.appendChild(el("h2", { text: heading }));
    paras.forEach(function (p) { narrow.appendChild(el("p", { text: p })); });
    sec.appendChild(narrow);
    var figure = el("div", { "class": "figure" });
    figure.appendChild(el("p", { "class": "title", text: fig.title }));
    figure.appendChild(el("p", { "class": "subtitle", text: fig.subtitle }));
    var chart = el("div", { "class": "chart" });
    figure.appendChild(chart);
    figure.appendChild(el("p", { "class": "note rows", text: "Rows counted: " + int(all.n) + " driver-race results from " + nRaces + " races, 12 team groups, 2019–2024." }));
    var det = el("details", { "class": "numbers" }, [el("summary", { text: "View the numbers" }), fig.table]);
    figure.appendChild(det);
    sec.appendChild(figure);
    host.appendChild(sec);
    fig.draw(chart);
  }

  /* ----- finding 1: positions gained by team ----- */
  var flagged = function (key) { return T.filter(function (t) { return t[key]; }).map(function (t) { return shortName(t.group); }); };
  var bestNG = T.slice().sort(function (a, b) { return a.sb.finish - b.sb.finish; })[0];
  var top4 = sorted.slice(0, 4), bot4 = sorted.slice(-4).reverse();
  function ba(t) { return shortName(t.group) + " " + f1(t.sa.finish) + " to " + f1(t.sb.finish) + " (" + signed1(t.gained) + ")"; }
  finding(1,
    "Four teams gained at least " + f1(floor1(sorted[3].gained)) + " positions and four lost at least " + f1(floor1(-sorted[sorted.length - 4].gained)) +
      "; " + shortName(worst.group) + " fell furthest, by " + f1(-worst.gained),
    [
      "Positions gained is a team’s average finish in 2019–2021 (Gen 6 car) minus its average finish in 2022–2024 (Next Gen car), so a positive number means the team finished higher up on average. " +
        "The biggest gains were " + names(top4.map(ba)) + ". The biggest losses were " + names(bot4.map(ba)) + ". " +
        shortName(bestNG.group) + " had the best average finish in 2022–2024 (" + f1(bestNG.sb.finish) + ").",
      "† marks teams that used " + ROTATING_MIN_DRIVERS + " or more different drivers in either period (" + names(flagged("rotating")) + "), and ‡ marks teams with fewer than " + THIN_MAX_ROWS +
        " results in either period, about one car (" + names(flagged("thin")) + "). Their changes depend on small or shifting lineups, so read them as lineup stories more than car stories."
    ],
    {
      title: "Positions gained, 2019–2021 to 2022–2024",
      subtitle: "Average finish in 2019–2021 minus average finish in 2022–2024. † many drivers, ‡ about one car.",
      draw: function (c) {
        Charts.divergingBars(c, {
          items: sorted.map(function (t) {
            return { label: shortName(t.group), flag: flagMark(t), value: t.gained, head: t.group + " " + flagMark(t),
              extra: ["Average finish " + f1(t.sa.finish) + " in 2019–2021 → " + f1(t.sb.finish) + " in 2022–2024",
                      t.sa.n + " and " + t.sb.n + " results; " + t.da + " and " + t.db + " different drivers"] };
          }),
          fmt: signed1, tickFmt: signedInt, posName: "Gained positions (finished higher)", negName: "Lost positions (finished lower)",
          valueNameFor: function (v) { return v >= 0 ? "positions gained" : "positions lost"; },
          ariaLabel: "Bar chart of positions gained by each of the 12 team groups"
        });
      },
      table: buildTable([
        { head: "Team group", get: function (t) { return t.group + " " + flagMark(t); } },
        { head: "Results 2019–21", get: function (t) { return int(t.sa.n); } },
        { head: "Results 2022–24", get: function (t) { return int(t.sb.n); } },
        { head: "Avg finish 2019–21", get: function (t) { return f2(t.sa.finish); } },
        { head: "Avg finish 2022–24", get: function (t) { return f2(t.sb.finish); } },
        { head: "Positions gained", get: function (t) { return signed1(t.gained); } },
        { head: "Drivers 2019–21", get: function (t) { return String(t.da); } },
        { head: "Drivers 2022–24", get: function (t) { return String(t.db); } }
      ], sorted, { caption: "One row per team group, best gain first." })
    });

  /* ----- finding 2: big four versus the rest ----- */
  var big = bigFour(T);
  function tier(isBig) { return rows.filter(function (r) { return (big.indexOf(r.group) >= 0) === isBig; }); }
  function tierEra(isBig, era) { return summarize(tier(isBig).filter(function (r) { return r.era === era; })); }
  var b6 = tierEra(true, "Gen 6"), bN = tierEra(true, "Next Gen"), o6 = tierEra(false, "Gen 6"), oN = tierEra(false, "Next Gen");
  var gap6 = o6.finish - b6.finish, gapN = oN.finish - bN.finish;
  function tierSeason(isBig, s) { return summarize(tier(isBig).filter(function (r) { return r.season === s; })); }
  finding(2,
    "The four best teams of 2019–2021 slipped " + f1(bN.finish - b6.finish) + " positions while the other eight gained " + f1(o6.finish - oN.finish) +
      ", narrowing the gap from " + f1(gap6) + " to " + f1(gapN) + " positions",
    [
      "The four groups with the best average finish in 2019–2021 were " + names(big.map(shortName)) + ". Together they averaged " + f1(b6.finish) + " in 2019–2021 and " + f1(bN.finish) +
        " in 2022–2024, and their top-10 rate fell from " + pct1(b6.top10) + " to " + pct1(bN.top10) + ". The other eight groups averaged " + f1(o6.finish) + " and then " + f1(oN.finish) +
        ", with their top-10 rate rising from " + pct1(o6.top10) + " to " + pct1(oN.top10) + ".",
      "For a team that was already near the front, a slide of " + f1(bN.finish - b6.finish) + " positions was the average for the leaders."
    ],
    {
      title: "Average finish by season",
      subtitle: "Lower is better. The four best groups of 2019–2021 against the other eight.",
      draw: function (c) {
        Charts.lineChart(c, {
          xs: SEASONS,
          series: [
            { name: "Four best of 2019–2021", color: "var(--series-1)", values: SEASONS.map(function (s) { return tierSeason(true, s).finish; }) },
            { name: "Other eight", color: "var(--series-2)", values: SEASONS.map(function (s) { return tierSeason(false, s).finish; }) }
          ],
          yFormat: f1, tipFormat: f2, ariaLabel: "Line chart of average finish by season for the four best groups of 2019 to 2021 and the other eight"
        });
      },
      table: buildTable([
        { head: "Season", get: function (s) { return String(s); } },
        { head: "Four best: results", get: function (s) { return int(tierSeason(true, s).n); } },
        { head: "Four best: avg finish", get: function (s) { return f2(tierSeason(true, s).finish); } },
        { head: "Other eight: results", get: function (s) { return int(tierSeason(false, s).n); } },
        { head: "Other eight: avg finish", get: function (s) { return f2(tierSeason(false, s).finish); } }
      ], SEASONS, { caption: "By season. Four best: " + names(big.map(shortName)) + "." })
    });

  /* ----- finding 3: top-10 positions taken by teams outside the file ----- */
  var seasonShare = SEASONS.map(function (s) { return top10Share(rows, [s]); });
  finding(3,
    "Teams outside this file took more of the top 10: these 12 groups held " + pct1(share6.share) + " of top-10 finishing positions in 2019–2021 but " + pct1(shareNG.share) + " in 2022–2024",
    [
      "Every race has ten top-10 finishing positions. The file holds only these 12 groups, so whatever they did not hold went to other teams. Their share was " +
        seasonShare.map(function (x) { return pct1(x.share); }).join(", ") + " for 2019 through 2024, in that order. In the full results file, the winners from outside these 12 groups were Chip Ganassi Racing, 23XI Racing, Kaulig Racing and Trackhouse Racing.",
      "This matters for any comparison of finishing positions. Because positions are counted against the whole field, the 12 groups’ combined average finish drifted from " + f1(era6.finish) + " in 2019–2021 to " + f1(eraNG.finish) +
        " in 2022–2024 even before asking which team improved. A team that merely held its place against the full field would still show a worse number, which is why rank among peers is the fairer yardstick."
    ],
    {
      title: "Share of top-10 finishing positions held by the 12 groups",
      subtitle: "Top-10 results in the file divided by 10 positions per race.",
      draw: function (c) {
        Charts.columnChart(c, {
          items: SEASONS.map(function (s, i) { return { label: String(s), value: seasonShare[i].share,
            extra: [seasonShare[i].held + " of " + (10 * seasonShare[i].races) + " top-10 positions"] }; }),
          color: "var(--series-1)", domain: [0, 1], yFormat: function (v) { return Math.round(v * 100) + "%"; }, tipFormat: pct1,
          valueName: "of top-10 positions", ariaLabel: "Column chart of the share of top-10 finishing positions held by the 12 groups, by season"
        });
      },
      table: buildTable([
        { head: "Season", get: function (x) { return String(x.s); } },
        { head: "Races", get: function (x) { return String(x.r.races); } },
        { head: "Top-10 positions held", get: function (x) { return int(x.r.held); } },
        { head: "Top-10 positions available", get: function (x) { return int(10 * x.r.races); } },
        { head: "Share held", get: function (x) { return pct1(x.r.share); } }
      ], SEASONS.map(function (s, i) { return { s: s, r: seasonShare[i] }; }), { caption: "By season." })
    });

  /* ----- finding 4: Spire and Rick Ware ----- */
  var sp = "Spire Motorsports", rw = "Rick Ware Racing";
  function gs(g, s) { return summarize(rows.filter(function (r) { return r.group === g && r.season === s; })); }
  function drv(g, s) { return distinct(rows.filter(function (r) { return r.group === g && r.season === s; }), "driver"); }
  var sp19 = gs(sp, 2019).finish, sp21 = gs(sp, 2021).finish, sp24 = gs(sp, 2024).finish;
  var rw19 = gs(rw, 2019).finish, rw21 = gs(rw, 2021).finish, rw24 = gs(rw, 2024).finish;
  finding(4,
    "Spire’s gain began before the Next Gen car: it improved " + f1(sp19 - sp21) + " positions from 2019 to 2021 and " + f1(sp21 - sp24) + " more by 2024",
    [
      "Spire went from " + f1(sp19) + " in 2019 to " + f1(sp21) + " in 2021 and " + f1(sp24) + " in 2024. Its results per season rose from " + gs(sp, 2019).n + " to " + gs(sp, 2024).n +
        ", about one full-time car to about three, and it used " + by[sp].da + " different drivers in 2019–2021 and " + by[sp].db + " in 2022–2024 (" + names(SEASONS.map(function (s) { return drv(sp, s); })) + " drivers per season, 2019 to 2024).",
      "Rick Ware improved from " + f1(rw19) + " in 2019 to " + f1(rw21) + " in 2021 and " + f1(rw24) + " in 2024, most of it after 2021, but it used " + by[rw].da + " and " + by[rw].db +
        " different drivers in the two periods, so its average largely reflects who happened to drive. The file cannot separate the car from changes in drivers, cars fielded or ownership, so both of these gains are flagged and should not be read as the effect of the Next Gen car."
    ],
    {
      title: "Average finish by season: Spire, Rick Ware and all 12 groups",
      subtitle: "Lower is better. All 12 groups combined is shown for context.",
      draw: function (c) {
        Charts.lineChart(c, {
          xs: SEASONS,
          series: [
            { name: "Spire Motorsports", color: "var(--series-1)", values: SEASONS.map(function (s) { return gs(sp, s).finish; }) },
            { name: "Rick Ware Racing", color: "var(--series-2)", values: SEASONS.map(function (s) { return gs(rw, s).finish; }) },
            { name: "All 12 groups", color: "var(--context)", values: SEASONS.map(function (s) { return summarize(rows.filter(function (r) { return r.season === s; })).finish; }) }
          ],
          yFormat: f1, tipFormat: f2, ariaLabel: "Line chart of average finish by season for Spire, Rick Ware and all 12 groups"
        });
      },
      table: buildTable([
        { head: "Season", get: function (s) { return String(s); } },
        { head: "Spire results", get: function (s) { return int(gs(sp, s).n); } },
        { head: "Spire avg finish", get: function (s) { return f2(gs(sp, s).finish); } },
        { head: "Spire drivers", get: function (s) { return String(drv(sp, s)); } },
        { head: "Rick Ware results", get: function (s) { return int(gs(rw, s).n); } },
        { head: "Rick Ware avg finish", get: function (s) { return f2(gs(rw, s).finish); } },
        { head: "Rick Ware drivers", get: function (s) { return String(drv(rw, s)); } },
        { head: "All 12 avg finish", get: function (s) { return f2(summarize(rows.filter(function (r) { return r.season === s; })).finish); } }
      ], SEASONS, { caption: "By season." })
    });

  /* ----- finding 5: did-not-finish rate ----- */
  var dnfSeason = SEASONS.map(function (s) { return summarize(rows.filter(function (r) { return r.season === s; })); });
  var peak = dnfSeason.reduce(function (m, x, i) { return x.dnf > dnfSeason[m].dnf ? i : m; }, 0);
  function statusCount(era, st) { return rows.filter(function (r) { return r.era === era && r.status === st; }).length; }
  var dnfSorted = T.slice().sort(function (a, b) { return b.dnfGain - a.dnfGain; });
  var dnfWorse = dnfSorted[dnfSorted.length - 1], dnfBetter = dnfSorted[0];
  finding(5,
    "The did-not-finish rate rose from " + pct1(era6.dnf) + " in 2019–2021 to " + pct1(eraNG.dnf) + " in 2022–2024, peaking at " + pct1(dnfSeason[peak].dnf) + " in " + SEASONS[peak],
    [
      "A result counts as a did-not-finish when its Status is anything other than “running”. Accidents were " + statusCount("Gen 6", "accident") + " of the " + int(era6.n * era6.dnf) +
        " non-finishes in 2019–2021 and " + statusCount("Next Gen", "accident") + " of the " + int(eraNG.n * eraNG.dnf) + " in 2022–2024, and the “DVP” status rose from " + statusCount("Gen 6", "DVP") + " to " + statusCount("Next Gen", "DVP") + ".",
      "By team, " + shortName(dnfWorse.group) + " went from " + pct1(dnfWorse.sa.dnf) + " to " + pct1(dnfWorse.sb.dnf) + " and " + shortName(dnfBetter.group) + " from " + pct1(dnfBetter.sa.dnf) + " to " + pct1(dnfBetter.sb.dnf) +
        ". Teams differ a lot here, so a team’s change in average finish can partly be a change in how often its cars finish the race."
    ],
    {
      title: "Did-not-finish rate by season",
      subtitle: "Share of results whose Status is not “running”.",
      draw: function (c) {
        Charts.columnChart(c, {
          items: SEASONS.map(function (s, i) { return { label: String(s), value: dnfSeason[i].dnf, extra: [Math.round(dnfSeason[i].n * dnfSeason[i].dnf) + " of " + int(dnfSeason[i].n) + " results"] }; }),
          color: "var(--series-2)", yFormat: function (v) { return Math.round(v * 100) + "%"; }, tipFormat: pct1,
          valueName: "did not finish", ariaLabel: "Column chart of the did-not-finish rate by season"
        });
      },
      table: buildTable([
        { head: "Season", get: function (x) { return String(x.s); } },
        { head: "Results", get: function (x) { return int(x.r.n); } },
        { head: "Did not finish", get: function (x) { return int(Math.round(x.r.n * x.r.dnf)); } },
        { head: "Rate", get: function (x) { return pct1(x.r.dnf); } }
      ], SEASONS.map(function (s, i) { return { s: s, r: dnfSeason[i] }; }), { caption: "By season." })
    });

  setupReveal(Array.prototype.slice.call(host.querySelectorAll(".finding")));

  /* ----- closing section ----- */
  var about = document.getElementById("about");
  about.appendChild(el("h2", { text: "About the data" }));
  function dl(items) {
    var d = el("dl");
    items.forEach(function (it) { d.appendChild(el("dt", { text: it[0] })); d.appendChild(el("dd", { text: it[1] })); });
    return d;
  }
  about.appendChild(el("h3", { text: "Where the data come from and what one row is" }));
  about.appendChild(dl([
    ["Source", "Race results from the nascaR.data R package (published on CRAN), which says its data was sourced with permission from DriverAverages.com. I found the package with help from Claude, an AI assistant. " +
      "The package’s Cup Series file is cup_series.csv; cup_next_gen.csv keeps its 2019–2024 results for 12 team groups and adds two labels: TeamGroup, a team name that follows renames, and Period, 2019–2021 or 2022–2024."],
    ["One row", "One driver’s result in one points race: season, race number, track, finish, start, car, driver, make, team, laps, laps led and status. The file has " + int(all.n) + " rows from " + nRaces + " races (36 per season), and no driver appears twice in a race."],
    ["TeamGroup", "The 12 groups are the teams that raced in all six seasons, with renames joined: Roush Fenway Racing is RFK Racing, and Richard Petty Motorsports and Petty GMS Motorsports are Legacy Motor Club."]
  ]));
  about.appendChild(el("h3", { text: "Which rows are dropped, and why" }));
  about.appendChild(el("p", { text: "This report drops no rows from cup_next_gen.csv; every one of the " + int(all.n) + " rows is counted on every chart. The file itself already leaves out 1,854 results (22.7% of the 8,175 results for 2019–2024 in the full results file) from teams that did not race in all six seasons, such as Chip Ganassi Racing, 23XI Racing, Trackhouse Racing and Kaulig Racing. As a result 22 races have no winning row, so this report does not count wins." }));
  about.appendChild(el("h3", { text: "How each summary number is computed" }));
  about.appendChild(dl([
    ["Driver-race results", "The count of rows in the current view."],
    ["Average finish", "The mean of Finish over those rows. Finish is the position in the full field of up to 40 cars, so the file’s finishes skip numbers where other teams finished. Lower is better."],
    ["Top-10 rate", "The share of those rows with Finish of 10 or better."],
    ["Did-not-finish rate", "The share of those rows whose Status is anything other than “running” (accident, engine, DVP and so on)."]
  ]));
  about.appendChild(el("h3", { text: "Other definitions" }));
  about.appendChild(dl([
    ["Positions gained", "A group’s average finish in 2019–2021 minus its average finish in 2022–2024. Differences are computed from unrounded averages, so a difference can differ by 0.1 from the difference of two rounded figures."],
    ["Flags", "† means 15 or more different drivers in either period. ‡ means fewer than 150 results in either period, about one car. The flags are computed from the whole file and do not change with the dashboard’s filters."],
    ["Four best of 2019–2021", "The four groups with the lowest average finish in 2019–2021: " + names(big.map(shortName)) + "."],
    ["Top-10 share", "Top-10 results in the file divided by ten positions per race, for the seasons shown."]
  ]));
  about.appendChild(el("h3", { text: "Limits" }));
  about.appendChild(el("p", { text: "The data show what changed, not why. Driver changes, cars fielded and ownership moves all happen in the same years as the new car, and the file cannot separate them. The file ends with the 2024 season. The two periods being compared are equal: three full 36-race seasons each (108 races), so no partial season is compared with a full one. The Status column was not independently verified. A spot check of the top finishers in six races, one per season, against published race results found no differences in finish, start, car or driver." }));
  /* ----- agreement between the website and the Tableau dashboard ----- */
  var TABLEAU_URL = "https://public.tableau.com/app/profile/tyler.eldringhoff/viz/NascarCupTeamDashboard/NASCARDashboard";
  // The four numbers read from the published Tableau dashboard with Season and Team Group both on (All).
  var TABLEAU_NUMBERS = ["6,321", "18.45", "29.0%", "12.9%"];
  var siteNumbers = [int(all.n), f2(all.finish), pct1(all.top10), pct1(all.dnf)];
  var agree = ["Driver-race results", "Average finish", "Top-10 rate", "Did-not-finish rate"].map(function (name, i) {
    return { name: name, site: siteNumbers[i], tableau: TABLEAU_NUMBERS[i], ok: siteNumbers[i] === TABLEAU_NUMBERS[i] };
  });
  var allAgree = agree.every(function (r) { return r.ok; });
  about.appendChild(el("h3", { text: "Do the website and Tableau agree?" }));
  about.appendChild(el("p", { text: "Both builds were set to the same filters (all seasons and all 12 team groups), so both count the same " + int(all.n) +
    " driver-race results. " + (allAgree ? "All four summary numbers match, so the two builds agree." : "At least one number differs; see the table.") }));
  about.appendChild(buildTable([
    { head: "Summary number", get: function (r) { return r.name; } },
    { head: "Website", get: function (r) { return r.site; } },
    { head: "Tableau", get: function (r) { return r.tableau; } },
    { head: "Match", get: function (r) { return r.ok ? "Yes" : "No"; } }
  ], agree, { caption: "The four summary numbers at the default filters." }));
  about.appendChild(el("p", {}, ["Tableau Public dashboard: ",
    el("a", { href: TABLEAU_URL, target: "_blank", rel: "noopener", text: TABLEAU_URL })]));
  about.appendChild(el("p", { "class": "note", text: "Use the Dashboard to filter by season and team group; its four summary numbers use the same definitions as above." }));
}
