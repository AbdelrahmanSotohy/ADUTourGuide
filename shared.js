'use strict';
const ADU = {
  grades: {
    A: 4,
    'B+': 3.5,
    B: 3,
    'C+': 2.5,
    C: 2,
    'D+': 1.5,
    D: 1,
    F: 0
  },
  tiers: {
    A: 90,
    'B+': 85,
    B: 80,
    'C+': 75,
    C: 70,
    'D+': 65,
    D: 60
  },
  escape: s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } [c])),
  id: () => Date.now().toString(36) + Math.random().toString(36).slice(2),
  number: (v, min = 0, max = Infinity) => {
    let n = Number(v);
    if (String(v).trim() === '' || !Number.isFinite(n) || n < min || n > max) throw Error(`Enter a number between ${min} and ${max===Infinity?'a valid upper limit':max}.`);
    return n;
  }
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Shared inline validation: messages follow their control and are announced accessibly.
const Fields = {
  serial: 0,
  clear(control) {
    if (!control) return;
    const id = control.dataset.errorId;
    if (id) {
      document.getElementById(id)?.remove();
      const described = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value !== id);
      if (described.length) control.setAttribute('aria-describedby', described.join(' '));
      else control.removeAttribute('aria-describedby');
      delete control.dataset.errorId;
    }
    control.removeAttribute('aria-invalid');
  },
  clearAll() {
    document.querySelectorAll('[data-error-id]').forEach(control => this.clear(control));
  },
  show(selector, text) {
    const control = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!control) return false;
    this.clear(control);
    const message = document.createElement('small');
    message.id = 'field-error-' + ++this.serial;
    message.className = 'field-error';
    message.setAttribute('role', 'alert');
    message.textContent = text;
    control.insertAdjacentElement('afterend', message);
    control.dataset.errorId = message.id;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', ((control.getAttribute('aria-describedby') || '') + ' ' + message.id).trim());
    return true;
  },
  fail(selector, text) {
    const error = new Error(text);
    error.field = selector;
    throw error;
  },
  number(value, min, max, selector) {
    try {
      return ADU.number(value, min, max);
    } catch (error) {
      error.field = selector;
      throw error;
    }
  },
  report(error) {
    return error?.field ? this.show(error.field, error.message) : false;
  }
};
document.addEventListener('input', event => {
  Fields.clear(event.target);
  Fields.clear(event.target.closest?.('.days'));
}, true);
document.addEventListener('change', event => Fields.clear(event.target), true);
document.addEventListener('invalid', event => {
  event.preventDefault();
  Fields.show(event.target, event.target.validationMessage);
}, true);

function notice(text, error = false) {
  if (error && Fields.report(text)) text = '';
  else if (text instanceof Error) text = text.message;
  const el = $('#status');
  if (el) {
    el.textContent = text;
    el.classList.toggle('warning', error)
  }
}

function toggleMenu() {
  let list = $('#navLinks'),
    open = list.classList.toggle('show');
  $('.hamburger').setAttribute('aria-expanded', String(open))
}
document.addEventListener('DOMContentLoaded', () => {
  const button = $('.hamburger');
  button.addEventListener('click', toggleMenu);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $('#navLinks').classList.remove('show');
      button.setAttribute('aria-expanded', 'false')
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.navbar')) {
      $('#navLinks').classList.remove('show');
      button.setAttribute('aria-expanded', 'false')
    }
  });
  window.addEventListener('resize', () => {
    if (innerWidth >= 768) {
      $('#navLinks').classList.remove('show');
      button.setAttribute('aria-expanded', 'false')
    }
  })
});

// Validate browser constraints on blur without interrupting typing.
document.addEventListener('blur', event => {
  const control = event.target;
  if (control.matches?.('input, select, textarea') && control.validity && !control.validity.valid) Fields.show(control, control.validationMessage);
}, true);
