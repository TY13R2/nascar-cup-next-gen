# NASCAR Cup Teams Before and After the Next Gen Car, 2019-2024

A two-page website for FINN 43303 Project B. It asks: **Among the 12 team groups that raced in every Cup Series season from 2019 to 2024, which gained or lost the most average finishing position after the Next Gen car replaced the Gen 6 car in 2022?**

- **Reader:** a competition director at an established Cup team who wants to benchmark against the 11 other teams that raced every season.
- **Rows counted:** one row is one driver's finish in one Cup Series race for one of the 12 groups: 6,321 results from 216 races.
- **Period:** 2019-2024, six full 36-race seasons, comparing 2019-2021 (Gen 6) with 2022-2024 (Next Gen).

## Files

| File | What it is |
|---|---|
| `index.html` | The report page: answer and recommendation, four summary numbers, five findings with charts and "View the numbers" tables, and the "About the data" section. |
| `dashboard.html` | The dashboard page: filters (season, team group, measure), the same four summary numbers, three charts and a table, all changing with the filters. |
| `styles.css` | One shared look for both pages, with light and dark themes. |
| `data.js` | Loads the CSV and holds every definition (the four summary numbers, positions gained, the flags). Both pages use it, so the numbers agree. |
| `charts.js` | A small dependency-free SVG chart library (line, column, diverging bars, grouped bars) with hover and keyboard tooltips. |
| `report.js` | Builds the report page text, charts and tables from the data. |
| `dashboard.js` | Builds the filters and the filtered view. |
| `cup_next_gen.csv` | The data file (6,321 rows). |
| `README.md` | This file. |

No libraries or build step are used. All calculations run in the browser from `cup_next_gen.csv`.

## Where the data came from

`cup_next_gen.csv` holds the 2019-2024 results of 12 team groups. The results come from the Cup Series data of the [nascaR.data](https://cran.r-project.org/package=nascaR.data) R package (`cup_series.csv`); that package says its data was sourced with permission from DriverAverages.com. `cup_next_gen.csv` adds two labels: `TeamGroup` (a team name that follows renames) and `Period` (2019-2021 or 2022-2024).

Tyler Eldringhoff found the package with help from Claude's web-based AI. The pages were built with Claude Code; the question, definitions and every number are the author's responsibility.

The 12 groups are the teams that raced in all six seasons, with renames joined (Roush Fenway Racing = RFK Racing; Richard Petty Motorsports and Petty GMS Motorsports = Legacy Motor Club). Results from other teams (for example 23XI Racing, Trackhouse Racing, Chip Ganassi Racing, Kaulig Racing) are not in the file: 1,854 results, 22.7% of the 8,175 results for 2019-2024 in the full file. Because of that, 22 races have no winning row, so the project does not count wins.

## Columns in `cup_next_gen.csv`

`Season`, `Race` (race number in the season), `Track`, `Length`, `Surface`, `Finish`, `Start`, `Car`, `Driver`, `Make`, `Team` (the name used at the time), `TeamGroup`, `Period`, `Laps`, `Led`, `Status`, `Win`.

## Definitions (use the same ones in Tableau)

| Label | Definition |
|---|---|
| Driver-race results | Count of rows in the current view. |
| Average finish | Mean of `Finish` over those rows. Lower is better. |
| Top-10 rate | Share of rows with `Finish` of 10 or better. |
| Did-not-finish rate | Share of rows whose `Status` is anything other than `running`. |
| Positions gained | A group's average finish in 2019-2021 minus its average finish in 2022-2024. Positive means it finished higher up. (`reference_team_changes.csv` shows the opposite sign.) |
| Flags | † 15 or more different drivers in either period. ‡ fewer than 150 results in either period, about one car. Computed on the whole file. |
| Four best of 2019-2021 | The four groups with the lowest average finish in 2019-2021. |
| Top-10 share | Top-10 results in the file divided by 10 positions per race. |

Default values with no filters: **6,321** results, average finish **18.45**, top-10 rate **29.0%**, did-not-finish rate **12.9%**.

## Run it locally

The pages load the CSV with `fetch`, so open them through a web server rather than from disk:

```bash
python -m http.server 8765
```

Then open <http://localhost:8765/index.html>.

## Still to do before submitting

1. Create the public GitHub repository, push these files, and turn on GitHub Pages.
2. Build the Tableau Public dashboard with the same four summary numbers and labels.
3. Add the agreement table (website vs Tableau) and the Tableau link to the closing section of the report page.
