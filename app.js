/* ============================================================
   ซ้อมข้อสอบ IC Plain
   ------------------------------------------------------------
   ตัวโค้ดไม่รู้จักข้อสอบข้อไหนเลย ข้อสอบทั้งหมดอยู่ใน data/
   เปลี่ยนวิชาใหม่ = วางไฟล์ชุดใหม่ทับ ไม่ต้องแก้ไฟล์นี้

     data/questions.json       ชุดที่เขียนเอง  — ขึ้น GitHub ได้
     data/questions-mock.json  ชุดสำหรับอ่านเอง — อยู่ใน .gitignore
     data/topics.json          การ์ดหลักการรายหัวข้อ (ส่วน "ให้ความรู้")

   โครงหนึ่งข้อ:
     { id, set, no, q, choices:[4], answer:1-4, topic, topicName, part }
   ============================================================ */

'use strict';

var BANK   = [];
var TOPICS = {};
var QUIZ   = null;

var STORE_KEY = 'ic-quiz-v1';

/* ---------- เก็บสถิติ ----------
   localStorage อาจถูกปิดหรือเต็ม ทุกจุดจึงต้องกันพัง
   ไม่ใช้ก็ยังเล่นได้ แค่ไม่จำว่าเคยผิดข้อไหน                       */
function loadStore() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { seen: 0, right: 0, wrong: {}, done: {} };
}
function saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}
var STORE = loadStore();

/* ---------- helper ---------- */
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls)  n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/* ชุดข้อสอบมีทั้งแบบเรียกด้วยเลขและแบบตั้งชื่อเอง ให้ข้อมูลบอกชื่อตัวเองได้ */
function setLabel(q) { return q.setName || ('ชุดที่ ' + q.set); }

function show(screen) {
  $('screen-home').hidden = screen !== 'home';
  $('screen-quiz').hidden = screen !== 'quiz';
  $('screen-done').hidden = screen !== 'done';
  $('btn-home').hidden    = screen === 'home';
  window.scrollTo(0, 0);
}

/* ---------- โหลดข้อมูล ----------
   ไฟล์ใน data/ ถูกโหลดมาก่อนแล้วด้วย script tag ที่ index.html
   ตรงนี้จึงเป็นแค่การรวมชุด แล้วคัดข้อที่ยังไม่สมบูรณ์ออก              */
function boot() {
  TOPICS = window.IC_DATA_TOPICS || {};

  var own  = Array.isArray(window.IC_DATA_QUESTIONS) ? window.IC_DATA_QUESTIONS : [];
  var mock = Array.isArray(window.IC_DATA_MOCK)      ? window.IC_DATA_MOCK      : [];

  // ข้อที่ยังแปลงจากต้นฉบับไม่ครบ ไม่เอามาถาม แต่บอกจำนวนไว้ให้รู้ว่ามีค้าง
  var broken = 0;
  BANK = own.concat(mock).filter(function (q) {
    var ok = q && q.q && Array.isArray(q.choices) && q.choices.length === 4 &&
             q.answer >= 1 && q.answer <= 4 && !q.needsReview;
    if (!ok) broken++;
    return ok;
  });

  if (!BANK.length) { failScreen(); return; }

  $('bank-line').textContent =
    'คลังข้อสอบ ' + BANK.length + ' ข้อ' +
    (broken ? ' · พักไว้ ' + broken + ' ข้อ เพราะต้นฉบับยังไม่ครบ' : '');
  $('foot-bank').textContent = 'คลังข้อสอบ ' + BANK.length + ' ข้อ';

  buildHome();
  show('home');
}

function failScreen() {
  $('bank-line').innerHTML =
    '<b>ยังไม่มีข้อสอบให้ทำ</b><br>' +
    'ต้องมีไฟล์ <code>data/questions.js</code> อยู่ข้าง ๆ ไฟล์นี้ ' +
    'และไฟล์นั้นต้องกำหนดค่า <code>window.IC_DATA_QUESTIONS</code> เป็นรายการข้อสอบ';
}

