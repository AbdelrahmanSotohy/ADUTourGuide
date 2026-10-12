'use strict';
// No academic rules are checked: this tool stores text and adds credits.
const TERMS = ['Fall', 'Winter', 'Spring', 'Summer'];
const HEADERS = ['Year', 'Semester', 'No', 'Course Code', 'Notes', 'Credits'];
const get = selector => document.querySelector(selector);
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const emptyRow = () => ({
  code: '',
  notes: '',
  credits: ''
});
const emptyYear = () => TERMS.map(term => Array.from({
  length: ['Fall', 'Spring'].includes(term) ? 6 : 2
}, emptyRow));
const initialPlan = () => ({
  required: '140',
  years: Array.from({
    length: 4
  }, emptyYear)
});
let plan = initialPlan(),
  saveTimer, confirmation = null,
  previousFocus, previousOverflow;

// Empty, negative, or invalid values contribute zero. Valid decimals are kept.
function creditNumber(value) {
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function format(n) {
  return String(Number(n.toFixed(6)));
}

function yearName(index) {
  const names = ['First Year (Freshman)', 'Second Year (Sophomore)', 'Third Year (Junior)', 'Fourth Year (Senior)', 'Fifth Year', 'Sixth Year', 'Seventh Year', 'Eighth Year', 'Ninth Year', 'Tenth Year', 'Eleventh Year', 'Twelfth Year', 'Thirteenth Year', 'Fourteenth Year', 'Fifteenth Year', 'Sixteenth Year', 'Seventeenth Year', 'Eighteenth Year', 'Nineteenth Year', 'Twentieth Year'];
  const n = index + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({
    1: 'st',
    2: 'nd',
    3: 'rd'
  } [n % 10] || 'th');
  return names[index] || `${n}${suffix} Year`;
}

function status(text, error = false) {
  get('#status').textContent = text;
  get('#status').classList.toggle('warning', error);
}

function saveNow() {
  try {
    localStorage.setItem('studyPlanner', JSON.stringify(plan));
  } catch {
    status('Auto-save is unavailable. Export CSV to keep your courses.', true);
  }
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}
window.addEventListener('pagehide', saveNow);

// On-page confirmations work when native browser dialogs are blocked.
function ask(text) {
  if (confirmation) return Promise.resolve(false);
  return new Promise(resolve => {
    confirmation = resolve;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    get('#confirmation-text').textContent = text;
    get('#confirmation').hidden = false;
    document.body.style.overflow = 'hidden';
    get('#confirm-cancel').focus();
  });
}

function answer(yes) {
  if (!confirmation) return;
  const resolve = confirmation;
  confirmation = null;
  get('#confirmation').hidden = true;
  document.body.style.overflow = previousOverflow;
  if (previousFocus?.isConnected) previousFocus.focus();
  resolve(yes);
}
get('#confirm-yes').onclick = () => answer(true);
get('#confirm-cancel').onclick = () => answer(false);
get('#confirmation').onclick = e => {
  if (e.target === get('#confirmation')) answer(false);
};
document.addEventListener('keydown', e => {
  if (!confirmation) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    answer(false);
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    (document.activeElement === get('#confirm-cancel') ? get('#confirm-yes') : get('#confirm-cancel')).focus();
  }
});

function rowMarkup(row, y, t, r) {
  return `<tr><td>${r + 1}<button class="delete-row" data-delete="${y},${t},${r}" aria-label="Delete row ${r + 1} from Year ${y + 1} ${TERMS[t]}">×</button></td>${['code', 'notes', 'credits'].map(key => `<td><input data-y="${y}" data-t="${t}" data-r="${r}" data-key="${key}" ${key === 'credits' ? 'inputmode="decimal"' : ''} aria-label="${key} Year ${y + 1} ${TERMS[t]} row ${r + 1}" value="${escapeText(row[key])}"><span class="print-cell">${escapeText(row[key])}</span></td>`).join('')}</tr>`;
}
// Keep optional terms in the data; show saved entries even in older plans.
function termVisible(y, t) {
  return t === 0 || t === 2 || plan.visibleTerms?.[y]?.[t] === true ||
    plan.years[y][t].some(row => ['code', 'notes', 'credits'].some(key => String(row[key] ?? '').trim() !== ''));
}

function semesterMarkup(rows, y, t) {
  return `<section class="semester" ${termVisible(y, t) ? '' : 'hidden'}><h3>${TERMS[t]}</h3><div class="table-wrap"><table>
    <thead><tr><th scope="col">No.</th><th scope="col">Course Code</th><th scope="col">Notes</th><th scope="col">Credits</th></tr></thead>
    <tbody>${rows.map((row, r) => rowMarkup(row, y, t, r)).join('')}</tbody>
    <tfoot><tr><td colspan="3">Total Credits for ${TERMS[t]}</td><td id="total-${y}-${t}">0</td></tr><tr class="cumulative"><td colspan="3">Cumulative Credits</td><td id="cumulative-${y}-${t}">0</td></tr></tfoot>
  </table></div><button class="secondary" data-add="${y},${t}">+ Add row</button></section>`;
}

