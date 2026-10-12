'use strict';
// Everything here is local to this tool. shared.js still controls the navbar.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEADERS = ['Course', 'Section', 'Professor', 'Day', 'Start', 'End'];
const COLORS = ['#0b233f', '#126d91', '#376961', '#675582', '#725c45', '#305d85'];
const LIMIT = 500,
  STEP_LIMIT = 100000,
  PAGE_SIZE = 5;
const find = selector => document.querySelector(selector);
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
// Add the prefix once, including for previously saved labels like "Section 1".
function sectionName(label) {
  return 'Section ' + String(label).trim().replace(/^section\s+/i, '');
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
let courses = [],
  combinations = [],
  editing = null,
  shown = null,
  page = 0;
let saveTimer, searchToken = 0;

// Native window.confirm can be blocked inside embedded site previews.
// Use our own accessible confirmation overlay instead.
let pendingConfirmation = null,
  confirmationFocus = null,
  previousOverflow = '';

function askConfirmation(text, action = 'Confirm') {
  if (pendingConfirmation) return Promise.resolve(false);
  return new Promise(resolve => {
    pendingConfirmation = resolve;
    confirmationFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    find('#confirmation-text').textContent = text;
    find('#confirmation-accept').textContent = action;
    find('#confirmation').hidden = false;
    document.body.style.overflow = 'hidden';
    find('#confirmation-cancel').focus();
  });
}

function finishConfirmation(accepted) {
  if (!pendingConfirmation) return;
  const resolve = pendingConfirmation;
  pendingConfirmation = null;
  find('#confirmation').hidden = true;
  document.body.style.overflow = previousOverflow;
  if (confirmationFocus?.isConnected) confirmationFocus.focus();
  resolve(accepted);
}
find('#confirmation-accept').onclick = () => finishConfirmation(true);
find('#confirmation-cancel').onclick = () => finishConfirmation(false);
find('#confirmation').onclick = event => {
  if (event.target === find('#confirmation')) finishConfirmation(false);
};
document.addEventListener('keydown', event => {
  if (!pendingConfirmation) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    finishConfirmation(false);
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    const cancel = find('#confirmation-cancel'),
      accept = find('#confirmation-accept');
    (document.activeElement === cancel ? accept : cancel).focus();
  }
});

function message(text, error = false) {
  find('#status').textContent = text;
  find('#status').classList.toggle('warning', error);
}

function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Enter valid start and end times.');
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
// Strict comparisons allow a class to start exactly when another one ends.
function overlap(a, b) {
  return a.days.some(day => b.days.includes(day)) &&
    minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}

function sectionConflict(a, b) {
  return a.blocks.some(x => b.blocks.some(y => overlap(x, y)));
}

function validateSection(section) {
  if (!section.blocks.length || section.blocks.length > 20) throw Error('Use 1–20 meeting blocks per section.');
  section.blocks.forEach((block, i) => {
    if (!block.days.length || block.days.some(day => !DAYS.includes(day))) throw Error(`Select at least one lecture day.`);
    if (minutes(block.end) <= minutes(block.start)) throw Error(`Lecture end time must be after start time.`);
    if (section.blocks.slice(i + 1).some(other => overlap(block, other))) throw Error('Meeting blocks inside this section overlap.');
  });
}

function saveNow() {
  try {
    localStorage.setItem('scheduleGenerator', JSON.stringify(courses));
  } catch {
    message('Auto-save is unavailable. Export CSV to keep a backup.', true);
  }
}

function changed() {
  // Any edit cancels an old search and removes stale results.
  searchToken++;
  combinations = [];
  shown = null;
  closeCalendar();
  find('#generate').disabled = false;
  find('#results').hidden = true;
  find('#weekly').hidden = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}
window.addEventListener('pagehide', saveNow);