/* ---------- หน้าแรก ---------- */
function buildHome() {
  // ซ้อมทั้งฉบับ — แยกตามชุดที่มีจริงในคลัง
  var sets = {};
  BANK.forEach(function (q) {
    var k = String(q.set);
    if (!sets[k]) sets[k] = { n: 0, label: setLabel(q) };
    sets[k].n++;
  });
  var wrapSets = $('full-sets');
  wrapSets.innerHTML = '';
  Object.keys(sets).sort().forEach(function (s) {
    var b = el('button', 'btn', sets[s].label + '  (' + sets[s].n + ' ข้อ)');
    b.onclick = function () {
      startQuiz(
        BANK.filter(function (q) { return String(q.set) === String(s); })
            .sort(function (x, y) { return x.no - y.no; }),
        sets[s].label
      );
    };
    wrapSets.appendChild(b);
  });

  // ซ้อมรายหัวข้อ — เรียงตาม topics.json ซึ่งเรียงตามบลูพรินต์อยู่แล้ว
  var counts = {};
  BANK.forEach(function (q) { counts[q.topic] = (counts[q.topic] || 0) + 1; });
  var list = $('topic-list');
  list.innerHTML = '';
  Object.keys(TOPICS).forEach(function (id) {
    if (!counts[id]) return;
    var t = TOPICS[id];
    var b = el('button', 'btn topic-btn');
    var left = el('span');
    left.appendChild(el('span', null, t.name));
    left.appendChild(el('span', 'part', t.part || ''));
    b.appendChild(left);
    b.appendChild(el('span', 'n', counts[id] + ' ข้อ'));
    b.onclick = function () {
      startQuiz(shuffle(BANK.filter(function (q) { return q.topic === id; })), t.name);
    };
    list.appendChild(b);
  });

  // สุ่ม
  Array.prototype.forEach.call(document.querySelectorAll('[data-random]'), function (b) {
    b.onclick = function () {
      var n = parseInt(b.getAttribute('data-random'), 10);
      startQuiz(shuffle(BANK.slice()).slice(0, n), 'สุ่ม ' + n + ' ข้อ');
    };
  });

  // ทบทวนข้อที่เคยผิด
  var wrongIds = Object.keys(STORE.wrong || {});
  var wrongBtn = $('btn-wrong');
  var wrongSet = BANK.filter(function (q) { return STORE.wrong[q.id]; });
  wrongBtn.disabled = wrongSet.length === 0;
  wrongBtn.textContent = wrongSet.length
    ? 'ทบทวนข้อที่เคยตอบผิด (' + wrongSet.length + ' ข้อ)'
    : 'ยังไม่มีข้อที่ตอบผิด';
  wrongBtn.onclick = function () { startQuiz(shuffle(wrongSet), 'ข้อที่เคยตอบผิด'); };
  void wrongIds;

  drawStats();
}

function drawStats() {
  var card = $('stats-card');
  if (!STORE.seen) { card.hidden = true; return; }
  card.hidden = false;
  var pct = Math.round(STORE.right / STORE.seen * 100);
  var body = $('stats-body');
  body.innerHTML = '';
  [['ตอบไปแล้ว', STORE.seen + ' ข้อ'],
   ['ถูก', STORE.right + ' ข้อ'],
   ['ความแม่น', pct + '%'],
   ['ค้างผิดอยู่', Object.keys(STORE.wrong).length + ' ข้อ']
  ].forEach(function (p) {
    var d = el('div', 'stat');
    d.appendChild(el('b', null, p[1]));
    d.appendChild(el('span', null, p[0]));
    body.appendChild(d);
  });
}

/* ---------- ทำข้อสอบ ---------- */
function startQuiz(list, label) {
  if (!list.length) return;
  QUIZ = { list: list, i: 0, right: 0, label: label, log: [] };
  show('quiz');
  renderQ();
}

