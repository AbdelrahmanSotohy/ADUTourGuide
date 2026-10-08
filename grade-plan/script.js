let data = Storage.load('grade-plan', {
  course: '',
  remaining: 40,
  rows: [{
    name: 'Completed work',
    earned: 45,
    total: 60,
    weight: 60
  }]
});
const save = Storage.debounce('grade-plan', () => data);
$('#course').value = data.course;
$('#remaining').value = data.remaining;
const headers = ['Course', 'Remaining Weight', 'Assessment', 'Earned', 'Possible', 'Weight'];

function validate(r) {
  const total = ADU.number(r.total, 0.000001);
  ADU.number(r.earned, 0, total);
  ADU.number(r.weight, 0, 100)
}

function calc() {
  try {
    data.rows.forEach(validate);
    let remaining = ADU.number(data.remaining, 0, 100),
      weight = data.rows.reduce((s, r) => s + Number(r.weight), 0);
    if (Math.abs(weight + remaining - 100) > 0.000001) throw Error('Completed weights plus remaining weight must equal 100%. Currently ' + (weight + remaining) + '%.');
    const earned = data.rows.reduce((s, r) => s + Number(r.earned) / Number(r.total) * Number(r.weight), 0);
    $('#results').innerHTML = `<div class="metric">Earned toward final grade: <strong>${earned.toFixed(2)} / 100</strong></div><div class="table-wrap"><table><thead><tr><th>Grade</th><th>Threshold</th><th>Needed on remaining work</th><th>Needed out of remaining weight</th><th>Outcome</th></tr></thead><tbody>${Object.entries(ADU.tiers).map(([g,threshold])=>{const need=remaining?(threshold-earned)/remaining*100:Infinity;const achieved=earned>=threshold;
    // Weighted points needed: e.g. 30 out of a remaining 45, or 66.67%.
    const pointsNeeded = Math.max(0, threshold - earned);
    const formatPoints = n => String(Number(n.toFixed(2)));
    return `<tr><td>${g}</td><td>${threshold}%</td><td>${achieved?'0.00%':remaining?Math.max(0,need).toFixed(2)+'%':'—'}</td><td>${formatPoints(pointsNeeded)} / ${formatPoints(remaining)}</td><td class="${!achieved&&need>100?'warning':''}">${achieved?'Already secured':!remaining?'Final grade below this tier':need>100?'Not achievable':'Achievable'}</td></tr>`}).join('')}<tr><td>F</td><td>Below 60%</td><td colspan="3">${earned>=60?'Passing threshold already secured':'A final score below 60% is F.'}</td></tr></tbody></table></div>`;
    notice('')
  } catch (e) {
    $('#results').textContent = 'Complete valid assessment inputs to calculate targets.';
    notice(e.message, true)
  }
}

function render() {
  $('#rows').innerHTML = data.rows.map((r, i) => `<tr>${['name','earned','total','weight'].map(k=>`<td><input aria-label="${k} assessment ${i+1}" data-i="${i}" data-field="${k}" ${k==='name'?'':'type="number" min="0" step="any"'} value="${ADU.escape(r[k])}"></td>`).join('')}<td><button class="danger" data-remove="${i}">Remove</button></td></tr>`).join('');
  calc()
}
$('#rows').oninput = e => {
  const t = e.target;
  if (t.dataset.field) {
    data.rows[t.dataset.i][t.dataset.field] = t.value;
    calc();
    save()
  }
};
$('#rows').onclick = e => {
  if (e.target.dataset.remove !== undefined) {
    data.rows.splice(Number(e.target.dataset.remove), 1);
    render();
    save()
  }
};
$('#course').oninput = e => {
  data.course = e.target.value;
  save()
};
$('#remaining').oninput = e => {
  data.remaining = e.target.value;
  calc();
  save()
};
$('#add').onclick = () => {
  data.rows.push({
    name: '',
    earned: 0,
    total: 100,
    weight: 0
  });
  render();
  save()
};
$('#export').onclick = () => CSV.export('grade-plan', headers, data.rows.length ? data.rows.map(r => [data.course, data.remaining, r.name, r.earned, r.total, r.weight]) : [
  [data.course, data.remaining, '', '', '', '']
]);
$('#import').onclick = () => CSV.import(headers, rows => {
  if (!rows.length) throw Error('CSV must include course settings.');
  if (rows.some(r => r[0] !== rows[0][0] || r[1] !== rows[0][1])) throw Error('Course settings must be consistent.');
  let next = {
    course: rows[0][0],
    remaining: ADU.number(rows[0][1], 0, 100),
    rows: rows.filter(r => r.slice(2).some(v => v !== '')).map(r => ({
      name: r[2],
      earned: r[3],
      total: r[4],
      weight: r[5]
    }))
  };
  next.rows.forEach(validate);
  if (Math.abs(next.rows.reduce((s, r) => s + Number(r.weight), 0) + next.remaining - 100) > 1e-6) throw Error('Weights must total 100%.');
  data = next;
  $('#course').value = data.course;
  $('#remaining').value = data.remaining;
  render();
  save()
});
render();
