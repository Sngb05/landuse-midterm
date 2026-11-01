(() => {
  'use strict';

  const D = window.DATA;
  const app = document.getElementById('app');
  const navLinks = document.querySelectorAll('.nav a');

  const LECS = D.lectures;
  const LEC = Object.fromEntries(LECS.map(l => [l.id, l]));
  const QUIZ = D.quiz;
  const TYPE_LABEL = { mcq: '객관식', ox: 'OX', blank: '빈칸', essay: '서술형' };
  const CIRCLED = '①②③④⑤⑥⑦⑧';

  // ---------- helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/[\s·・.,:;()[\]{}'"“”‘’`\-–—~_/\\!?%㎡]/g, '');
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fmt = (n, d = 2) => Number(n.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const isGichul = q => q.tags.some(t => t.startsWith('기출'));
  const zc = id => `--zc:var(--z${id})`;

  function tagHTML(t) {
    const m = /^기출(\d{4})$/.exec(t);
    if (m) return `<span class="tag tag-gichul">★ 기출 ${m[1]}</span>`;
    if (t === '필기') return '<span class="tag tag-hand">✍ 필기</span>';
    if (t === '예상') return '<span class="tag tag-expect">예상</span>';
    return `<span class="tag tag-sup">${esc(t)}</span>`;
  }

  // ---------- per-viewer progress (this browser only) ----------
  const KEY = 'landuse-midterm-v1';
  let store = { items: {}, setup: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') store = Object.assign(store, saved);
  } catch (e) { /* storage blocked: progress just won't persist */ }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  function record(id, res) {
    const r = store.items[id] || { n: 0, o: 0 };
    r.n += 1;
    if (res === 'o') r.o += 1;
    r.last = res;
    r.t = Date.now();
    store.items[id] = r;
    persist();
  }
  const needsReview = q => { const r = store.items[q.id]; return !!r && r.last !== 'o'; };
  const unseen = q => !store.items[q.id];
  function statsOf(items) {
    let seen = 0, right = 0;
    for (const q of items) {
      const r = store.items[q.id];
      if (!r) continue;
      seen++;
      if (r.last === 'o') right++;
    }
    return { total: items.length, seen, right, review: seen - right };
  }

  // ---------- router ----------
  let session = null;

  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'home';
    let view = 'home', arg = null;
    if (h === 'notes') view = 'notes';
    else if (/^note[0-9x]$/.test(h)) { view = 'note'; arg = h.slice(4); }
    else if (h === 'quiz') view = 'quiz';
    else if (h === 'play') view = 'play';
    else if (h === 'calc') view = 'calc';
    else if (/^exams(20\d\d)?$/.test(h)) { view = 'exams'; arg = h.slice(5) || null; }

    const group = { home: 'home', notes: 'notes', note: 'notes', quiz: 'quiz', play: 'quiz', calc: 'calc', exams: 'exams' }[view];
    navLinks.forEach(a => {
      if (a.dataset.group === group) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.classList.remove('memorize');
    VIEWS[view](arg);
    window.scrollTo(0, 0);
  }
  function go(hash) {
    if (location.hash === '#' + hash) route();
    else location.hash = hash;
  }

  // ---------- shared blocks ----------
  function lecListHTML() {
    return `<div class="lec-list">${LECS.map(l => {
      const items = QUIZ.filter(q => q.lec === l.id);
      const st = statsOf(items);
      const pct = st.total ? Math.round(st.seen / st.total * 100) : 0;
      const meta = [];
      if (l.counts.hand) meta.push(`✍ 필기 ${l.counts.hand}`);
      if (l.counts.gichul) meta.push(`★ 기출 ${l.counts.gichul}`);
      if (items.length) meta.push(`퀴즈 ${st.seen}/${st.total}`);
      return `<article class="lec" style="${zc(l.id)}">
        <div>
          <h3><small>${esc(l.label)}</small>${esc(l.title)}</h3>
          ${meta.length ? `<p class="meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
          <div class="acts">
            ${items.length ? `<div class="bar" aria-label="퀴즈 진도 ${pct}%"><i style="width:${pct}%"></i></div>` : '<div style="flex:1"></div>'}
            <a class="btn" href="#note${l.id}">노트</a>
            ${items.length ? `<button class="btn" data-quiz-lec="${l.id}">퀴즈</button>` : ''}
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  function bindQuickStarts(root) {
    $$('[data-quiz-lec]', root).forEach(b => b.addEventListener('click', () => {
      const L = LEC[b.dataset.quizLec];
      startSession(shuffle(QUIZ.filter(q => q.lec === L.id)), `${L.label} ${L.title}`);
    }));
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => {
      const kind = b.dataset.go;
      if (kind === 'review') startSession(shuffle(QUIZ.filter(needsReview)), '복습할 문항');
      if (kind === 'gichul') startSession(shuffle(QUIZ.filter(isGichul)), '기출 문항');
      if (kind === 'random') startSession(shuffle(QUIZ).slice(0, 10), '랜덤 10문제');
    }));
  }

  // ---------- home ----------
  function viewHome() {
    const st = statsOf(QUIZ);
    const rate = st.seen ? Math.round(st.right / st.seen * 100) + '%' : '–';
    const gichulN = QUIZ.filter(isGichul).length;
    app.innerHTML = `
      <header class="hero">
        <p class="eyebrow">경기대 도시·교통공학 · 3학년 2학기</p>
        <h1>토지이용계획<br>중간고사</h1>
        <p class="muted">1~7주차 범위 · 30점 · 서술형, 빈칸, 계산</p>
        <div class="legend">${LECS.filter(l => l.id !== '0').map(l => `<span><i class="swatch" style="${zc(l.id)}"></i>${esc(l.label)} ${esc(l.short)}</span>`).join('')}</div>
      </header>

      <section class="card">
        <div class="row-between"><h2>학습 현황</h2><span class="muted num">${st.seen} / ${st.total}</span></div>
        <div class="stats">
          <div class="stat"><b>${st.seen}</b><span>푼 문항</span></div>
          <div class="stat"><b>${rate}</b><span>정답률</span></div>
          <div class="stat"><b>${st.review}</b><span>복습할 문항</span></div>
        </div>
        <div class="btn-row">
          <button class="btn primary" data-go="review" ${st.review ? '' : 'disabled'}>복습 문항 풀기</button>
          <button class="btn" data-go="gichul">기출만 (${gichulN})</button>
          <button class="btn" data-go="random">랜덤 10문제</button>
        </div>
        <p class="muted small">진도는 이 브라우저에만 저장돼요.</p>
      </section>

      <section class="card">
        <h2>여러 번 나온 문제</h2>
        <ul class="hot">${D.hot.map(h => `<li><a href="${esc(h.href)}"><span>${esc(h.title)}</span><span class="years">${h.years.map(y => `<span class="tag tag-gichul">${esc(String(y))}</span>`).join('')}</span></a></li>`).join('')}</ul>
      </section>

      <section class="stack">
        <h2>강의별 노트와 퀴즈</h2>
        ${lecListHTML()}
      </section>

      <p class="notice">${D.meta.notice}</p>`;
    bindQuickStarts(app);
  }

  // ---------- notes ----------
  function viewNotes() {
    app.innerHTML = `
      <header class="stack-sm">
        <p class="eyebrow">노트</p>
        <h1 class="page-title">강의별 요약노트</h1>
        <p class="muted">슬라이드와 아이패드 필기를 함께 정리했어요.</p>
        ${legendHTML()}
      </header>
      ${lecListHTML()}`;
    bindQuickStarts(app);
  }

  function legendHTML() {
    return `<p class="legend-line"><span class="tag tag-gichul">★ 기출</span> 시험에 나온 내용 <span class="hand-mark">✍</span> <span class="hand">내 필기</span> <span class="tag tag-sup">보충</span> 슬라이드 밖 설명 <span class="pg">p12</span> PDF 쪽</p>`;
  }

  function viewNote(id) {
    const L = LEC[id];
    if (!L) { location.replace('#notes'); return; }
    const qn = QUIZ.filter(q => q.lec === id).length;
    const i = LECS.indexOf(L);
    const prev = LECS[i - 1], next = LECS[i + 1];
    app.innerHTML = `
      <header class="note-head" style="${zc(id)}">
        <p class="eyebrow">${esc(L.label)}</p>
        <h1>${esc(L.title)}</h1>
        ${L.summary ? `<p class="summary">${esc(L.summary)}</p>` : ''}
        <div class="chips">
          <button class="chip" id="memo" aria-pressed="false">암기 모드</button>
          ${qn ? `<button class="chip" data-quiz-lec="${id}">퀴즈 ${qn}문항 풀기 →</button>` : ''}
        </div>
        ${legendHTML()}
      </header>
      ${L.sections.length ? `<nav class="toc" aria-label="목차">${L.sections.map(s => `<a class="chip" href="#note${id}" data-jump="${s.id}">${esc(s.label)}</a>`).join('')}</nav>` : ''}
      <article class="prose">${L.html}</article>
      <div class="note-foot">
        ${prev ? `<a class="btn" href="#note${prev.id}">← ${esc(prev.label)} ${esc(prev.short)}</a>` : ''}
        ${next ? `<a class="btn" href="#note${next.id}">${esc(next.label)} ${esc(next.short)} →</a>` : ''}
      </div>`;
    bindQuickStarts(app);

    $$('[data-jump]', app).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.jump);
      if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
    const memo = $('#memo');
    memo.addEventListener('click', () => {
      const on = document.body.classList.toggle('memorize');
      memo.setAttribute('aria-pressed', String(on));
      $$('.prose strong.shown', app).forEach(s => s.classList.remove('shown'));
    });
    $('.prose', app).addEventListener('click', e => {
      if (!document.body.classList.contains('memorize')) return;
      const s = e.target.closest('strong');
      if (s) s.classList.toggle('shown');
    });
  }

  // ---------- quiz setup ----------
  const QUIZ_LECS = LECS.filter(l => QUIZ.some(q => q.lec === l.id));
  const FILTERS = [
    ['all', '전체'], ['gichul', '★ 기출만'], ['hand', '✍ 필기'], ['unseen', '안 푼 것'], ['review', '복습할 것'],
  ];
  const FILTER_FN = {
    all: () => true,
    gichul: isGichul,
    hand: q => q.tags.includes('필기'),
    unseen,
    review: needsReview,
  };

  function defaultSetup() {
    return { lecs: QUIZ_LECS.map(l => l.id), types: Object.keys(TYPE_LABEL), filter: 'all', count: 10, shuffle: true };
  }
  function poolOf(s) {
    return QUIZ.filter(q => s.lecs.includes(q.lec) && s.types.includes(q.type) && FILTER_FN[s.filter](q));
  }

  function viewQuiz() {
    const s = Object.assign(defaultSetup(), store.setup || {});
    s.lecs = s.lecs.filter(id => LEC[id]);
    const chip = (attr, val, label, on, extra = '') => `<button class="chip" data-${attr}="${val}" aria-pressed="${on}" ${extra}>${label}</button>`;

    app.innerHTML = `
      <header class="stack-sm">
        <p class="eyebrow">퀴즈</p>
        <h1 class="page-title">문제 풀기</h1>
        <p class="muted">범위와 유형을 고르고 시작하세요. 서술형은 모범답안을 보고 스스로 채점해요.</p>
      </header>
      <section class="card">
        <div class="field"><span>범위</span><div class="chips">
          ${chip('all-lecs', 1, '전체', s.lecs.length === QUIZ_LECS.length)}
          ${QUIZ_LECS.map(l => chip('lec', l.id, `<i class="swatch" style="${zc(l.id)}"></i>${esc(l.label)}`, s.lecs.includes(l.id))).join('')}
        </div></div>
        <div class="field"><span>유형</span><div class="chips">
          ${Object.entries(TYPE_LABEL).map(([k, v]) => chip('type', k, v, s.types.includes(k))).join('')}
        </div></div>
        <div class="field"><span>문항</span><div class="chips">
          ${FILTERS.map(([k, v]) => chip('filter', k, v, s.filter === k)).join('')}
        </div></div>
        <div class="field"><span>개수</span><div class="chips">
          ${[10, 20, 0].map(n => chip('count', n, n ? `${n}문항` : '전부', s.count === n)).join('')}
          ${chip('shuffle', 1, '순서 섞기', s.shuffle)}
        </div></div>
        <button class="btn primary" id="start"></button>
      </section>`;

    const startBtn = $('#start');
    function refresh() {
      const n = poolOf(s).length;
      const take = s.count ? Math.min(s.count, n) : n;
      startBtn.textContent = n ? `${take}문항 시작` : '조건에 맞는 문항이 없어요';
      startBtn.disabled = !n;
      store.setup = s;
      persist();
    }
    function sync() {
      $$('[data-lec]').forEach(b => b.setAttribute('aria-pressed', String(s.lecs.includes(b.dataset.lec))));
      $('[data-all-lecs]').setAttribute('aria-pressed', String(s.lecs.length === QUIZ_LECS.length));
      $$('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(s.types.includes(b.dataset.type))));
      $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(s.filter === b.dataset.filter)));
      $$('[data-count]').forEach(b => b.setAttribute('aria-pressed', String(s.count === +b.dataset.count)));
      $('[data-shuffle]').setAttribute('aria-pressed', String(s.shuffle));
      refresh();
    }
    const toggleIn = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v);

    const card = $('.card', app);
    card.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.lec) s.lecs = toggleIn(s.lecs, b.dataset.lec);
      else if (b.hasAttribute('data-all-lecs')) s.lecs = s.lecs.length === QUIZ_LECS.length ? [] : QUIZ_LECS.map(l => l.id);
      else if (b.dataset.type) s.types = toggleIn(s.types, b.dataset.type);
      else if (b.dataset.filter) s.filter = b.dataset.filter;
      else if (b.dataset.count != null) s.count = +b.dataset.count;
      else if (b.hasAttribute('data-shuffle')) s.shuffle = !s.shuffle;
      else if (b.id === 'start') {
        let items = poolOf(s);
        if (s.shuffle) items = shuffle(items);
        if (s.count) items = items.slice(0, s.count);
        startSession(items, '직접 고른 문제');
        return;
      } else return;
      sync();
    });
    sync();
  }

  // ---------- quiz play ----------
  function startSession(items, title) {
    if (!items.length) return;
    session = { items, i: 0, res: [], title };
    go('play');
  }

  function viewPlay() {
    if (!session) { location.replace('#quiz'); return; }
    if (session.i >= session.items.length) { viewResult(); return; }
    const q = session.items[session.i];
    const L = LEC[q.lec];
    const n = session.items.length;
    app.innerHTML = `
      <div class="play-top">
        <div class="row"><span class="eyebrow">${esc(session.title)}</span><button class="btn ghost small" id="quit">그만하기</button></div>
        <div class="row"><div class="bar" style="flex:1"><i style="width:${Math.round(session.i / n * 100)}%"></i></div><span class="num muted">${session.i + 1} / ${n}</span></div>
      </div>
      <section class="card qcard">
        <div class="qmeta"><i class="swatch" style="${zc(q.lec)}"></i>${esc(L.label)} · ${TYPE_LABEL[q.type]} ${q.tags.map(tagHTML).join(' ')}</div>
        <div id="qbody" class="stack"></div>
        <div id="qfb" class="stack"></div>
      </section>`;
    $('#quit').addEventListener('click', () => { session.items = session.items.slice(0, session.i); viewResult(); });
    RENDER[q.type](q, $('#qbody'), res => answered(q, res));
  }

  function answered(q, res) {
    record(q.id, res);
    session.res.push({ q, res });
    session.i += 1;
    const last = session.i >= session.items.length;
    const verdict = { o: '정답', x: '오답', m: '부분 정답' }[res] + (q.type === 'essay' ? ' (스스로 채점)' : '');
    let correct = '';
    if (res !== 'o' && q.type === 'mcq') correct = `정답: ${q.choices[q.answer]}`;
    if (res !== 'o' && q.type === 'ox') correct = `정답: ${q.answer ? 'O' : 'X'}`;
    $('#qfb').innerHTML = `
      <div class="fb ${res}">
        <p class="verdict">${verdict}</p>
        ${correct ? `<p><b>${esc(correct)}</b></p>` : ''}
        ${q.explain ? `<p>${esc(q.explain)}</p>` : ''}
        <p class="muted small">${esc(LEC[q.lec].label)} ${q.page ? `<span class="pg">${esc(q.page)}</span>` : ''} · <a href="#note${q.lec}">노트 보기</a></p>
      </div>
      <button class="btn primary" id="next">${last ? '결과 보기' : '다음 문제 →'}</button>`;
    const next = $('#next');
    next.addEventListener('click', () => { window.scrollTo(0, 0); viewPlay(); });
    next.focus({ preventScroll: true });
    $('#qfb').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function answerText(q) {
    if (q.type === 'mcq') return q.choices[q.answer];
    if (q.type === 'ox') return q.answer ? 'O' : 'X';
    if (q.type === 'blank') return q.q.replace(/\{\{(\d+)\}\}/g, (_, n) => `[${(q.blanks[n - 1] || ['?'])[0]}]`);
    return q.answer;
  }

  function viewResult() {
    const done = session.res;
    const score = done.reduce((a, r) => a + (r.res === 'o' ? 1 : r.res === 'm' ? 0.5 : 0), 0);
    const pct = done.length ? Math.round(score / done.length * 100) : 0;
    const miss = done.filter(r => r.res !== 'o');
    app.innerHTML = `
      <section class="card">
        <p class="eyebrow">${esc(session.title)} · 결과</p>
        <p class="result-score num">${fmt(score, 1)} / ${done.length}</p>
        <p class="muted">정답률 ${pct}%${miss.length ? ` · 다시 볼 문항 ${miss.length}개` : done.length ? ' · 전부 맞았어요' : ''}</p>
        <div class="btn-row">
          ${miss.length ? `<button class="btn primary" id="again">틀린 ${miss.length}문항 다시 풀기</button>` : ''}
          <a class="btn" href="#quiz">새로 풀기</a>
          <a class="btn" href="#home">홈</a>
        </div>
      </section>
      ${miss.length ? `<section class="stack"><h2>다시 볼 문항</h2><ul class="review">${miss.map(({ q, res }) => `
        <li>
          <p class="qmeta"><i class="swatch" style="${zc(q.lec)}"></i>${esc(LEC[q.lec].label)} · ${TYPE_LABEL[q.type]} <span class="tag ${res === 'm' ? 'tag-sup' : 'tag-gichul'}">${res === 'm' ? '부분' : '오답'}</span></p>
          <p><b>${esc(q.q.replace(/\{\{\d+\}\}/g, '(   )'))}</b></p>
          <p class="a">${esc(answerText(q))}</p>
          <p class="muted small">${q.page ? `<span class="pg">${esc(q.page)}</span> · ` : ''}<a href="#note${q.lec}">노트 보기</a></p>
        </li>`).join('')}</ul></section>` : ''}`;
    const again = $('#again');
    if (again) again.addEventListener('click', () => startSession(shuffle(miss.map(r => r.q)), '틀린 문항 다시'));
  }

  // ---------- question renderers ----------
  function rMCQ(q, el, done) {
    const fixed = q.choices.some(c => /모두|없음|없다/.test(c));
    const order = fixed ? q.choices.map((_, i) => i) : shuffle(q.choices.map((_, i) => i));
    el.innerHTML = `<p class="qtext">${esc(q.q)}</p>
      <div class="choices">${order.map((ci, k) => `<button class="choice" data-ci="${ci}"><span class="ck">${CIRCLED[k]}</span><span>${esc(q.choices[ci])}</span></button>`).join('')}</div>`;
    $$('.choice', el).forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      $$('.choice', el).forEach(x => {
        x.disabled = true;
        if (+x.dataset.ci === q.answer) x.classList.add('is-right');
        else if (x === b) x.classList.add('is-wrong');
      });
      done(+b.dataset.ci === q.answer ? 'o' : 'x');
    }));
  }

  function rOX(q, el, done) {
    el.innerHTML = `<p class="qtext">${esc(q.q)}</p>
      <div class="ox"><button class="choice" data-v="1" aria-label="맞다 O">O</button><button class="choice" data-v="0" aria-label="틀리다 X">X</button></div>`;
    $$('.choice', el).forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      $$('.choice', el).forEach(x => {
        x.disabled = true;
        if ((x.dataset.v === '1') === !!q.answer) x.classList.add('is-right');
        else if (x === b) x.classList.add('is-wrong');
      });
      done((b.dataset.v === '1') === !!q.answer ? 'o' : 'x');
    }));
  }

  function rBlank(q, el, done) {
    const parts = q.q.split(/\{\{(\d+)\}\}/);
    const html = parts.map((p, i) => {
      if (i % 2 === 0) return esc(p);
      const acc = q.blanks[+p - 1] || [''];
      const size = Math.min(18, Math.max(4, ...acc.map(a => a.length)) + 2);
      return `<input data-n="${p}" size="${size}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="${p}번 빈칸">`;
    }).join('');
    el.innerHTML = `<p class="blank-text">${html}</p>
      <div class="btn-row" id="bact"><button class="btn primary" id="chk">채점하기</button><button class="btn" id="giveup">모르겠어요</button></div>`;
    const inputs = $$('input', el);
    inputs.forEach((inp, i) => inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i < inputs.length - 1) inputs[i + 1].focus();
      else grade(false);
    }));
    function grade(giveUp) {
      let right = 0;
      inputs.forEach(inp => {
        const acc = q.blanks[+inp.dataset.n - 1] || [];
        const v = norm(inp.value);
        const num = parseFloat(inp.value.replace(/[^\d.]/g, ''));
        const ok = !giveUp && v !== '' && acc.some(a => /^\d+(\.\d+)?$/.test(a) ? num === parseFloat(a) : norm(a) === v);
        inp.readOnly = true;
        inp.classList.add(ok ? 'ok' : 'bad');
        if (ok) right++;
        else inp.insertAdjacentHTML('afterend', `<span class="fix">→ ${esc(acc[0])}</span>`);
      });
      $('#bact', el).remove();
      done(right === inputs.length ? 'o' : right > 0 ? 'm' : 'x');
    }
    $('#chk', el).addEventListener('click', () => grade(false));
    $('#giveup', el).addEventListener('click', () => grade(true));
  }

  function rEssay(q, el, done) {
    el.innerHTML = `<p class="qtext">${esc(q.q)}</p>
      <label class="field"><span>내 답안 (안 써도 돼요)</span><textarea id="mine" placeholder="시험지에 쓰듯 핵심어 위주로 적어 보세요"></textarea></label>
      <button class="btn primary" id="reveal">모범답안 보기</button>`;
    $('#reveal', el).addEventListener('click', () => {
      const ta = $('#mine', el);
      const mine = norm(ta.value);
      const kws = q.keywords || [];
      const hits = kws.filter(k => mine && mine.includes(norm(k)));
      ta.readOnly = true;
      $('#reveal', el).remove();
      el.insertAdjacentHTML('beforeend', `
        <div class="model">${esc(q.answer)}</div>
        ${kws.length ? `<div class="kw"><span class="muted">핵심어${mine ? ` ${hits.length}/${kws.length}` : ''}</span>${kws.map(k => `<span class="k${hits.includes(k) ? ' hit' : ''}">${esc(k)}</span>`).join('')}</div>` : ''}
        <div class="self" id="self"><button class="btn" data-r="o">맞았어요</button><button class="btn" data-r="m">반쯤</button><button class="btn" data-r="x">틀렸어요</button></div>`);
      $$('#self .btn', el).forEach(b => b.addEventListener('click', () => {
        $('#self', el).remove();
        done(b.dataset.r);
      }));
    });
  }

  const RENDER = { mcq: rMCQ, ox: rOX, blank: rBlank, essay: rEssay };

  // ---------- calc practice ----------
  const REILLY = [
    { r: 0.2, k: 5 }, { r: 0.3, k: 10 }, { r: 0.4, k: 5 }, { r: 0.5, k: 2 },
    { r: 0.6, k: 5 }, { r: 0.7, k: 10 }, { r: 0.8, k: 5 }, { r: 0.9, k: 10 },
  ];
  function genReilly() {
    const { r, k } = pick(REILLY);
    const pa = pick([100, 400]);
    const pb = Math.round(r * r * pa);
    const lo = Math.ceil(8 / k), hi = Math.floor(40 / k);
    const da = k * (lo + Math.floor(Math.random() * (hi - lo + 1)));
    const dist = Math.round(da * (1 + r) * 10) / 10;
    return {
      given: [['A시 인구', `${pa}만 명`], ['B시 인구', `${pb}만 명`], ['두 도시 간 거리', `${fmt(dist, 1)} km`]],
      ask: '도시영향권의 경계는 A시로부터 몇 km 지점인가?',
      unit: 'km', answer: da, tol: 0.06,
      steps: [
        `√(P<sub>b</sub> / P<sub>a</sub>) = √(${pb} / ${pa}) = √${fmt(pb / pa, 2)} = ${r}`,
        `M<sub>ab</sub> = ${fmt(dist, 1)} ÷ (1 + ${r}) = ${fmt(dist, 1)} ÷ ${fmt(1 + r, 1)} = <b>${da} km</b>`,
        `B시로부터는 ${fmt(dist, 1)} − ${da} = ${fmt(dist - da, 1)} km`,
      ],
    };
  }

  function genLand() {
    const hh = pick([5000, 8000, 10000, 12000, 15000, 20000]);
    const size = pick([60, 70, 80, 85, 100]);
    const supply = pick([100, 105, 110, 120]);
    const far = pick([150, 200, 250, 300]);
    const pub = pick([20, 25, 30, 40]);
    const units = hh * supply / 100;
    const floor = units * size;
    const net = floor / (far / 100);
    const total = net / (1 - pub / 100);
    return {
      given: [['계획 가구수', `${hh.toLocaleString('ko-KR')} 가구`], ['평균 주택규모', `${size} ㎡`], ['목표 주택보급률', `${supply} %`], ['계획 용적률', `${far} %`], ['계획 공공용지율', `${pub} %`]],
      ask: '총주거용지 면적은 몇 ha인가? (소수 둘째 자리까지)',
      unit: 'ha', answer: total / 10000, tol: Math.max(0.02, total / 10000 * 0.005),
      steps: [
        `필요 주택 수 = ${hh.toLocaleString('ko-KR')} × ${supply / 100} = ${fmt(units, 0)}호`,
        `주택 연면적 = ${fmt(units, 0)} × ${size}㎡ = ${fmt(floor, 0)}㎡`,
        `순주거용지 = 연면적 ÷ 용적률 = ${fmt(floor, 0)} ÷ ${far / 100} = ${fmt(net, 0)}㎡`,
        `총주거용지 = 순주거용지 ÷ (1 − 공공용지율) = ${fmt(net, 0)} ÷ ${fmt(1 - pub / 100, 2)} = ${fmt(total, 0)}㎡ = <b>${fmt(total / 10000, 2)} ha</b>`,
      ],
    };
  }

  function genPop() {
    const p0 = pick([25, 40, 60, 80, 120, 150]) * 10000;
    const r = pick([0.5, 1, 1.5, 2, 2.5, 3]);
    const n = pick([5, 10, 15, 20]);
    const exp = Math.random() < 0.5;
    const factor = exp ? Math.exp(r / 100 * n) : Math.pow(1 + r / 100, n);
    const pn = p0 * factor;
    return {
      given: [['모형', exp ? '지수함수 (6강 p11)' : '등비급수 (6강 p9)'], ['기준연도 인구 P₀', `${p0.toLocaleString('ko-KR')} 명`], ['인구 증가율 r', `연 ${r} %`], ['경과연수 n', `${n} 년`]],
      ask: '목표연도 인구 Pₙ은 몇 명인가?',
      unit: '명', answer: pn, tol: pn * 0.003,
      steps: exp ? [
        `P<sub>n</sub> = P<sub>0</sub> × e<sup>rn</sup>, rn = ${r / 100} × ${n} = ${fmt(r / 100 * n, 3)}`,
        `e<sup>${fmt(r / 100 * n, 3)}</sup> = ${fmt(factor, 4)}`,
        `P<sub>n</sub> = ${p0.toLocaleString('ko-KR')} × ${fmt(factor, 4)} ≈ <b>${fmt(pn, 0)}명</b>`,
      ] : [
        `P<sub>n</sub> = P<sub>0</sub> × (1 + r)<sup>n</sup> = ${p0.toLocaleString('ko-KR')} × ${fmt(1 + r / 100, 3)}<sup>${n}</sup>`,
        `${fmt(1 + r / 100, 3)}<sup>${n}</sup> = ${fmt(factor, 4)}`,
        `P<sub>n</sub> = ${p0.toLocaleString('ko-KR')} × ${fmt(factor, 4)} ≈ <b>${fmt(pn, 0)}명</b>`,
      ],
    };
  }

  function problemCard(id, gen) {
    const wrap = document.getElementById(id);
    let p;
    function draw() {
      p = gen();
      $('.given', wrap).innerHTML = p.given.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
      $('.ask', wrap).textContent = p.ask;
      $('.unit', wrap).textContent = p.unit;
      const inp = $('input', wrap);
      inp.value = '';
      inp.readOnly = false;
      $('.out', wrap).innerHTML = '';
      $('.check', wrap).disabled = false;
    }
    function check(show) {
      const inp = $('input', wrap);
      const v = parseFloat(inp.value.replace(/,/g, ''));
      const ok = !show && Number.isFinite(v) && Math.abs(v - p.answer) <= p.tol;
      const res = show ? null : ok ? 'o' : 'x';
      $('.out', wrap).innerHTML = `
        ${res ? `<div class="fb ${res}"><p class="verdict">${ok ? '정답' : '다시 확인해 보세요'}</p></div>` : ''}
        <ol class="steps">${p.steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
      if (ok) { inp.readOnly = true; $('.check', wrap).disabled = true; }
    }
    $('.check', wrap).addEventListener('click', () => check(false));
    $('.show', wrap).addEventListener('click', () => check(true));
    $('.new', wrap).addEventListener('click', draw);
    $('input', wrap).addEventListener('keydown', e => { if (e.key === 'Enter') check(false); });
    draw();
  }

  const problemShell = id => `
    <div id="${id}" class="stack">
      <dl class="given"></dl>
      <p class="ask"></p>
      <div class="answer-line"><input inputmode="decimal" autocomplete="off" aria-label="답"><span class="unit"></span></div>
      <div class="btn-row"><button class="btn primary check">확인</button><button class="btn show">풀이 보기</button><button class="btn new">새 문제</button></div>
      <div class="out stack"></div>
    </div>`;

  function viewCalc() {
    app.innerHTML = `
      <header class="stack-sm">
        <p class="eyebrow">계산 연습</p>
        <h1 class="page-title">숫자를 바꿔 가며 풀기</h1>
        <p class="muted">기출에 나온 계산 두 가지와 6강 인구추정이에요. '새 문제'를 누를 때마다 숫자가 바뀌어요.</p>
      </header>

      <section class="card">
        <div class="row-between"><h2>도시영향권 경계</h2><span class="years"><span class="tag tag-gichul">2024</span> <span class="tag tag-gichul">2025</span></span></div>
        <p class="muted small">레일리 법칙 (6강 <span class="pg">p36~p37</span>): 도시의 흡입력은 인구에 비례하고 거리의 제곱에 반비례해요.</p>
        <div class="formula">M<sub>ab</sub> = D<sub>ab</sub> ÷ ( 1 + √(P<sub>b</sub> / P<sub>a</sub>) )</div>
        <p class="small">M<sub>ab</sub>: a에서 경계까지 거리 · D<sub>ab</sub>: 두 도시 간 거리 · P: 인구</p>
        <p class="small muted">슬라이드 예제: a 25만, b 10만, 75km → <b>a로부터 45.9km</b> · 기출 2024: A 100만, B 36만, 20km → 20 ÷ 1.6 = <b>12.5km</b> · 기출 2025: A 100만, B 64만, 36km → 36 ÷ 1.8 = <b>A로부터 20km</b></p>
        ${problemShell('p-reilly')}
      </section>

      <section class="card">
        <div class="row-between"><h2>총주거용지 면적</h2><span class="years"><span class="tag tag-gichul">2025</span></span></div>
        <div class="formula">총주거용지 = <b>가구수 × 보급률 × 주택규모</b> ÷ 용적률 ÷ (1 − 공공용지율)</div>
        <p class="small muted">7강 실습도면 p24·p27의 면적 계산식 기준이에요. 주택보급률을 곱하는 단계는 슬라이드에 없어 일반적인 풀이를 따랐어요. 기출 2025: 10,000 × 1.1 × 70 ÷ 2.0 ÷ 0.7 = <b>550,000㎡ (55ha)</b>. 보급률을 빼면 50ha예요.</p>
        ${problemShell('p-land')}
      </section>

      <section class="card">
        <div class="row-between"><h2>인구추정</h2><span class="years"><span class="tag tag-gichul">2024</span> <span class="tag tag-gichul">2025</span></span></div>
        <p class="muted small">6강 과거추세연장법과 조성법이에요. 기출에는 모형 이름 빈칸이 2년 연속 나왔어요.</p>
        <div class="tbl-wrap"><table class="plain">
          <thead><tr><th>모형</th><th>원문 식</th><th>특징</th></tr></thead>
          <tbody>
            <tr><td><b>등차급수</b> <span class="pg">p8</span></td><td class="nowrap">P<sub>n</sub> = P<sub>0</sub>(1 + rn)</td><td>안정된 인구증가율, 수도권 인근 중소도시</td></tr>
            <tr><td><b>등비급수</b> <span class="pg">p9</span></td><td class="nowrap">P<sub>n</sub> = P<sub>0</sub>(1 + r)<sup>n</sup></td><td>증가 비율이 일정, 신흥공업도시 같은 급성장도시</td></tr>
            <tr><td><b>최소제곱법</b> <span class="pg">p10</span></td><td class="nowrap">y = a + bx</td><td>대부분의 도시, 인구증감이 교차해도 적용 가능</td></tr>
            <tr><td><b>지수함수</b> <span class="pg">p11</span></td><td class="nowrap">P<sub>n</sub> = P<sub>0</sub>e<sup>rn</sup></td><td>인구가 연속적으로 변한다고 가정. <span class="tag tag-gichul">★ 기출</span> 성장 초기 급증 도시</td></tr>
            <tr><td><b>로지스틱</b> <span class="pg">p13</span></td><td class="nowrap">P<sub>n</sub> = K / (1 + e<sup>a+bn</sup>)</td><td>상한 K까지 인구 통제, 목표와 성장속도 분석. <span class="tag tag-gichul">★ 기출</span> 가장 장기적인 추세</td></tr>
            <tr><td><b>조성법 (생잔법)</b> <span class="pg">p19</span></td><td>연령별 인구 × 생존율, 출산율</td><td><span class="tag tag-gichul">★ 기출</span> 출생률·사망률 이용, 연령별 인구 예측</td></tr>
          </tbody>
        </table></div>
        <p class="small muted">p8 등차급수는 r을 '증가량'이라고 적어 놨는데, 증가량이면 식은 P<sub>n</sub> = P<sub>0</sub> + rn이 맞아요. 슬라이드 식과 설명이 서로 안 맞으니 답안에는 r의 뜻을 같이 적어 두세요.</p>
        ${problemShell('p-pop')}
        <button class="btn" data-quiz-lec="6">6강 퀴즈 풀기</button>
      </section>`;
    problemCard('p-reilly', genReilly);
    problemCard('p-land', genLand);
    problemCard('p-pop', genPop);
    bindQuickStarts(app);
  }

  // ---------- past exams ----------
  function viewExams(year) {
    const years = D.exams.map(e => String(e.year));
    const y = years.includes(year) ? year : years[0];
    const E = D.exams.find(e => String(e.year) === y);
    app.innerHTML = `
      <header class="stack-sm">
        <p class="eyebrow">기출</p>
        <h1 class="page-title">${esc(y)}년 중간고사</h1>
        <p class="muted">${esc(E.info)}</p>
        <div class="chips">${years.map(v => `<a class="chip" href="#exams${v}" aria-pressed="${v === y}">${v}</a>`).join('')}</div>
      </header>
      <section class="card">
        <div class="row-between"><span class="muted small">${E.items.length}문항</span><button class="btn ghost small" id="openall">답 모두 펼치기</button></div>
        ${E.items.map(it => `
          <div class="exam-q">
            <p class="qt"><span class="qno">${esc(it.no)}.</span>${esc(it.q)}</p>
            <details>
              <summary>답 보기</summary>
              <div class="ans">
                <div>${esc(it.a)}</div>
                <p class="src">${it.official ? '교수님 모범답안' : '노트 기반 정리 (공식 답 아님)'}${it.lec ? ` · <a href="#note${it.lec}">${esc(LEC[it.lec] ? LEC[it.lec].label : '')} 노트</a>` : ''}</p>
              </div>
            </details>
          </div>`).join('')}
      </section>`;
    $('#openall').addEventListener('click', e => {
      const all = $$('details', app);
      const open = !all.every(d => d.open);
      all.forEach(d => { d.open = open; });
      e.currentTarget.textContent = open ? '답 모두 접기' : '답 모두 펼치기';
    });
  }

  const VIEWS = { home: viewHome, notes: viewNotes, note: viewNote, quiz: viewQuiz, play: viewPlay, calc: viewCalc, exams: viewExams };
  window.addEventListener('hashchange', route);
  route();
})();
