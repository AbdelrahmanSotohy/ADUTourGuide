# ADU Tour Guide

Independent static student toolkit. No dependencies, build step, accounts, or backend.

## Run
Open `index.html` or serve this folder with VS Code Live Server / `python3 -m http.server 8000`. For GitHub Pages, upload the contents of this folder to the repository, then enable Pages for that branch and folder. Relative links support repository subpaths.

## Included tools
- GPA Calculator: current cumulative GPA and completed GPA credits plus added courses, live updates, 0–8 course-credit dropdown in 0.5 steps, ADU grade table, and a compact centered result. CSV includes prior GPA settings; original course-only CSV files remain supported and preserve the current prior-GPA settings. Existing course-list saves migrate automatically.
- Schedule Generator: one block per CSV row; same Course + Section groups meetings. All chosen courses receive one section; same-day overlap is rejected, touching times allowed. Search generates every schedule up to 2 million search states or 10,000 schedules and offers pages of 50 results. Narrow sections for larger searches.
- Degree Planner: four years × Fall / Spring / Summer / Winter, manual placement using year/semester selectors; semester and year credit totals.
- Project Work Split: 8 members maximum, shared phases, task/checklist/date/notes, phase and member progress, least-completed phase flags. Unique member and phase names are required for CSV.
- GPA Planner: cumulative weighted calculation requires completed GPA credits. 1–12 semester courses, individual credit hours. Search displays at most 200 examples and visits at most 500,000 states, with explicit truncation messages.
- Grade Planner: earned/possible × assessment weight; weights including remaining must total 100. Needed remaining average = (grade threshold − weighted points earned) / remaining weight × 100.

## ADU scale supplied for this project
A 4.0 (90+), B+ 3.5 (85+), B 3.0 (80+), C+ 2.5 (75+), C 2.0 (70+), D+ 1.5 (65+), D 1.0 (60+), F 0.0 (below 60).

## Data and CSV
Each tool uses its own `adu-tour-guide:` localStorage key with 350 ms debounce and page-exit flush. Storage errors are shown; use CSV backups. Different browsers, domains, and devices have separate data. Imports validate the complete file before replacing state; use a previously exported CSV with exact headers. UTF-8 BOM, commas, quotes, and multiline notes are supported through Blob and FileReader, without libraries. Keep backups before imports. Avoid running untrusted CSV text as spreadsheet formulas; CSV files are intended for this app's reimport.

## Shared files
`shared.css` / `shared.js`: common theme and fixed responsive navigation. `storage.js` / `csv.js`: persistence and CSV helpers. `table.js`: reusable row editor. Each page has its own index.html, style.css, script.js, with shared assets loaded first.

No data is sent to a server. Personal student planning estimates do not account for repeat-course policies, transcript exceptions, or prerequisites.

## Verification
Run `node tests/verify.cjs` for dependency-free calculation, CSV, and asset checks. Browser visual and responsive checks require a real browser and were not run in the delivery environment because Chromium was unavailable.
