let data = Storage.load('project-split', {
  members: ['Member 1', 'Member 2'],
  phases: ['Research', 'Draft', 'Review', 'Final'],
  tasks: {}
});
const save = Storage.debounce('project-split', () => data);

function task(m, p) {
  const key = m + ':' + p;
  return data.tasks[key] || (data.tasks[key] = {
    task: '',
    done: false,
    due: '',
    notes: ''
  })
}

function stats() {
  const total = data.members.length * data.phases.length;
  let done = 0;
  const rates = data.phases.map((p, j) => {
    let n = data.members.reduce((n, m, i) => n + Number(task(i, j).done), 0);
    done += n;
    return n
  });
  const lowest = rates.length ? Math.min(...rates) : 0;
  $('#stats').innerHTML = `<div class="metric"><div class="result">${total?Math.round(done/total*100):0}% complete</div>${done}/${total} tasks done<progress value="${done}" max="${total||1}"></progress></div><div class="grid">${data.phases.map((p,j)=>`<div>${ADU.escape(p)}: <strong>${rates[j]}/${data.members.length} done</strong>${rates[j]===lowest&&data.members.length?'<br><span class="warning">Lowest completion</span>':''}</div>`).join('')}</div>`;
  $$('[data-progress]').forEach(el => {
    const i = Number(el.dataset.progress),
      n = data.phases.reduce((n, p, j) => n + Number(task(i, j).done), 0);
    el.textContent = `${data.phases.length?Math.round(n/data.phases.length*100):0}% · ${n}/${data.phases.length} phases`
  })
}

function render() {
  $('#setup').innerHTML = `<h2>Members</h2>${data.members.map((m,i)=>`<div class="fields"><label>Member ${i+1}<input data-name="member" data-i="${i}" value="${ADU.escape(m)}"></label><button class="danger" data-remove="member" data-i="${i}">Remove member</button></div>`).join('')}<h2>Shared phases</h2>${data.phases.map((p,i)=>`<div class="fields"><label>Phase ${i+1}<input data-name="phase" data-i="${i}" value="${ADU.escape(p)}"></label><button class="danger" data-remove="phase" data-i="${i}">Remove phase</button></div>`).join('')}`;
  $('#member').disabled = data.members.length >= 8;
  $('#members').innerHTML = data.members.map((m, i) => `<article class="card"><h2 data-member-title="${i}">${ADU.escape(m)}</h2><div class="pill" data-progress="${i}"></div>${data.phases.map((p,j)=>{let t=task(i,j);return `<section class="task"><h3 data-phase-title="${j}">${ADU.escape(p)}</h3><label>Task<textarea data-m="${i}" data-p="${j}" data-field="task">${ADU.escape(t.task)}</textarea></label><label><input type="checkbox" data-m="${i}" data-p="${j}" data-field="done" ${t.done?'checked':''}> Completed</label><label>Due date<input type="date" data-m="${i}" data-p="${j}" data-field="due" value="${ADU.escape(t.due)}"></label><label>Notes<textarea data-m="${i}" data-p="${j}" data-field="notes">${ADU.escape(t.notes)}</textarea></label></section>`}).join('')}</article>`).join('');
  stats()
}
$('#setup').oninput = e => {
  const t = e.target;
  if (t.dataset.name) {
    const member = t.dataset.name === 'member';
    data[member ? 'members' : 'phases'][t.dataset.i] = t.value;
    $$(member ? '[data-member-title="' + t.dataset.i + '"]' : '[data-phase-title="' + t.dataset.i + '"]').forEach(el => el.textContent = t.value);
    stats();
    save()
  }
};
$('#setup').onclick = e => {
  const t = e.target;
  if (!t.dataset.remove) return;
  const member = t.dataset.remove === 'member',
    index = Number(t.dataset.i);
  if (data[member ? 'members' : 'phases'].length <= 1) {
    notice('Keep at least one member and one phase.', true);
    return
  }
  if (!confirm('Remove this ' + t.dataset.remove + ' and its tasks?')) return;
  const next = {};
  for (let i = 0; i < data.members.length; i++)
    for (let j = 0; j < data.phases.length; j++) {
      if ((member ? i : j) === index) continue;
      next[(member && i > index ? i - 1 : i) + ':' + (!member && j > index ? j - 1 : j)] = task(i, j)
    }
  data[member ? 'members' : 'phases'].splice(index, 1);
  data.tasks = next;
  render();
  save()
};
$('#members').oninput = e => {
  const t = e.target;
  if (t.dataset.field) {
    task(t.dataset.m, t.dataset.p)[t.dataset.field] = t.type === 'checkbox' ? t.checked : t.value;
    stats();
    save()
  }
};
$('#member').onclick = () => {
  if (data.members.length < 8) {
    let name = 'Member ' + (data.members.length + 1);
    while (data.members.includes(name)) name += ' new';
    data.members.push(name);
    render();
    save()
  }
};
$('#phase').onclick = () => {
  let name = 'Phase ' + (data.phases.length + 1);
  while (data.phases.includes(name)) name += ' new';
  data.phases.push(name);
  render();
  save()
};
const headers = ['Phase', 'Task', 'Assigned To', 'Status', 'Due Date', 'Notes'];

function uniqueNames() {
  if ([...data.members, ...data.phases].some(n => !n.trim()) || new Set(data.members).size !== data.members.length || new Set(data.phases).size !== data.phases.length) throw Error('Use nonempty, unique member names and phase names before exporting.')
}
$('#export').onclick = () => {
  try {
    uniqueNames();
    const rows = [];
    data.phases.forEach((p, j) => data.members.forEach((m, i) => {
      let t = task(i, j);
      rows.push([p, t.task, m, t.done ? 'Done' : 'Pending', t.due, t.notes])
    }));
    CSV.export('project-split', headers, rows)
  } catch (e) {
    notice(e.message, true)
  }
};
$('#import').onclick = () => CSV.import(headers, rows => {
  const next = {
    members: [],
    phases: [],
    tasks: {}
  };
  rows.forEach(([p, description, m, status, due, notes]) => {
    if (!p.trim() || !m.trim() || !['Done', 'Pending'].includes(status) || due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw Error('Invalid phase, member, status, or date.');
    if (!next.members.includes(m)) next.members.push(m);
    if (!next.phases.includes(p)) next.phases.push(p);
    let key = next.members.indexOf(m) + ':' + next.phases.indexOf(p);
    if (next.tasks[key]) throw Error('Duplicate member/phase task.');
    next.tasks[key] = {
      task: description,
      done: status === 'Done',
      due,
      notes
    }
  });
  if (!next.members.length || !next.phases.length) throw Error('CSV needs at least one member and phase.');
  if (next.members.length > 8) throw Error('At most eight members are supported.');
  data = next;
  render();
  save()
});
render();
