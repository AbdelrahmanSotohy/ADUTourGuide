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

function notice(text, error = false) {
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
