'use strict';
// Migrate the original course-only save without discarding existing rows.
const saved = Storage.load('gpa-calculator', null);
let data = Array.isArray(saved) ? saved : saved?.courses ?? [{ name: '', grade: 'A', credits: 3 }];
let priorSettings = !Array.isArray(saved) && saved ? {
  currentGpa: saved.currentGpa ?? '',
  completedCredits: saved.completedCredits ?? ''
} : { currentGpa: '', completedCredits: '' };
const headers = ['Current GPA', 'Completed Credits', 'Course', 'Grade', 'Credits'];
const legacyHeaders = ['Course', 'Grade', 'Credits'];
const creditOptions = Array.from({ length: 17 }, (_, i) => i / 2);
const save = Storage.debounce('gpa-calculator', () => ({ ...priorSettings, courses: data }));

function courseCredits(value) {
  const credits = ADU.number(value, 0, 8);
  if (!creditOptions.includes(credits)) throw Error('Choose course credit hours from 0 to 8 in steps of 0.5.');
  return credits;
}
function priorGpa(value) {
  if (String(value.currentGpa).trim() === '' || String(value.completedCredits).trim() === '') {
    throw Error('Enter your current GPA and completed credit hours for Cumulative GPA. Enter 0 for both if you have no completed credits.');
  }
  return { credits: ADU.number(value.completedCredits, 0), gpa: ADU.number(value.currentGpa, 0, 4) };
}
function calc() {
  let credits = 0, points = 0;
  try {
    data.forEach(row => {
      const c = courseCredits(row.credits);
      if (!Object.hasOwn(ADU.grades, row.grade)) throw Error('Choose a valid ADU letter grade.');
      credits += c;
      points += ADU.grades[row.grade] * c;
    });
    $('#semester-gpa').textContent = credits > 0 ? (points / credits).toFixed(3) : '—';
    $('#semester-credits').textContent = `${credits} semester credit hours`;
  } catch (error) {
    $('#result').textContent = '—';
    $('#credits').textContent = 'Check your course inputs';
    $('#semester-gpa').textContent = '—';
    $('#semester-credits').textContent = 'Check your course inputs';
    notice(error.message, true);
    return;
  }
  try {
    const prior = priorGpa(priorSettings);
    const total = prior.credits + credits;
    $('#result').textContent = total ? ((prior.gpa * prior.credits + points) / total).toFixed(3) : '—';
    $('#credits').textContent = `${total} total credit hours`;
    notice('');
  } catch (error) {
    $('#result').textContent = '—';
    $('#credits').textContent = 'Enter current GPA and completed credits';
    notice(error.message, true);
  }
}
function render() {
  $('#current-gpa').value = priorSettings.currentGpa;
  $('#completed-credits').value = priorSettings.completedCredits;
  $('#rows').innerHTML = data.map((r, i) => `<tr>
    <td><input aria-label="Course ${i + 1}" data-i="${i}" data-field="name" value="${ADU.escape(r.name)}"></td>
    <td><select aria-label="Grade ${i + 1}" data-i="${i}" data-field="grade">${!Object.hasOwn(ADU.grades, r.grade) ? '<option value="" selected disabled>Choose grade</option>' : ''}${Object.keys(ADU.grades).map(g => `<option ${g === r.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></td>
    <td><select aria-label="Credits ${i + 1}" data-i="${i}" data-field="credits">${r.credits === '' || !creditOptions.includes(Number(r.credits)) ? '<option value="" selected disabled>Choose credits</option>' : ''}${creditOptions.map(c => `<option value="${c}" ${r.credits !== '' && c === Number(r.credits) ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    <td><button class="danger" data-remove="${i}">Remove</button></td>
  </tr>`).join('');
  calc();
}
$('#rows').oninput = e => {
  const t = e.target;
  if (t.dataset.field) {
    data[t.dataset.i][t.dataset.field] = t.value;
    calc(); save();
  }
};
$('#rows').onclick = e => {
  if (e.target.dataset.remove !== undefined) {
    data.splice(Number(e.target.dataset.remove), 1);
    render(); save();
  }
};
$('#current-gpa').oninput = e => { priorSettings.currentGpa = e.target.value; calc(); save(); };
$('#completed-credits').oninput = e => { priorSettings.completedCredits = e.target.value; calc(); save(); };
$('#add').onclick = () => { data.push({ name: '', grade: 'A', credits: 3 }); render(); save(); };
$('#export').onclick = () => {
  const rows = data.length ? data.map(r => [priorSettings.currentGpa, priorSettings.completedCredits, r.name, r.grade, r.credits]) : [[priorSettings.currentGpa, priorSettings.completedCredits, '', '', '']];
  CSV.export('adu-gpa-courses', headers, rows);
};
$('#import').onclick = () => CSV.import(headers, (rows, actualHeaders = headers) => {
  const legacy = actualHeaders.length === legacyHeaders.length;
  let nextHistory = { ...priorSettings };
  if (!legacy) {
    if (!rows.length) throw Error('CSV must contain GPA settings.');
    nextHistory = { currentGpa: rows[0][0], completedCredits: rows[0][1] };
    priorGpa(nextHistory);
    if (rows.some(r => r[0] !== rows[0][0] || r[1] !== rows[0][1])) throw Error('Current GPA and completed credits must be consistent across CSV rows.');
  }
  const courseRows = legacy ? rows : rows.filter(r => r.slice(2).some(v => v !== '')).map(r => r.slice(2));
  const next = courseRows.map(([name, grade, credits]) => {
    if (!Object.hasOwn(ADU.grades, grade)) throw Error('Unknown ADU grade: ' + grade);
    return { name, grade, credits: courseCredits(credits) };
  });
  // Assign only after every setting and row passes validation.
  data = next; priorSettings = nextHistory;
  render(); save();
}, legacyHeaders);
render();
