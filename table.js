'use strict';

function tableTool(config) {
  let data = Storage.load(config.key, config.initial || []);
  const save = Storage.debounce(config.key, () => data);

  function options(field, r) {
    return field.options.map(o => `<option value="${ADU.escape(o)}" ${String(r[field.key])===String(o)?'selected':''}>${ADU.escape(o)}</option>`).join('')
  }

  function render() {
    $('#rows').innerHTML = data.map((r, i) => `<tr>${config.fields.map(f=>`<td>${f.options?`<select aria-label="${f.label} ${i+1}" data-i="${i}" data-field="${f.key}">${options(f,r)}</select>`:`<input aria-label="${f.label} ${i+1}" data-i="${i}" data-field="${f.key}" type="${f.type||'text'}" ${f.type==='number'?'min="0" step="any"':''} value="${ADU.escape(r[f.key])}">`}</td>`).join('')}<td><button class="danger" data-remove="${i}">Remove</button></td></tr>`).join('');
    config.changed(data)
  }
  $('#rows').oninput = e => {
    const t = e.target;
    if (t.dataset.field) {
      data[t.dataset.i][t.dataset.field] = t.value;
      config.changed(data);
      save()
    }
  };
  $('#rows').onclick = e => {
    if (e.target.dataset.remove !== undefined) {
      data.splice(+e.target.dataset.remove, 1);
      render();
      save()
    }
  };
  $('#add').onclick = () => {
    data.push({
      ...config.blank
    });
    render();
    save()
  };
  $('#export').onclick = () => CSV.export(config.key, config.fields.map(f => f.label), data.map(r => config.fields.map(f => r[f.key])));
  $('#import').onclick = () => CSV.import(config.fields.map(f => f.label), rows => {
    const next = rows.map(row => Object.fromEntries(config.fields.map((f, i) => [f.key, row[i]])));
    next.forEach(config.validate);
    data = next;
    render();
    save()
  });
  render();
  return {
    get: () => data
  }
}
