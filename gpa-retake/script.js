'use strict';
// Separate storage keeps retake inputs independent of every other tool.
let data = Storage.load('gpa-retake', {
  current: '',
  completed: '',
  count: '',
  courses: []
});
const save = Storage.debounce('gpa-retake', () => data);
const grades = Object.entries(ADU.grades);
let outcomes = [],
  page = 0,
  descending = true;
const PAGE_SIZE = 25;
const blankCourse = () => ({
  name: '',
  credits: '',
  grade: ''
});

function courseInputs() {
  $('#courses').innerHTML = data.courses.map((course, i) => `
    <section class="retake-course">
      <h2>Course ${i + 1}</h2>
      <div class="fields">
        <label>Course name (optional)<input data-i="${i}" data-field="name" maxlength="100" placeholder="e.g. CEN325" value="${ADU.escape(course.name)}"></label>
        <label>Credit hours<input data-i="${i}" data-field="credits" type="number" min="0.5" max="8" step="0.5" placeholder="e.g. 3" value="${ADU.escape(course.credits)}"></label>
        <label>Original grade<select data-i="${i}" data-field="grade"><option value="">Choose grade</option>${grades.map(([grade]) => `<option value="${grade}" ${course.grade === grade ? 'selected' : ''}>${grade}</option>`).join('')}</select></label>
      </div>
    </section>`).join('');
}

function invalidate() {
  outcomes = [];
  page = 0;
  $('#results').replaceChildren();
}
['current', 'completed', 'count'].forEach(key => {
  $('#' + key).value = data[key];
  $('#' + key).oninput = event => {
    data[key] = event.target.value;
    invalidate();
    notice('');
    if (key === 'count') {
      const count = Number(data.count);
      if (count > 5) Fields.show('#count', 'You can calculate up to 5 retake courses at a time.');
      if (Number.isInteger(count) && count >= 1 && count <= 5) {
        data.courses = Array.from({
          length: count
        }, (_, i) => data.courses[i] || blankCourse());
        courseInputs();
      }
    }
    save();
  };
});
$('#courses').oninput = event => {
  const {
    i,
    field
  } = event.target.dataset;
  if (!field) return;
  data.courses[i][field] = event.target.value;
  invalidate();
  notice('');
  save();
};

function validateRetakes(input) {
  const current = Fields.number(input.current, 0, 4, '#current');
  const completed = Fields.number(input.completed, 0.5, Infinity, '#completed');
  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 5 || input.courses.length !== count) Fields.fail('#count', 'Enter a whole number from 1 to 5 for the courses to retake.');
  let oldPoints = 0,
    retakeCredits = 0;
  input.courses.forEach((course, i) => {
    const credits = Fields.number(course.credits, 0.5, 8, `[data-i="${i}"][data-field="credits"]`);
    if (credits * 2 % 1 !== 0) Fields.fail(`[data-i="${i}"][data-field="credits"]`, 'Use credit hours in steps of 0.5.');
    if (!Object.hasOwn(ADU.grades, course.grade)) Fields.fail(`[data-i="${i}"][data-field="grade"]`, 'Choose the original grade.');
    retakeCredits += credits;
    oldPoints += credits * ADU.grades[course.grade];
  });
  if (retakeCredits > completed) Fields.fail('#completed', 'Retake credit hours cannot exceed your completed GPA credits.');
  // Allow a small tolerance because students often enter a GPA rounded to 3 decimals.
  const remainingPoints = current * completed - oldPoints;
  const tolerance = completed * 0.0005 + 1e-9;
  if (remainingPoints < -tolerance || remainingPoints > (completed - retakeCredits) * 4 + tolerance) Fields.fail('#current', 'These original grades and credits do not match your current GPA. Check that all retake courses are already included in it.');
  return {
    current,
    completed,
    oldPoints
  };
}

function replacementGpa(current, completed, oldPoints, newPoints) {
  return Math.max(0, Math.min(4, (current * completed - oldPoints + newPoints) / completed));
}

