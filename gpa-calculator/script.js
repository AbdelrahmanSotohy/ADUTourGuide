'use strict';
// Migrate the original course-only save without discarding existing rows.
const saved = Storage.load('gpa-calculator', null);
let data = Array.isArray(saved) ? saved : saved?.courses ?? [{
  name: '',
  grade: 'A',
  credits: 3
}];
let priorSettings = !Array.isArray(saved) && saved ? {
  currentGpa: saved.currentGpa ?? '',
  completedCredits: saved.completedCredits ?? ''
} : {
  currentGpa: '',
  completedCredits: ''
};
const creditOptions = Array.from({
  length: 17
}, (_, i) => i / 2);
const save = Storage.debounce('gpa-calculator', () => ({
  ...priorSettings,
  courses: data
}));

function courseCredits(value) {
  const credits = ADU.number(value, 0, 8);
  if (!creditOptions.includes(credits)) throw Error('Choose course credit hours from 0 to 8 in steps of 0.5.');
  return credits;
}

function priorGpa(value) {
  if (String(value.currentGpa).trim() === '') Fields.fail('#current-gpa', 'Enter your current GPA, or 0 if you have no completed credits.');
  if (String(value.completedCredits).trim() === '') Fields.fail('#completed-credits', 'Enter completed credit hours, or 0 if you have none.');
  return {
    credits: Fields.number(value.completedCredits, 0, Infinity, '#completed-credits'),
    gpa: Fields.number(value.currentGpa, 0, 4, '#current-gpa')
  };
}

function calc() {
  Fields.clearAll();
  let credits = 0,
    points = 0;
  try {
    data.forEach((row, i) => {
      let c;
      try {
        c = courseCredits(row.credits);
      } catch (error) {
        error.field = `[data-i="${i}"][data-field="credits"]`;
        throw error;
      }
      if (!Object.hasOwn(ADU.grades, row.grade)) Fields.fail(`[data-i="${i}"][data-field="grade"]`, 'Choose a valid ADU letter grade.');
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
    notice(error, true);
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
    notice(error, true);
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
    calc();
    save();
  }
};
$('#rows').onclick = e => {
  if (e.target.dataset.remove !== undefined) {
    data.splice(Number(e.target.dataset.remove), 1);
    render();
    save();
  }
};
$('#current-gpa').oninput = e => {
  priorSettings.currentGpa = e.target.value;
  calc();
  save();
};
$('#completed-credits').oninput = e => {
  priorSettings.completedCredits = e.target.value;
  calc();
  save();
};
$('#add').onclick = () => {
  data.push({
    name: '',
    grade: 'A',
    credits: 3
  });
  render();
  save();
};
render();
