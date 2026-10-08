'use strict';
const CSV = {
  parse(text) {
    text = text.replace(/^\uFEFF/, '');
    let rows = [],
      row = [],
      cell = '',
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++
        } else if (!quoted && cell !== '') throw Error('Malformed CSV quoting.');
        else quoted = !quoted
      } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
        row.push(cell);
        cell = '';
        if (c !== ',') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          if (row.some(v => v !== '')) rows.push(row);
          row = []
        }
      } else cell += c
    }
    if (quoted) throw Error('Unclosed CSV quote.');
    row.push(cell);
    if (row.some(v => v !== '')) rows.push(row);
    return rows
  },
  export (name, headers, rows) {
    const quote = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const blob = new Blob(['\uFEFF' + [headers, ...rows].map(r => r.map(quote).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  },
  import(headers, apply, legacyHeaders = null) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 2000000) {
        notice('CSV must be under 2 MB.', true);
        return
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = CSV.parse(String(reader.result));
          const matches = candidate => rows.length && rows[0].length === candidate.length && candidate.every((h, i) => rows[0][i] === h);
          const actualHeaders = matches(headers) ? headers : legacyHeaders && matches(legacyHeaders) ? legacyHeaders : null;
          if (!actualHeaders) throw Error('CSV headers must be: ' + headers.join(', '));
          const data = rows.slice(1);
          if (data.some(r => r.length !== actualHeaders.length)) throw Error('CSV row has the wrong number of columns.');
          apply(data, actualHeaders);
          notice('CSV imported.')
        } catch (e) {
          notice(e.message, true)
        }
      };
      reader.onerror = () => notice('Unable to read this file.', true);
      reader.readAsText(file)
    };
    input.click()
  }
};