function renderQ() {
  var q = QUIZ.list[QUIZ.i];

  $('bar').style.width = (QUIZ.i / QUIZ.list.length * 100) + '%';
  $('counter').textContent = (QUIZ.i + 1) + ' / ' + QUIZ.list.length;
  $('topic-chip').textContent = q.topicName || '';
  $('score-chip').textContent = 'ถูก ' + QUIZ.right;

  $('qsource').textContent = setLabel(q) + ' ข้อ ' + q.no;
  $('qtext').textContent   = q.q;

  var box = $('choices');
  box.innerHTML = '';
  q.choices.forEach(function (c, idx) {
    var b = el('button', 'choice');
    b.appendChild(el('span', 'k', String(idx + 1)));
    b.appendChild(el('span', null, c));
    b.onclick = function () { answer(idx + 1); };
    box.appendChild(b);
  });

  $('verdict').hidden = true;
  $('concept').hidden = true;
  $('btn-next').hidden = true;
  $('btn-skip').hidden = false;
}

function answer(pick) {
  var q  = QUIZ.list[QUIZ.i];
  var ok = pick === q.answer;

  // ล็อกปุ่มไว้ ไม่ให้กดซ้ำหลังเฉลย
  var btns = $('choices').children;
  for (var i = 0; i < btns.length; i++) {
    var n = i + 1;
    btns[i].disabled = true;
    if (n === q.answer)          btns[i].className = 'choice correct';
    else if (n === pick && !ok)  btns[i].className = 'choice wrong';
    else                         btns[i].className = 'choice dim';
  }

  if (ok) QUIZ.right++;
  QUIZ.log.push({ q: q, pick: pick, ok: ok });

  STORE.seen++;
  if (ok) { STORE.right++; delete STORE.wrong[q.id]; }
  else    { STORE.wrong[q.id] = 1; }
  STORE.done[q.id] = 1;
  saveStore(STORE);

  var v = $('verdict');
  v.className = 'card verdict' + (ok ? '' : ' bad');
  v.innerHTML = '';
  var head = el('div', 'head');
  head.appendChild(el('span', 'tag', ok ? 'ถูก' : 'ผิด'));
  head.appendChild(el('b', null, 'เฉลยคือข้อ ' + q.answer));
  v.appendChild(head);
  v.appendChild(el('p', null, q.choices[q.answer - 1]));
  if (!ok) v.appendChild(el('p', 'muted', 'คุณตอบข้อ ' + pick + ' — ' + q.choices[pick - 1]));
  v.hidden = false;

  renderConcept(q);

  $('score-chip').textContent = 'ถูก ' + QUIZ.right;
  $('btn-skip').hidden = true;
  $('btn-next').hidden = false;
  $('btn-next').textContent =
    (QUIZ.i + 1 >= QUIZ.list.length) ? 'ดูผลรวม' : 'ข้อถัดไป';
}

/* การ์ดหลักการ — ส่วน "ให้ความรู้"
   ไม่ได้อธิบายรายข้อ แต่ให้หลักของหัวข้อนั้น เพราะข้อสอบวนอยู่บนหลักเดิม
   ตอบข้อนี้ผิดแล้วอ่านการ์ด ควรตอบข้ออื่นในหัวข้อเดียวกันได้เอง            */
function renderConcept(q) {
  var t = TOPICS[q.topic];
  var c = $('concept');
  if (!t) { c.hidden = true; return; }
  c.innerHTML = '';
  c.appendChild(el('h3', null, 'หลักของหัวข้อ ' + t.name));
  if (t.key) c.appendChild(el('p', 'lead', t.key));
  if (t.points && t.points.length) {
    var ul = el('ul');
    t.points.forEach(function (p) { ul.appendChild(el('li', null, p)); });
    c.appendChild(ul);
  }
  c.appendChild(el('p', 'where', (t.part || '') + (t.questions ? ' · ' + t.questions : '')));
  c.hidden = false;
}

