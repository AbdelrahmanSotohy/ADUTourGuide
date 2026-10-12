'use strict';
const Storage = {
  load(key, fallback) {
    try {
      const s = localStorage.getItem('adu-tour-guide:' + key);
      return s ? JSON.parse(s) : fallback
    } catch {
      return fallback
    }
  },
  save(key, data) {
    try {
      localStorage.setItem('adu-tour-guide:' + key, JSON.stringify(data));
      return true
    } catch {
      notice('Auto-save is unavailable. Your changes may not be saved in this browser.', true);
      return false
    }
  },
  debounce(key, get) {
    let timer;
    const save = () => Storage.save(key, get());
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer);
      timer = setTimeout(save, 350)
    }
  }
};