function courseMarkup(course) {
  return `<article class="card course-card">
    <label>Course name or code<input maxlength="100" data-rename="${course.id}" value="${safe(course.name)}"></label>
    <div class="course-actions"><button data-add="${course.id}">+ Add section</button><button class="danger" data-delete-course="${course.id}">Delete course</button></div>
    ${course.sections.map(section => `<div class="section-item">
      <strong>${safe(sectionName(section.label))}</strong> <small>${safe(section.professor) || 'Professor not specified'}</small>
      <p>${section.blocks.map(b => `${b.days.join(', ')} · ${b.start}–${b.end}`).join('<br>')}</p>
      <div class="course-actions"><button class="secondary" data-edit="${section.id}" data-course="${course.id}">Edit section</button><button class="danger" data-delete-section="${section.id}" data-course="${course.id}">Delete section</button></div>
    </div>`).join('') || '<p class="muted">No sections yet. Add one to include this course.</p>'}
  </article>`;
}

function renderCourses() {
  find('#courses').innerHTML = courses.map(courseMarkup).join('') || '<p class="muted">Add your first course to get started.</p>';
}
find('#course-form').onsubmit = event => {
  event.preventDefault();
  const name = find('#course-name').value.trim();
  if (!name) return message('Enter a course name or code.', true);
  if (courses.length >= 30) return message('Use at most 30 courses per search.', true);
  if (courses.some(c => c.name.toLowerCase() === name.toLowerCase())) return message('That course already exists. Add sections to its card.', true);
  courses.push({
    id: uid(),
    name,
    sections: []
  });
  find('#course-name').value = '';
  changed();
  renderCourses();
  message('Course added. Now add its sections.');
};
find('#courses').onchange = event => {
  const input = event.target;
  if (!input.dataset.rename) return;
  const course = courses.find(c => c.id === input.dataset.rename),
    name = input.value.trim();
  if (!name || courses.some(c => c.id !== course.id && c.name.toLowerCase() === name.toLowerCase())) {
    input.value = course.name;
    return message('Use a nonempty, unique course name.', true);
  }
  course.name = name;
  changed();
  message('Course renamed.');
};
find('#courses').onclick = async event => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.add || button.dataset.deleteCourse || button.dataset.course;
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (button.dataset.add) return openEditor(course, null);
  if (button.dataset.edit) return openEditor(course, course.sections.find(s => s.id === button.dataset.edit));
  const deletingCourse = Boolean(button.dataset.deleteCourse);
  const text = deletingCourse ? `Delete ${course.name} and all its sections?` : `Delete this section of ${course.name} and its meeting blocks?`;
  if (!await askConfirmation(text, deletingCourse ? 'Delete course' : 'Delete section')) return;
  if (button.dataset.deleteCourse) courses = courses.filter(c => c.id !== course.id);
  else course.sections = course.sections.filter(s => s.id !== button.dataset.deleteSection);
  closeEditor();
  changed();
  saveNow();
  renderCourses();
  message('Deleted.');
};

