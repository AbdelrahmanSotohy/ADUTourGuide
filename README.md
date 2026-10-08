# ADU Tour Guide

I built ADU Tour Guide to help students plan their semester and degree in one place. It includes six tools for tracking grades, planning courses, finding schedules and splitting group projects.

The whole site uses plain HTML, CSS and JavaScript. It’s free, needs no sign-up, and runs without a backend, frameworks or a build step.


## Tools

- **GPA Calculator:** Calculate your semester and cumulative GPA using ADU’s grading scale. Enter your current GPA, completed credit hours and this semester’s courses.
- **Schedule Generator:** Add courses and their available sections, then generate schedules without overlapping lecture times. View the results as weekly timetables.
- **Degree Planner:** Plan courses year by year, with live semester totals and cumulative credits. Start with Fall and Spring, and add Winter or Summer when needed.
- **GPA Planner:** Enter your current GPA, completed credits and target GPA to see possible grade combinations. Courses with the same credit hours are grouped to avoid duplicate results.
- **Grade Planner:** Enter your assessment scores and weights to see what you need on the remaining work to reach each grade.
- **Project Work Split:** Organize tasks across shared project phases for up to eight members. Track completion by member, phase and overall progress.

## ADU grading scale

A 4.0 (90+), B+ 3.5 (85+), B 3.0 (80+), C+ 2.5 (75+), C 2.0 (70+), D+ 1.5 (65+), D 1.0 (60+), F 0.0 (below 60).

## Saving your data

Your inputs save automatically in your browser using localStorage. Each tool saves its data separately.

Saved inputs aren’t included in the project files and don’t automatically transfer between browsers, devices or website addresses. Clearing your browser’s site data will also remove them.

Use **Export CSV** to keep a backup, then **Import CSV** to restore it or move it to another device. For imports, use the format exported by the tool.

## Project structure

Each tool has its own folder containing:

- `index.html`
- `style.css`
- `script.js`

The root folder contains the home page and shared files:

- `shared.css` and `shared.js` for common styling and the responsive navbar.
- `storage.js` and `csv.js` for saving data and handling CSV files.
- `table.js` for reusable table editing.

## A quick note

This is a personal student project for planning and estimates. It doesn’t check prerequisites, degree requirements, repeat-course policies or transcript exceptions.

## About me

Built by **Abdelrahman Sotohy**.

Found a bug or have an idea? Message me on [LinkedIn](https://www.linkedin.com/in/abdelrahman-sotohy-6986b8369/).