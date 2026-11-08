// 문서 초안 생성 로직 (UI 없음). 결과는 '초안'이며 법률 자문이 아닙니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Drafts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 개인정보 보호: 주민등록번호 감지·가림
  const RRN = /\b(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-\s]?([1-8])\d{6}\b/g;
  function findRRN(text) { return (String(text).match(RRN) || []).length; }
  function maskRRN(text) {
    return String(text).replace(RRN, (m, yy, mm, dd, g) => `${yy}${mm}${dd}-${g}******`);
  }

  // ---- 형식 도우미
  function won(n) {
    const v = Math.round(Number(String(n).replace(/[,\s원]/g, '')));
    if (!Number.isFinite(v) || v < 0) return null;
    return v.toLocaleString('ko-KR');
  }
  // 1234000 -> "일백이십삼만사천" (금액 위조 방지용 한글 병기)
  function wonHangul(n) {
    let v = Math.round(Number(String(n).replace(/[,\s원]/g, '')));
    if (!Number.isFinite(v) || v < 0) return null;
    if (v === 0) return '영';
    const digit = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const small = ['', '십', '백', '천'];
    const big = ['', '만', '억', '조'];
    let out = '';
    for (let b = 0; v > 0; b++) {
      const chunk = v % 10000; v = Math.floor(v / 10000);
      if (!chunk) continue;
      let s = '';
      for (let i = 0, c = chunk; c > 0; i++, c = Math.floor(c / 10)) {
        const d = c % 10;
        if (d) s = digit[d] + small[i] + s;
      }
      out = s + big[b] + out;
    }
    return out;
  }
  function dateKo(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${+m[1]}. ${+m[2]}. ${+m[3]}.` : '';
  }
  const blank = (v, label) => (v && String(v).trim()) ? String(v).trim() : `[${label}]`;

  // ---- 템플릿 정의: fields(입력 항목) + render
  const TEMPLATES = {
    privacy: {
      title: '개인정보 열람·정정·삭제·처리정지 요구서',
      law: '개인정보 보호법 제35조(열람), 제36조(정정·삭제), 제37조(처리정지)',
      fields: [
        { key: 'org', label: '상대 기관(회사)명', required: true },
        { key: 'name', label: '요구인 이름', required: true },
        { key: 'contact', label: '회신 받을 연락처(이메일·주소)', required: true },
        { key: 'types', label: '요구 내용', type: 'multi', options: ['열람', '정정·삭제', '처리정지'], required: true },
        { key: 'detail', label: '구체적 내용 (어떤 정보를, 왜)', type: 'textarea' },
        { key: 'date', label: '작성일', type: 'date' },
      ],
      render(f) {
        const types = (f.types || []);
        const lines = [];
        if (types.includes('열람')) lines.push('1. 열람: 귀사가 보유한 본인의 개인정보 항목, 수집·이용 목적, 보유 기간, 제3자 제공 내역의 열람을 요구합니다. (제35조)');
        if (types.includes('정정·삭제')) lines.push(`${lines.length + 1}. 정정·삭제: 아래 기재한 개인정보의 정정 또는 삭제를 요구합니다. (제36조)`);
        if (types.includes('처리정지')) lines.push(`${lines.length + 1}. 처리정지: 아래 기재한 개인정보 처리의 정지를 요구합니다. (제37조)`);
        return [
          `개인정보 ${types.join('·')} 요구서`,
          '',
          `수신: ${blank(f.org, '상대 기관명')} 개인정보 보호책임자 귀하`,
          '',
          `요구인: ${blank(f.name, '이름')}`,
          `회신 연락처: ${blank(f.contact, '연락처')}`,
          '',
          '본인은 「개인정보 보호법」에 따라 다음과 같이 요구합니다.',
          '',
          ...lines,
          '',
          '[구체적 내용]',
          blank(f.detail, '대상 정보와 사유'),
          '',
          '법에서 정한 기간 안에 조치 결과를 위 연락처로 회신해 주시기 바랍니다.',
          '본인 확인이 필요하면 주민등록번호 전체가 아닌, 귀사가 정한 본인 확인 방법으로 진행해 주십시오.',
          '',
          `${dateKo(f.date) || '[작성일]'}`,
          `요구인 ${blank(f.name, '이름')} (서명)`,
        ].join('\n');
      },
    },
    payment: {
      title: '지급명령 신청서 (초안)',
      law: '민사소송법 제462조 이하 (독촉절차)',
      fields: [
        { key: 'creditor', label: '채권자(신청인) 이름', required: true },
        { key: 'creditorAddr', label: '채권자 주소', required: true },
        { key: 'debtor', label: '채무자 이름', required: true },
        { key: 'debtorAddr', label: '채무자 주소(송달 가능한 곳)', required: true },
        { key: 'amount', label: '청구 원금(원)', type: 'number', required: true },
        { key: 'cause', label: '청구 원인 (언제·무엇을·얼마나, 갚기로 한 날)', type: 'textarea', required: true },
        { key: 'interestFrom', label: '지연손해금 기산일', type: 'date' },
        { key: 'rate', label: '지연손해금 연 이율(%)', type: 'number' },
        { key: 'evidence', label: '소명 자료 (줄마다 하나)', type: 'textarea' },
        { key: 'date', label: '작성일', type: 'date' },
      ],
      render(f) {
        const amt = won(f.amount);
        const hangul = wonHangul(f.amount);
        const interest = f.rate && f.interestFrom
          ? ` 및 이에 대하여 ${dateKo(f.interestFrom)}부터 다 갚는 날까지 연 ${f.rate}%의 비율로 계산한 돈`
          : '';
        const ev = String(f.evidence || '').split('\n').map(s => s.trim()).filter(Boolean);
        return [
          '지 급 명 령 신 청 서',
          '',
          `채권자  ${blank(f.creditor, '채권자 이름')}`,
          `        ${blank(f.creditorAddr, '채권자 주소')}`,
          `채무자  ${blank(f.debtor, '채무자 이름')}`,
          `        ${blank(f.debtorAddr, '채무자 주소')}`,
          '',
          '청 구 취 지',
          `채무자는 채권자에게 ${amt ? `금 ${amt}원(금 ${hangul}원)` : '[금액]'}${interest}을 지급하라는 명령을 구합니다.`,
          '독촉절차비용은 채무자가 부담한다.',
          '',
          '청 구 원 인',
          blank(f.cause, '청구 원인'),
          '',
          '소 명 방 법',
          ...(ev.length ? ev.map((e, i) => `${i + 1}. ${e}`) : ['[차용증, 이체 내역 등]']),
          '',
          `${dateKo(f.date) || '[작성일]'}`,
          `위 채권자 ${blank(f.creditor, '채권자 이름')} (서명 또는 날인)`,
          '',
          '[관할 법원] 귀중',
          '',
          '※ 이율·관할·인지대·송달료는 법원 안내 또는 전자소송 화면에서 반드시 확인하세요.',
        ].join('\n');
      },
    },
    record: {
      title: '사실 조사·면담 기록',
      law: '',
      fields: [
        { key: 'subject', label: '조사 건명', required: true },
        { key: 'datetime', label: '일시', type: 'datetime-local', required: true },
        { key: 'place', label: '장소' },
        { key: 'attendees', label: '참석자 (이름·역할, 줄마다 하나)', type: 'textarea', required: true },
        { key: 'statements', label: '진술 요지 (발언자: 내용, 줄마다 하나)', type: 'textarea', required: true },
        { key: 'evidence', label: '제출·확인한 자료 (줄마다 하나)', type: 'textarea' },
        { key: 'next', label: '추가 확인 사항·다음 일정', type: 'textarea' },
        { key: 'writer', label: '작성자', required: true },
      ],
      render(f) {
        const list = (v, fb) => {
          const a = String(v || '').split('\n').map(s => s.trim()).filter(Boolean);
          return a.length ? a.map((x, i) => `  ${i + 1}) ${x}`) : [`  [${fb}]`];
        };
        const dt = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(f.datetime || '');
        return [
          `조사(면담) 기록 — ${blank(f.subject, '건명')}`,
          '',
          `1. 일시: ${dt ? `${dateKo(dt[1])} ${dt[2]}` : '[일시]'}`,
          `2. 장소: ${blank(f.place, '장소')}`,
          '3. 참석자',
          ...list(f.attendees, '참석자'),
          '4. 진술 요지 (사실과 의견을 구분해 기록)',
          ...list(f.statements, '진술 요지'),
          '5. 제출·확인 자료',
          ...list(f.evidence, '자료'),
          '6. 추가 확인 사항',
          ...list(f.next, '없음'),
          '',
          '위 기록 내용이 진술과 같음을 확인합니다.',
          '',
          `작성자 ${blank(f.writer, '작성자')} (서명)      진술인 확인 ________ (서명)`,
        ].join('\n');
      },
    },
  };

  function validate(type, f) {
    const t = TEMPLATES[type];
    if (!t) return ['알 수 없는 문서 종류'];
    const errors = [];
    for (const fd of t.fields) {
      const v = f[fd.key];
      const empty = Array.isArray(v) ? v.length === 0 : !(v && String(v).trim());
      if (fd.required && empty) errors.push(`${fd.label}을(를) 입력하세요`);
    }
    if (type === 'payment' && f.amount && won(f.amount) === null) errors.push('금액은 0 이상의 숫자여야 합니다');
    if (type === 'payment' && f.rate && !(Number(f.rate) >= 0 && Number(f.rate) <= 100)) errors.push('이율은 0~100 사이여야 합니다');
    const rrnCount = Object.values(f).reduce((a, v) => a + findRRN(Array.isArray(v) ? v.join(' ') : v || ''), 0);
    if (rrnCount) errors.push(`주민등록번호로 보이는 값 ${rrnCount}개가 있습니다 — 초안에서는 자동으로 가립니다`);
    return errors;
  }

  function render(type, fields) {
    const t = TEMPLATES[type];
    if (!t) throw new Error('알 수 없는 문서 종류');
    return maskRRN(t.render(fields || {}));
  }

  return { TEMPLATES, validate, render, findRRN, maskRRN, won, wonHangul, dateKo };
});
