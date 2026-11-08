(function () {
  'use strict';
  const D = window.Drafts;
  const FIELDS = window.WORKBENCH_FIELDS;
  const KEY = 'korean-public-workbench.v1';
  const $ = id => document.getElementById(id);
  const store = load();

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { checks: s.checks || {}, inputs: s.inputs || {} }; }
    catch (e) { return { checks: {}, inputs: {} }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가 */ } }
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
  }

  // ---------- 분야별 자료
  function renderFields() {
    const q = $('q').value.trim().toLowerCase();
    const box = $('fields'); box.textContent = '';
    const shown = FIELDS.filter(f => !q || [f.name, f.desc, ...f.sources.map(s => s.name + ' ' + s.note), ...f.checklist].join(' ').toLowerCase().includes(q));
    if (!shown.length) { box.append(h('p', { class: 'muted' }, '검색 결과가 없습니다')); return; }
    for (const f of shown) {
      const done = f.checklist.filter((_, i) => store.checks[`${f.id}:${i}`]).length;
      box.append(h('article', { class: 'field', 'data-id': f.id },
        h('h2', {}, f.name), h('div', { class: 'd' }, f.desc),
        h('ul', { class: 'src' }, f.sources.map(s => h('li', {},
          h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.name + ' ↗'), ' ', h('small', {}, s.note)))),
        h('div', { class: 'progress' }, `준비 ${done}/${f.checklist.length}`),
        h('ul', { class: 'chk' }, f.checklist.map((c, i) => {
          const key = `${f.id}:${i}`;
          return h('li', {}, h('label', {},
            h('input', { type: 'checkbox', checked: !!store.checks[key], onchange: e => { store.checks[key] = e.target.checked; save(); renderFields(); } }),
            h('span', {}, c)));
        }))));
    }
  }
  $('q').addEventListener('input', renderFields);

  // ---------- 문서 초안
  const typeSel = $('type');
  Object.entries(D.TEMPLATES).forEach(([k, t]) => typeSel.append(h('option', { value: k }, t.title)));

  function currentValues() {
    const t = D.TEMPLATES[typeSel.value]; const v = {};
    for (const fd of t.fields) {
      if (fd.type === 'multi') v[fd.key] = [...document.querySelectorAll(`[name="${fd.key}"]:checked`)].map(x => x.value);
      else v[fd.key] = (document.querySelector(`[name="${fd.key}"]`) || {}).value || '';
    }
    return v;
  }

  function renderInputs() {
    const t = D.TEMPLATES[typeSel.value];
    const saved = store.inputs[typeSel.value] || {};
    $('lawRef').textContent = t.law ? '근거: ' + t.law : '';
    const box = $('inputs'); box.textContent = '';
    for (const fd of t.fields) {
      const val = saved[fd.key];
      let input;
      if (fd.type === 'multi') {
        input = h('div', { class: 'multi' }, fd.options.map(o => h('label', {},
          h('input', { type: 'checkbox', name: fd.key, value: o, checked: (val || []).includes(o) }), o)));
      } else if (fd.type === 'textarea') {
        input = h('textarea', { name: fd.key }, val || '');
      } else {
        input = h('input', { name: fd.key, type: fd.type === 'number' ? 'text' : (fd.type || 'text'), inputmode: fd.type === 'number' ? 'decimal' : null, value: val || '' });
      }
      box.append(h('label', {}, h('span', { class: fd.required ? 'req' : '' }, fd.label), input));
    }
    $('errors').textContent = '';
  }

  typeSel.addEventListener('change', renderInputs);
  // 자동 보관할 때 주민등록번호는 가린 값으로만 저장
  $('inputs').addEventListener('input', () => {
    const v = currentValues();
    for (const k of Object.keys(v)) if (typeof v[k] === 'string') v[k] = D.maskRRN(v[k]);
    store.inputs[typeSel.value] = v; save();
  });

  $('draftForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = currentValues();
    const errs = D.validate(typeSel.value, v);
    const blocking = errs.filter(x => !x.startsWith('주민등록번호'));
    $('errors').textContent = '';
    errs.forEach(x => $('errors').append(h('li', {}, x)));
    if (blocking.length) return;
    $('output').value = D.render(typeSel.value, v);
    $('outMsg').textContent = '초안을 만들었습니다. 결과 창에서 바로 고칠 수 있습니다.';
  });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm('이 문서 종류의 입력을 모두 지울까요?')) return;
    delete store.inputs[typeSel.value]; save(); renderInputs(); $('output').value = '';
  });
  $('copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('output').value); $('outMsg').textContent = '복사했습니다'; }
    catch (e) { $('output').select(); $('outMsg').textContent = '자동 복사가 막혀 있어 내용을 선택했습니다. Ctrl+C로 복사하세요'; }
  });
  $('saveBtn').addEventListener('click', () => {
    const name = D.TEMPLATES[typeSel.value].title.replace(/[\\/:*?"<>|()]/g, '').replace(/\s+/g, '_') + '.txt';
    const url = URL.createObjectURL(new Blob([D.maskRRN($('output').value)], { type: 'text/plain;charset=utf-8' }));
    const a = h('a', { href: url, download: name }); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('printBtn').addEventListener('click', () => window.print());

  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    ['fields', 'drafts'].forEach(t => { $('tab-' + t).hidden = t !== b.dataset.tab; });
  }));

  renderFields(); renderInputs();
})();
