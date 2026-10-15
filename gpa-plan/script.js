let data = Storage.load('gpa-plan', {
  current: '',
  completed: '',
  count: '',
  goal: 'target',
  target: '',
  credits: []
});
const save = Storage.debounce('gpa-plan', () => data);
let run = 0;

function render() {
  ['current', 'completed', 'count', 'goal', 'target'].forEach(k => $('#' + k).value = data[k]);
  $('#target-label').hidden = false;
  $('#courses').innerHTML = data.credits.map((c, i) => `<label>Course ${i+1} credits<input type="number" min="0.5" step="0.5" placeholder="e.g. 3" data-credit="${i}" value="${ADU.escape(c)}"></label>`).join('')
}

function invalidate() {
  run++;
  $('#calculate').disabled = false;
  $('#results').replaceChildren()
}
$$('input,select').filter(el => el.id).forEach(el => el.oninput = () => {
  data[el.id] = el.value;
  invalidate();
  if (el.id === 'count') {
    const n = Number(el.value);
    if (n > 8) Fields.show('#count', 'You can plan up to 8 courses at a time.');
    else notice('');
    if (Number.isInteger(n) && n >= 1 && n <= 8) {
      data.credits = Array.from({
        length: n
      }, (_, i) => data.credits[i] ?? '');
      $('#courses').innerHTML = data.credits.map((c, i) => `<label>Course ${i+1} credits<input type="number" min="0.5" step="0.5" placeholder="e.g. 3" data-credit="${i}" value="${ADU.escape(c)}"></label>`).join('')
    }
  }
  $('#target-label').hidden = false;
  save()
});
$('#courses').oninput = e => {
  if (e.target.dataset.credit !== undefined) {
    data.credits[e.target.dataset.credit] = e.target.value;
    invalidate();
    save()
  }
};

function valid(d) {
  Fields.number(d.current, 0, 4, '#current');
  Fields.number(d.completed, 0, Infinity, '#completed');
  if (d.goal === 'target' || String(d.target).trim() !== '') Fields.number(d.target, 0, 4, '#target');
  if (Number(d.count) > 8) Fields.fail('#count', 'You can plan up to 8 courses at a time.');
  const n = Fields.number(d.count, 1, 8, '#count');
  if (!Number.isInteger(n) || d.credits.length !== n || !['target', 'same', 'increase'].includes(d.goal)) Fields.fail('#count', 'Enter a whole number from 1 to 8.');
  d.credits.forEach((c, i) => Fields.number(c, 0.5, Infinity, `[data-credit="${i}"]`))
}
$('#calculate').onclick = () => {
  try {
    Fields.clearAll();
    valid(data);
    const myRun = ++run,
      // Equal-credit courses are adjacent, so only one ordering is explored.
      credits = data.credits.map(Number).sort((a, b) => a - b),
      base = Number(data.current) * Number(data.completed),
      denom = Number(data.completed) + credits.reduce((a, b) => a + b, 0),
      goal = data.goal === 'target' ? Number(data.target) : Number(data.current),
      strict = data.goal === 'increase',
      required = goal * denom - base;
    const targetGpa = String(data.target).trim() === '' ? null : Number(data.target);
    const meetsTarget = gpa => targetGpa !== null && gpa >= targetGpa - 1e-9;
    const grades = Object.entries(ADU.grades);
    const creditGroups = [...new Set(credits)];

    function gradeCounts(combo, credit) {
      return grades.map(([grade]) => {
        const count = combo.filter((g, i) => g === grade && credits[i] === credit).length;
        return count ? `${count} ${grade}` : '';
      }).filter(Boolean).join(' + ');
    }
    const suffix = Array(credits.length + 1).fill(0);
    for (let i = credits.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + 4 * credits[i];
    const qualifies = p => strict ? p > required + 1e-9 : p >= required - 1e-9;
    let stack = [{
        i: 0,
        points: 0,
        combo: [],
        lastGrade: 0
      }],
      found = [],
      visited = 0,
      truncated = false;
    $('#calculate').disabled = true;
    $('#results').textContent = 'Searching grade combinations…';

    function chunk() {
      if (run !== myRun) return;
      let n = 0;
      while (stack.length && n++ < 3000) {
        const s = stack.pop();
        if (++visited > 500000 || found.length >= 200) {
          truncated = true;
          break
        }
        if (!qualifies(s.points + suffix[s.i])) continue;
        if (s.i === credits.length) {
          if (qualifies(s.points)) found.push({
            ...s,
            gpa: (base + s.points) / denom
          });
          continue
        }
        // Nondecreasing grade indices remove permutations within each credit group.
        const firstGrade = s.i > 0 && credits[s.i] === credits[s.i - 1] ? s.lastGrade : 0;
        for (let j = grades.length - 1; j >= firstGrade; j--) {
          const [grade, points] = grades[j];
          stack.push({
            i: s.i + 1,
            points: s.points + points * credits[s.i],
            combo: [...s.combo, grade],
            lastGrade: j
          })
        }
      }
      if (stack.length && !truncated) {
        setTimeout(chunk, 0);
        return
      }
      found.sort((a, b) => b.gpa - a.gpa);
      $('#calculate').disabled = false;
      $('#results').innerHTML = `<section class="panel"><h2>${found.length?'Grade combinations':'No qualifying combinations'}</h2><p>Required semester GPA: ${(required/credits.reduce((a,b)=>a+b,0)).toFixed(3)}${strict?' (must exceed)':' (minimum)'}. Maximum cumulative GPA: ${((base+suffix[0])/denom).toFixed(3)}.</p><p>${truncated?'Showing up to 200 combinations; search is limited to 500,000 states. These are examples, not an exhaustive list.':'All unique qualifying combinations are shown.'}</p>${targetGpa !== null ? `<p class="target-key">Highlighted rows meet or exceed your target GPA of ${targetGpa.toFixed(3)}.</p>` : ''}<div class="table-wrap"><table><thead><tr>${creditGroups.map(c=>`<th>${c}-credit courses</th>`).join('')}<th aria-sort="descending">Cumulative GPA ↓</th></tr></thead><tbody>${found.map(s=>`<tr class="${meetsTarget(s.gpa) ? 'target-met' : ''}">${creditGroups.map(c=>`<td>${gradeCounts(s.combo, c)}</td>`).join('')}<td>${s.gpa.toFixed(3)}${meetsTarget(s.gpa) ? ' <span class="target-badge">Target met</span>' : ''}</td></tr>`).join('')}</tbody></table></div></section>`
    }
    chunk();
    notice('')
  } catch (e) {
    notice(e, true)
  }
};
render();