function render() {
  get('#required').value = plan.required;
  get('#years').innerHTML = plan.years.map((year, y) => `<section class="year-block">
    <header class="year-banner"><h2>${yearName(y)}</h2><div class="year-actions">${[1, 3].filter(t => !termVisible(y, t)).map(t => `<button class="secondary" data-show-term="${y},${t}">+ Add ${TERMS[t]}</button>`).join('')}</div><span id="year-total-${y}"></span>${y === plan.years.length - 1 ? `<button class="secondary" data-remove-year="${y}" ${plan.years.length === 1 ? 'disabled title="Keep at least one year"' : ''}>Remove year</button>` : ''}</header>
    <div class="semesters">${year.map((rows, t) => semesterMarkup(rows, y, t)).join('')}</div>
  </section>`).join('');
  totals();
}

function totals() {
  // The loops follow year order, then Fall → Winter → Spring → Summer.
  let running = 0;
  plan.years.forEach((year, y) => {
    let yearTotal = 0;
    year.forEach((rows, t) => {
      const total = rows.reduce((sum, row) => sum + creditNumber(row.credits), 0);
      running += total;
      yearTotal += total;
      get(`#total-${y}-${t}`).textContent = format(total);
      get(`#cumulative-${y}-${t}`).textContent = format(running);
    });
    get(`#year-total-${y}`).textContent = `${format(yearTotal)} credits`;
  });
  const required = creditNumber(plan.required),
    difference = Number((required - running).toFixed(6));
  get('#planned').textContent = format(running);
  get('#balance-label').textContent = difference < 0 ? 'Plan exceeds requirement by' : 'Credits remaining';
  get('#balance').textContent = format(Math.abs(difference));
  get('#balance').classList.toggle('under', difference > 0);
  get('#degree-progress').value = required > 0 ? Math.min(100, running / required * 100) : 100;
  get('#progress-text').textContent = `${format(running)} / ${format(required)} credits`;
  get('#required-print').textContent = plan.required;
}
get('#required').oninput = e => {
  plan.required = e.target.value;
  totals();
  saveSoon();
};
get('#years').oninput = e => {
  const input = e.target;
  if (!input.dataset.key) return;
  plan.years[input.dataset.y][input.dataset.t][input.dataset.r][input.dataset.key] = input.value;
  input.nextElementSibling.textContent = input.value; // Wrapping text for printing.
  totals();
  saveSoon();
};
get('#years').onclick = async e => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.dataset.showTerm !== undefined) {
    const [y, t] = button.dataset.showTerm.split(',').map(Number);
    plan.visibleTerms ??= [];
    plan.visibleTerms[y] ??= [];
    plan.visibleTerms[y][t] = true;
    if (!plan.years[y][t].length) plan.years[y][t] = Array.from({
      length: 2
    }, emptyRow);
  } else if (button.dataset.add !== undefined) {
    const [y, t] = button.dataset.add.split(',').map(Number);
    plan.years[y][t].push(emptyRow());
  } else if (button.dataset.delete !== undefined) {
    const [y, t, r] = button.dataset.delete.split(',').map(Number);
    plan.years[y][t].splice(r, 1);
  } else if (button.dataset.removeYear !== undefined) {
    const y = Number(button.dataset.removeYear);
    if (y !== plan.years.length - 1 || plan.years.length === 1) return;
    if (!await ask(`Remove ${yearName(y)} and all its entries?`)) return;
    plan.years.pop();
    if (plan.visibleTerms) plan.visibleTerms.length = Math.min(plan.visibleTerms.length, plan.years.length);
  } else return;
  render();
  saveSoon();
};
get('#add-year').onclick = () => {
  if (plan.years.length >= 100) return status('This planner supports up to 100 years.', true);
  plan.years.push(emptyYear());
  render();
  saveSoon();
};
get('#clear').onclick = async () => {
  if (!await ask('Clear all courses and reset to four empty years?')) return;
  plan.years = initialPlan().years;
  plan.visibleTerms = [];
  render();
  saveNow();
  status('Planner cleared.');
};
get('#print').onclick = () => window.print();

