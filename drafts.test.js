// 실행: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./drafts.js');
global.window = {};
require('./data.js');
const FIELDS = global.window.WORKBENCH_FIELDS;

test('9개 분야, id 중복 없음, 모든 링크는 https 공식 도메인(gov.kr·.go.kr·.or.kr)', () => {
  assert.equal(FIELDS.length, 9);
  assert.equal(new Set(FIELDS.map(f => f.id)).size, 9);
  for (const f of FIELDS) {
    assert.ok(f.sources.length && f.checklist.length, f.id);
    for (const s of f.sources) assert.match(s.url, /^https:\/\/([a-z0-9.-]+\.(go|or)\.kr|www\.gov\.kr)\/$/, s.url);
  }
});

test('주민등록번호 감지·가림 (하이픈 유무 모두)', () => {
  assert.equal(D.findRRN('번호 900101-1234567, 9001012345678'), 2);
  assert.equal(D.maskRRN('900101-1234567'), '900101-1******');
  assert.equal(D.findRRN('전화 010-1234-5678, 금액 1234567'), 0);
  assert.equal(D.findRRN('991332-1234567'), 0); // 13월은 날짜 아님
});

test('금액 형식과 한글 병기', () => {
  assert.equal(D.won('1,234,000원'), '1,234,000');
  assert.equal(D.won('-5'), null);
  assert.equal(D.wonHangul(1234000), '일백이십삼만사천');
  assert.equal(D.wonHangul(100000000), '일억');
  assert.equal(D.wonHangul(10010), '일만일십');
  assert.equal(D.wonHangul(0), '영');
});

test('날짜 표기', () => {
  assert.equal(D.dateKo('2026-11-06'), '2026. 11. 6.');
  assert.equal(D.dateKo(''), '');
});

test('필수 항목 검증', () => {
  const e = D.validate('payment', { creditor: '홍길동' });
  assert.ok(e.some(x => x.includes('채무자 이름')));
  assert.ok(e.some(x => x.includes('청구 원금')));
  assert.ok(D.validate('payment', { creditor: 'a', creditorAddr: 'b', debtor: 'c', debtorAddr: 'd', amount: 'abc', cause: 'x' }).some(x => x.includes('금액')));
  assert.ok(D.validate('privacy', { org: 'a', name: 'b', contact: 'c', types: [] }).some(x => x.includes('요구 내용')));
  assert.deepEqual(D.validate('nope', {}), ['알 수 없는 문서 종류']);
});

test('지급명령 초안: 청구취지 금액·이자·소명자료 번호', () => {
  const t = D.render('payment', {
    creditor: '홍길동', creditorAddr: '서울', debtor: '김철수', debtorAddr: '부산', amount: '3000000',
    cause: '2026. 1. 5. 300만원을 빌려줌', interestFrom: '2026-03-01', rate: '12', evidence: '차용증\n이체 내역', date: '2026-11-06',
  });
  assert.match(t, /금 3,000,000원\(금 삼백만원\)/);
  assert.match(t, /2026\. 3\. 1\.부터 다 갚는 날까지 연 12%/);
  assert.match(t, /1\. 차용증\n2\. 이체 내역/);
  assert.doesNotMatch(t, /\[채권자 이름\]/);
});

test('이자 정보가 없으면 이자 문구 없이 작성, 빈칸은 [표시]', () => {
  const t = D.render('payment', { amount: '1000' });
  assert.doesNotMatch(t, /연 .*%의 비율/);
  assert.match(t, /\[채무자 이름\]/);
});

test('개인정보 요구서: 선택한 요구만 번호를 매겨 포함, 주민번호는 가림', () => {
  const t = D.render('privacy', { org: '가나쇼핑', name: '홍길동', contact: 'a@b.c', types: ['열람', '처리정지'], detail: '회원번호와 900101-1234567 관련' });
  assert.match(t, /1\. 열람/);
  assert.match(t, /2\. 처리정지/);
  assert.doesNotMatch(t, /정정·삭제: /);
  assert.match(t, /900101-1\*{6}/);
  assert.doesNotMatch(t, /1234567/);
});

test('조사 기록: 목록 번호와 일시 형식', () => {
  const t = D.render('record', { subject: '민원 사실 확인', datetime: '2026-11-06T14:30', attendees: '홍길동(민원인)\n김OO(담당자)', statements: '홍길동: 10월에 연락함', writer: '김OO' });
  assert.match(t, /1\. 일시: 2026\. 11\. 6\. 14:30/);
  assert.match(t, / {2}2\) 김OO\(담당자\)/);
  assert.match(t, /\[없음\]/);
});