// The section editor uses a temporary draft; Save commits it to the course.
function openEditor(course, section) {
  if (!section && course.sections.length >= 50) return message('Use at most 50 sections per course.', true);
  editing = {
    courseId: course.id,
    sectionId: section?.id ?? null
  };
  find('#editor-title').textContent = `${section ? 'Edit' : 'Add'} section · ${course.name}`;
  find('#section-label').value = section?.label ?? '';
  find('#professor').value = section?.professor ?? '';
  renderBlocks(section?.blocks.slice(0, 1) ?? [{
    days: [],
    start: '09:00',
    end: '10:00'
  }]);
  find('#editor-status').textContent = section?.blocks.length > 1 ? 'This older section has multiple times. Saving will replace them with the single lecture time shown below.' : '';
  find('#editor').hidden = false;
  find('#editor').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function closeEditor() {
  editing = null;
  find('#editor').hidden = true;
}

function renderBlocks(blocks) {
  find('#blocks').innerHTML = blocks.map((b, i) => `<fieldset class="meeting">
    <legend>Lecture time</legend><div class="days">${DAYS.map(day => `<label><input type="checkbox" value="${day}" ${b.days.includes(day) ? 'checked' : ''}>${day}</label>`).join('')}</div>
    <div class="fields"><label>Start time<input type="time" data-start required value="${safe(b.start)}"></label><label>End time<input type="time" data-end required value="${safe(b.end)}"></label></div>
  </fieldset>`).join('');
}

function readBlocks() {
  return [...find('#blocks').querySelectorAll('.meeting')].map(block => ({
    days: [...block.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value),
    start: block.querySelector('[data-start]').value,
    end: block.querySelector('[data-end]').value
  }));
}
find('#cancel').onclick = closeEditor;
find('#section-form').onsubmit = event => {
  event.preventDefault();
  try {
    const course = courses.find(c => c.id === editing.courseId);
    let label = find('#section-label').value.trim();
    if (!label) {
      let n = 1;
      while (course.sections.some(s => s.label === `Section ${n}`)) n++;
      label = `Section ${n}`;
    }
    if (course.sections.some(s => s.id !== editing.sectionId && s.label.toLowerCase() === label.toLowerCase())) throw Error('Use a unique section label for this course.');
    const section = {
      id: editing.sectionId ?? uid(),
      label,
      professor: find('#professor').value.trim(),
      blocks: readBlocks().slice(0, 1)
    };
    validateSection(section);
    const index = course.sections.findIndex(s => s.id === editing.sectionId);
    if (index < 0) course.sections.push(section);
    else course.sections[index] = section;
    closeEditor();
    changed();
    renderCourses();
    message('Section saved.');
  } catch (error) {
    find('#editor-status').textContent = error.message;
  }
};
find('#clear').onclick = async () => {
  if (!await askConfirmation('Clear all entered courses and sections?', 'Clear all')) return;
  courses = [];
  closeEditor();
  changed();
  saveNow();
  renderCourses();
  message('All courses cleared.');
};

// Backtracking: choose one section per course and prune conflicting branches.
find('#generate').onclick = () => {
  if (editing) return message('Save or cancel the section editor before generating.', true);
  if (!courses.length) return message('Add at least one course.', true);
  const missing = courses.find(c => !c.sections.length);
  if (missing) return message(`Add a section for ${missing.name}.`, true);
  try {
    courses.forEach(c => c.sections.forEach(validateSection));
  } catch (error) {
    return message(error.message, true);
  }
  const token = ++searchToken;
  let stack = [{
      depth: 0,
      selected: []
    }],
    steps = 0,
    capped = false;
  combinations = [];
  shown = null;
  page = 0;
  closeCalendar();
  find('#results').hidden = true;
  find('#weekly').hidden = true;
  find('#generate').disabled = true;
  message('Searching…');

  function chunk() {
    if (token !== searchToken) return;
    let work = 0;
    while (stack.length && work++ < 500) {
      const state = stack.pop();
      if (++steps > STEP_LIMIT) {
        capped = true;
        break;
      }
      if (state.depth === courses.length) {
        combinations.push(state.selected);
        if (combinations.length >= LIMIT && stack.length) {
          capped = true;
          break;
        }
      } else {
        const course = courses[state.depth];
        for (let i = course.sections.length - 1; i >= 0; i--) {
          const section = course.sections[i];
          if (!state.selected.some(chosen => sectionConflict(chosen.section, section))) {
            stack.push({
              depth: state.depth + 1,
              selected: [...state.selected, {
                course,
                section
              }]
            });
          }
        }
      }
    }
    if (stack.length && !capped) {
      setTimeout(chunk, 0);
      return;
    }
    find('#generate').disabled = false;
    find('#results').hidden = false;
    find('#result-count').textContent = `${combinations.length} valid combinations${capped ? ' found so far' : ''}`;
    find('#result-note').textContent = capped ? 'Search capped at 500 results or 100,000 steps. Narrow the entered sections and try again; this list may be incomplete.' : combinations.length ? 'Every valid combination is available below.' : noResultsMessage();
    renderResults();
    message(capped ? 'Search limit reached.' : 'Search complete.');
  }
  chunk();
};

function noResultsMessage() {
  // Identify a pair only when every section pairing between them conflicts.
  for (let i = 0; i < courses.length; i++)
    for (let j = i + 1; j < courses.length; j++) {
      if (courses[i].sections.every(a => courses[j].sections.every(b => sectionConflict(a, b)))) {
        return `No valid schedule: every section of ${courses[i].name} conflicts with ${courses[j].name}.`;
      }
    }
  return 'No valid schedule can include all courses. Try other sections or meeting times.';
}

function renderResults() {
  const pages = Math.max(1, Math.ceil(combinations.length / PAGE_SIZE));
  find('#result-list').innerHTML = combinations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((combo, i) => {
    const index = page * PAGE_SIZE + i;
    return `<article class="combination-timetable"><h3>Combination ${index + 1}</h3>
      <p class="muted">${combo.map(x => `${safe(x.course.name)} · ${safe(sectionName(x.section.label))}`).join(' / ')}</p>
      <div class="week-scroll">${timetableMarkup(combo)}</div>
      <div class="legend">${legendMarkup(combo)}</div>
      <div class="toolbar"><button data-view="${index}">Open timetable</button><button class="secondary" data-calendar="${index}">Export to Calendar (.ics)</button><button class="secondary" data-export="${index}">Export this timetable CSV</button></div>
    </article>`;
  }).join('');
  find('#page-number').textContent = `Page ${page + 1} of ${pages}`;
  find('#previous').disabled = page === 0;
  find('#next').disabled = page >= pages - 1;
}
find('#previous').onclick = () => {
  page--;
  renderResults();
};
find('#next').onclick = () => {
  page++;
  renderResults();
};
find('#result-list').onclick = event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.calendar !== undefined) {
    openWeekly(Number(button.dataset.calendar));
    openCalendar();
  }
  if (button.dataset.view !== undefined) openWeekly(Number(button.dataset.view));
  if (button.dataset.export !== undefined) exportCombination(Number(button.dataset.export));
};