function calculateOutcomes(input) {
  const {
    current,
    completed,
    oldPoints
  } = validateRetakes(input);
  const list = [];

  function choose(index, selected, points) {
    if (index === input.courses.length) {
      list.push({
        grades: selected,
        gpa: replacementGpa(current, completed, oldPoints, points)
      });
      return;
    }
    grades.forEach(([grade, value]) => choose(index + 1, [...selected, grade], points + value * Number(input.courses[index].credits)));
  }
  // At most 8^5 = 32,768 possibilities; only one page is rendered at a time.
  choose(0, [], 0);
  return list.sort((a, b) => b.gpa - a.gpa);
}

function courseTitle(course, i) {
  return course.name.trim() || `Course ${i + 1}`;
}

function renderPage() {
  const pages = Math.ceil(outcomes.length / PAGE_SIZE);
  $('#combination-rows').innerHTML = outcomes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(outcome => `<tr>${outcome.grades.map(grade => `<td>${grade}</td>`).join('')}<td class="${outcome.gpa > Number(data.current) + 1e-9 ? 'retake-improved' : ''}">${outcome.gpa.toFixed(3)}</td></tr>`).join('');
  $('#retake-page').textContent = `Page ${page + 1} of ${pages}`;
  $('#retake-previous').disabled = page === 0;
  $('#retake-next').disabled = page === pages - 1;
}
$('#calculate').onclick = () => {
  try {
    Fields.clearAll();
    outcomes = calculateOutcomes(data);
    page = 0;
    descending = true;
    const {
      current,
      completed
    } = validateRetakes(data);
    $('#results').innerHTML = `
      <section class="panel"><h2>Retake summary</h2><div class="retake-summary">
        <div class="metric">Current GPA<div class="result">${current.toFixed(3)}</div></div>
        <div class="metric">Highest possible GPA<div class="result">${outcomes[0].gpa.toFixed(3)}</div></div>
        <div class="metric">Completed credits<div class="result">${completed}</div></div>
      </div></section>
      ${data.courses.map((course, i) => {
        const credits = Number(course.credits), oldPoints = ADU.grades[course.grade] * credits;
        return `<section class="panel"><h2>${ADU.escape(courseTitle(course, i))}: possible new grades</h2><p class="muted">Only this course is replaced in this table; all other grades stay unchanged.</p><div class="table-wrap"><table><thead><tr><th>New grade</th><th>New cumulative GPA</th></tr></thead><tbody>${grades.map(([grade, points]) => `<tr><td>${grade}</td><td>${replacementGpa(current, completed, oldPoints, points * credits).toFixed(3)}</td></tr>`).join('')}</tbody></table></div></section>`;
      }).join('')}
      <section class="panel"><h2>All retake combinations</h2><p class="muted">${outcomes.length.toLocaleString()} possibilities. Click the GPA heading to sort highest or lowest first. Each row replaces all selected courses together.</p><div class="table-wrap"><table><thead><tr>${data.courses.map((course, i) => `<th>${ADU.escape(courseTitle(course, i))}</th>`).join('')}<th id="retake-sort-heading" aria-sort="descending"><button id="retake-sort" class="secondary" type="button">New cumulative GPA ↓</button></th></tr></thead><tbody id="combination-rows"></tbody></table></div><div class="retake-pagination"><button id="retake-previous" class="secondary">Previous</button><span id="retake-page"></span><button id="retake-next" class="secondary">Next</button></div></section>`;
    $('#retake-sort').onclick = () => {
      descending = !descending;
      outcomes.sort((a, b) => descending ? b.gpa - a.gpa : a.gpa - b.gpa);
      page = 0;
      $('#retake-sort-heading').setAttribute('aria-sort', descending ? 'descending' : 'ascending');
      $('#retake-sort').textContent = 'New cumulative GPA ' + (descending ? '↓' : '↑');
      renderPage();
    };
    $('#retake-previous').onclick = () => {
      if (page > 0) {
        page--;
        renderPage();
      }
    };
    $('#retake-next').onclick = () => {
      if ((page + 1) * PAGE_SIZE < outcomes.length) {
        page++;
        renderPage();
      }
    };
    renderPage();
    notice('');
    save();
  } catch (error) {
    invalidate();
    notice(error, true);
  }
};
courseInputs();