// CSV includes blank rows so the semester row counts survive a round trip.
// No=0 is a marker for a table whose rows have all been deleted.
function csvRows() {
  return plan.years.flatMap((year, y) => year.flatMap((rows, t) => rows.length ? rows.map((row, r) => [y + 1, TERMS[t], r + 1, row.code, row.notes, row.credits]) : [
    [y + 1, TERMS[t], 0, '', '', '']
  ]));
}
get('#export').onclick = () => {
  const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
  const text = '\uFEFF' + [HEADERS, ...csvRows()].map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'study-planner.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell !== '') throw Error('Malformed CSV quoting.');
      else quoted = !quoted;
    } else if (!quoted && [',', '\n', '\r'].includes(c)) {
      row.push(cell);
      cell = '';
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed quote in CSV.');
  row.push(cell);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

function yearsFromCSV(rows) {
  if (!rows.length) return initialPlan().years;
  if (rows.length > 5000) throw Error('Use a CSV with at most 5,000 rows.');
  const years = [],
    seen = new Set(),
    emptyTables = new Set();
  let allocated = 0;
  rows.forEach((row, i) => {
    if (row.length !== 6) throw Error(`CSV row ${i + 2} must have six columns.`);
    const [year, term, number, code, notes, credits] = row;
    const y = Number(year),
      t = TERMS.indexOf(term),
      n = Number(number);
    if (!String(year).trim() || !String(number).trim() || !Number.isInteger(y) || y < 1 || y > 100 || t < 0 || !Number.isInteger(n) || n < 0 || n > 5000) throw Error(`Invalid year, semester, or row number on CSV row ${i + 2}.`);
    while (years.length < y) years.push(TERMS.map(() => []));
    const tableKey = `${y},${t}`,
      key = `${tableKey},${n}`;
    if (seen.has(key)) throw Error(`Duplicate row number on CSV row ${i + 2}.`);
    seen.add(key);
    if (n === 0) {
      if (code || notes || credits || years[y - 1][t].length) throw Error('An empty-table marker cannot contain courses.');
      emptyTables.add(tableKey);
      return;
    }
    if (emptyTables.has(tableKey)) throw Error('An empty-table marker cannot be mixed with course rows.');
    allocated += Math.max(0, n - years[y - 1][t].length);
    if (allocated > 5000) throw Error('The imported grid is too large; use at most 5,000 rows.');
    while (years[y - 1][t].length < n) years[y - 1][t].push(emptyRow());
    years[y - 1][t][n - 1] = {
      code,
      notes,
      credits
    };
  });
  if (years.reduce((sum, year) => sum + year.reduce((n, rows) => n + rows.length, 0), 0) > 5000) throw Error('The imported grid is too large; use at most 5,000 rows.');
  return years;
}
get('#import').onclick = () => get('#csv-file').click();
get('#csv-file').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  if (file.size > 2000000) return status('Use a CSV smaller than 2 MB.', true);
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rows = parseCSV(reader.result);
      if (!rows.length || rows[0].length !== 6 || HEADERS.some((h, i) => rows[0][i] !== h)) throw Error('CSV headers must be: ' + HEADERS.join(', '));
      const years = yearsFromCSV(rows.slice(1));
      if (!await ask('Replace your current grid with this CSV?')) return;
      plan.years = years;
      plan.visibleTerms = [];
      render();
      saveNow();
      status('CSV imported. Your required-credits setting was kept.');
    } catch (error) {
      status(error.message, true);
    }
  };
  reader.onerror = () => status('The CSV could not be read.', true);
  reader.readAsText(file);
};

// Restore this planner, or migrate courses from the earlier visual tool.
try {
  const stored = localStorage.getItem('studyPlanner');
  if (stored !== null) {
    const data = JSON.parse(stored);
    if (!Array.isArray(data.years) || !data.years.length || data.years.length > 100) throw Error('Saved years could not be loaded.');
    data.years.forEach(year => {
      if (!Array.isArray(year) || year.length !== 4) throw Error('Saved semesters could not be loaded.');
      year.forEach(rows => {
        if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object')) throw Error('Saved rows could not be loaded.');
      });
    });
    plan = {
      required: String(data.required ?? '140'),
      years: data.years,
      visibleTerms: Array.isArray(data.visibleTerms) ? data.visibleTerms.map(terms => Array.isArray(terms) ? terms.map(value => value === true) : []) : []
    };
  } else {
    const old = JSON.parse(localStorage.getItem('adu-tour-guide:study-planner') || '[]');
    old.forEach(row => {
      const y = Number(row.year) - 1,
        t = TERMS.indexOf(row.semester);
      if (y < 0 || y > 99 || !Number.isInteger(y) || t < 0) return;
      while (plan.years.length <= y) plan.years.push(emptyYear());
      const rows = plan.years[y][t];
      const next = {
        code: row.course ?? '',
        notes: row.status ?? '',
        credits: String(row.credits ?? '')
      };
      const blank = rows.findIndex(r => !r.code && !r.notes && !r.credits);
      if (blank < 0) rows.push(next);
      else rows[blank] = next;
    });
  }
} catch (error) {
  status('Saved data could not be loaded: ' + error.message, true);
}
render();