// Each column has absolutely positioned blocks. 1 minute = 1.2 CSS pixels.
function timetableMarkup(combo) {
  const blocks = combo.flatMap(x => x.section.blocks);
  const start = Math.floor(Math.min(...blocks.map(b => minutes(b.start))) / 60) * 60;
  const end = Math.ceil(Math.max(...blocks.map(b => minutes(b.end))) / 60) * 60;
  const height = (end - start) * 1.2;
  const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:00`;
  let rail = '';
  for (let t = start; t < end; t += 60) rail += `<span class="time-tick" style="top:${(t - start) * 1.2}px">${clock(t)}</span>`;
  return `<div class="week-grid"><div class="week-head">Time</div>${DAYS.map(day => `<div class="week-head">${day}</div>`).join('')}<div class="time-rail" style="height:${height}px">${rail}</div>${DAYS.map(day => `<div class="day-column" style="height:${height}px">${combo.map(({ course, section }) => section.blocks.filter(b => b.days.includes(day)).map(b => {
    const color = COLORS[courses.indexOf(course) % COLORS.length];
    const label = `${course.name} · ${sectionName(section.label)} · ${day} ${b.start}–${b.end} · ${section.professor}`;
  return `<div class="class-block" title="${safe(label)}" aria-label="${safe(label)}" style="top:${(minutes(b.start) - start) * 1.2}px;height:${(minutes(b.end) - minutes(b.start)) * 1.2}px;background:${color}"><strong>${safe(course.name)}</strong>${b.start}–${b.end}<br>${safe(sectionName(section.label))}<br>${safe(section.professor)}</div>`;
}).join('')).join('')
} < /div>`).join('')}</div > `;
}
function legendMarkup(combo) {
  return combo.map(({ course }) => ` < span > < i style = "background:${COLORS[courses.indexOf(course) % COLORS.length]}" > < /i>${safe(course.name)}</span > `).join('');
}
function openWeekly(index) {
  closeCalendar();
  shown = index;
  find('#weekly-grid').innerHTML = timetableMarkup(combinations[index]);
  find('#weekly-legend').innerHTML = legendMarkup(combinations[index]);
  find('#weekly-title').textContent = `
Combination $ {
  index + 1
}·
Weekly timetable`;
  find('#weekly').hidden = false;
  find('#weekly').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// CSV uses one row per individual day/time block. Blank sections preserve an empty course.
function rowsFor(list) {
  return list.flatMap(course => course.sections.length ? course.sections.flatMap(section => section.blocks.flatMap(b => b.days.map(day => [course.name, section.label, section.professor, day, b.start, b.end]))) : [[course.name, '', '', '', '', '']]);
}
function download(name, rows) {
  const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
  const text = '\uFEFF' + [HEADERS, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
find('#export-data').onclick = () => download('schedule-courses.csv', rowsFor(courses));
function exportCombination(index) {
  download(`
schedule - combination - $ {
  index + 1
}.csv`, rowsFor(combinations[index].map(x => ({ ...x.course, sections: [x.section] }))));
}
find('#export-combination').onclick = () => { if (shown !== null) exportCombination(shown); };
function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell !== '') throw Error('Malformed CSV quoting.');
      else quoted = !quoted;
    } else if (!quoted && [',', '\n', '\r'].includes(c)) {
      row.push(cell); cell = '';
      if (c !== ',') { if (c === '\r' && text[i + 1] === '\n') i++; if (row.some(v => v !== '')) rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed quote in CSV.');
  row.push(cell); if (row.some(v => v !== '')) rows.push(row);
  return rows;
}
function coursesFromRows(rows) {
  const result = [];
  rows.forEach((row, i) => {
    if (row.length !== 6) throw Error(`
CSV row $ {
  i + 2
}
must have six columns.
`);
    let [name, label, professor, day, start, end] = row.map(v => String(v).trim());
    if (!name) throw Error(`
CSV row $ {
  i + 2
}
needs a course.
`);
    let course = result.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!course) { course = { id: uid(), name, sections: [] }; result.push(course); }
    if (row.slice(1).every(v => String(v).trim() === '')) return;
    label = label || 'Section 1';
    let section = course.sections.find(s => s.label.toLowerCase() === label.toLowerCase());
    if (!section) { section = { id: uid(), label, professor, blocks: [] }; course.sections.push(section); }
    if (section.professor !== professor) throw Error(`
Use one professor name
for $ {
  name
}, $ {
  label
}.
`);
    const fullDays = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    day = DAYS.find(d => d.toLowerCase() === day.toLowerCase()) || fullDays[day.toLowerCase()];
    if (!day) throw Error(`
CSV row $ {
  i + 2
}
has an unknown day.
`);
    let block = section.blocks.find(b => b.start === start && b.end === end);
    if (!block) { block = { days: [], start, end }; section.blocks.push(block); }
    if (block.days.includes(day)) throw Error(`
Duplicate meeting in CSV row $ {
  i + 2
}.
`);
    block.days.push(day);
  });
  if (result.length > 30 || result.some(c => c.sections.length > 50)) throw Error('Use at most 30 courses and 50 sections per course.');
  result.forEach(c => c.sections.forEach(validateSection));
  return result;
}
find('#import-data').onclick = () => find('#csv-file').click();
find('#csv-file').onchange = event => {
  const file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  if (file.size > 2000000) return message('Use a CSV smaller than 2 MB.', true);
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rows = parseCSV(reader.result);
      if (!rows.length || rows[0].length !== 6 || HEADERS.some((h, i) => rows[0][i] !== h)) throw Error('CSV headers must be: ' + HEADERS.join(', '));
      const nextCourses = coursesFromRows(rows.slice(1));
      if (!await askConfirmation('Replace current courses with this CSV?', 'Import CSV')) return;
      courses = nextCourses; closeEditor(); changed(); renderCourses(); message('CSV imported.');
    } catch (error) { message(error.message, true); }
  };
  reader.onerror = () => message('The CSV could not be read.', true);
  reader.readAsText(file);
};

// Restore this version; migrate the earlier row-based tool only if the new key is absent.
try {
  const stored = localStorage.getItem('scheduleGenerator');
  if (stored !== null) {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length > 30) throw Error('Saved courses are invalid.');
    parsed.forEach(c => {
      if (!c.name || !Array.isArray(c.sections) || c.sections.length > 50) throw Error('Saved course is invalid.');
      c.sections.forEach(validateSection);
    });
    courses = parsed;
  } else {
    const legacy = JSON.parse(localStorage.getItem('adu-tour-guide:schedule-generator') || '[]');
    courses = coursesFromRows(legacy.map(r => [r.course, r.section, r.professor, r.day, r.start, r.end]));
  }
} catch (error) { message('Saved data could not be loaded: ' + error.message, true); }
renderCourses();

// Calendar export: explicit weekly dates keep local lecture times correct across DST.
function closeCalendar() {
  find('#calendar-options').hidden = true;
  find('#export-calendar').setAttribute('aria-expanded', 'false');
}
function openCalendar() {
  if (shown === null || !combinations[shown]) return;
  find('#calendar-options').hidden = false;
  find('#export-calendar').setAttribute('aria-expanded', 'true');
  find('#calendar-title').textContent = `
Export Combination $ {
  shown + 1
}
to your calendar`;
  find('#calendar-status').textContent = '';
  find('#calendar-start').focus();
}
find('#export-calendar').onclick = () => find('#calendar-options').hidden ? openCalendar() : closeCalendar();
find('#calendar-cancel').onclick = () => { closeCalendar(); find('#export-calendar').focus(); };

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Choose both semester dates.');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error('Choose valid semester dates.');
  return date;
}
function calendarText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}
function utcStamp(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
// Translate a wall-clock lecture time to UTC using the browser's time-zone database.
function lectureUTC(date, time, formatter) {
  const target = Date.parse(date + 'T' + time + ':00Z');
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const delta = target - wall;
    if (!delta) return new Date(guess);
    guess += delta;
  }
  throw Error('A lecture falls during a daylight-saving clock change. Adjust the dates or lecture time.');
}
// RFC 5545 folds long lines at 75 UTF-8 bytes, without splitting a character.
function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let result = '', bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
}
function buildCalendar(combo, startValue, endValue, zone) {
  const start = calendarDate(startValue), end = calendarDate(endValue);
  if (end < start) throw Error('The semester end date must be on or after its start date.');
  if (end - start > 366 * 86400000) throw Error('Choose a semester date range of up to one year.');
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch { throw Error('Enter a valid time zone, such as Asia/Dubai or Europe/London.'); }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ADU Tour Guide//Schedule Generator//EN', 'CALSCALE:GREGORIAN'];
  const stamp = utcStamp(new Date());
  let count = 0;
  combo.forEach(({ course, section }) => {
    validateSection(section);
    section.blocks.forEach(block => block.days.forEach(day => {
      const dates = [];
      for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        if (DAYS[(date.getUTCDay() + 6) % 7] !== day) continue;
        const dateText = date.toISOString().slice(0, 10);
        const from = lectureUTC(dateText, block.start, formatter);
        const to = lectureUTC(dateText, block.end, formatter);
        if (to <= from) throw Error('A lecture has an invalid duration during a clock change.');
        dates.push({ from, to });
      }
      // One series per weekday; PERIOD values preserve the end time of each occurrence.
      if (!dates.length) return;
      count += dates.length;
      const first = dates[0];
      lines.push('BEGIN:VEVENT', `
UID: $ {
  uid()
}
@adu - tour - guide`, `
DTSTAMP: $ {
  stamp
}
`,
        `
DTSTART: $ {
  utcStamp(first.from)
}
`, `
DTEND: $ {
  utcStamp(first.to)
}
`,
        'SUMMARY:' + calendarText(`
$ {
  course.name
}·
$ {
  sectionName(section.label)
}
`),
        'DESCRIPTION:' + calendarText(`
Professor: $ {
  section.professor || 'Not specified'
}\
nLecture time zone: $ {
  zone
}\
nExported from ADU Tour Guide.
`));
      if (dates.length > 1) lines.push('RDATE;VALUE=PERIOD:' + dates.slice(1).map(d => `
$ {
  utcStamp(d.from)
}
/${utcStamp(d.to)}`).join(','));
lines.push('END:VEVENT');
}));
});
if (!count) throw Error('No lectures fall within these dates. Choose a longer date range.');
lines.push('END:VCALENDAR');
const text = lines.map(foldCalendarLine).join('\r\n') + '\r\n';
if (new TextEncoder().encode(text).length > 1000000) throw Error('This calendar is too large. Choose a shorter date range.');
return {
  text,
  count
};
}
find('#calendar-options').onsubmit = event => {
  event.preventDefault();
  try {
    if (shown === null || !combinations[shown]) throw Error('Open a schedule first.');
    const {
      text,
      count
    } = buildCalendar(combinations[shown], find('#calendar-start').value, find('#calendar-end').value, find('#calendar-zone').value.trim());
    const url = URL.createObjectURL(new Blob([text], {
      type: 'text/calendar;charset=utf-8'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-combination-${shown + 1}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    find('#calendar-status').classList.remove('warning');
    find('#calendar-status').textContent = `Calendar downloaded with ${count} lectures. Import the .ics file into Google Calendar.`;
  } catch (error) {
    find('#calendar-status').classList.add('warning');
    find('#calendar-status').textContent = error.message;
  }
};