/* ---------- จบชุด ---------- */
function finish() {
  show('done');
  var total = QUIZ.log.length;
  var right = QUIZ.right;
  var pct   = total ? Math.round(right / total * 100) : 0;

  $('done-title').textContent = 'จบ ' + QUIZ.label;
  $('done-score').textContent = right + ' / ' + total + '  (' + pct + '%)';

  // เกณฑ์จริงคือ 70% รวม และต้องได้ 70% ของหมวดที่ 2 ด้วย
  var p2 = QUIZ.log.filter(function (r) { return (r.q.part || '') === '2'; });
  var p2right = p2.filter(function (r) { return r.ok; }).length;
  var msg = pct >= 70 ? 'ผ่านเกณฑ์รวม 70%' : 'ยังไม่ถึงเกณฑ์รวม 70%';
  if (p2.length) {
    var p2pct = Math.round(p2right / p2.length * 100);
    msg += ' · หมวดที่ 2 ได้ ' + p2right + '/' + p2.length + ' (' + p2pct + '%) ' +
           (p2pct >= 70 ? 'ผ่าน' : 'ยังไม่ผ่าน — หมวดนี้มีเกณฑ์แยก ตกหมวดนี้คือตกทั้งฉบับ');
  }
  $('done-verdict').textContent = msg;

  // แยกตามหัวข้อ
  var by = {};
  QUIZ.log.forEach(function (r) {
    var k = r.q.topic || 'other';
    if (!by[k]) by[k] = { n: 0, ok: 0, name: r.q.topicName || 'อื่น ๆ' };
    by[k].n++; if (r.ok) by[k].ok++;
  });
  var bd = $('done-breakdown');
  bd.innerHTML = '';
  Object.keys(by).forEach(function (k) {
    var s = by[k], p = Math.round(s.ok / s.n * 100);
    var row = el('div', 'bar-row');
    var lbl = el('div', 'lbl');
    lbl.appendChild(el('span', null, s.name));
    lbl.appendChild(el('span', 'muted', s.ok + '/' + s.n + ' · ' + p + '%'));
    row.appendChild(lbl);
    var track = el('div', 'track');
    var fill  = el('div', 'fill' + (p < 50 ? ' low' : p < 70 ? ' mid' : ''));
    fill.style.width = p + '%';
    track.appendChild(fill);
    row.appendChild(track);
    bd.appendChild(row);
  });

  // ข้อที่ผิด
  var wr = $('done-wrong');
  wr.innerHTML = '';
  var bad = QUIZ.log.filter(function (r) { return !r.ok; });
  if (!bad.length) {
    wr.appendChild(el('p', 'muted', 'ไม่มีข้อผิดในชุดนี้'));
  } else {
    bad.forEach(function (r) {
      var d = el('div', 'wrongitem');
      d.appendChild(el('div', 'q', setLabel(r.q) + ' ข้อ ' + r.q.no + ' — ' + r.q.q));
      d.appendChild(el('div', 'a', 'เฉลย ข้อ ' + r.q.answer + ' · ' + r.q.choices[r.q.answer - 1]));
      d.appendChild(el('div', 'y', 'คุณตอบ ข้อ ' + r.pick + ' · ' + r.q.choices[r.pick - 1]));
      wr.appendChild(d);
    });
  }

  buildHome();
}

/* ---------- ปุ่มควบคุม ---------- */
function next() {
  QUIZ.i++;
  if (QUIZ.i >= QUIZ.list.length) finish();
  else renderQ();
}

document.addEventListener('DOMContentLoaded', function () {
  $('btn-next').onclick = next;
  $('btn-skip').onclick = next;
  $('btn-home').onclick = function () { buildHome(); show('home'); };
  $('btn-again').onclick = function () { buildHome(); show('home'); };
  $('btn-reset').onclick = function () {
    if (!confirm('ล้างสถิติและรายการข้อที่เคยตอบผิดทั้งหมด?')) return;
    STORE = { seen: 0, right: 0, wrong: {}, done: {} };
    saveStore(STORE);
    buildHome();
  };

  // คีย์ลัดสำหรับซ้อมเร็ว ๆ บนคอม — 1-4 ตอบ, Enter ไปข้อถัดไป
  document.addEventListener('keydown', function (e) {
    if ($('screen-quiz').hidden) return;
    if (e.key >= '1' && e.key <= '4') {
      var b = $('choices').children[+e.key - 1];
      if (b && !b.disabled) b.click();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!$('btn-next').hidden) { e.preventDefault(); next(); }
    }
  });

  boot();
});
