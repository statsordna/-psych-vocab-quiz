// ===== 데이터 로딩 =====
let GLOSSARY = [];
const LS_KEY_CACHE = 'glossary_cache_v1';
const LS_KEY_SYNCED = 'glossary_synced_at';
const LS_KEY_BOOKMARKS = 'psych_bookmarks_v1';

async function loadGlossary() {
  const cached = localStorage.getItem(LS_KEY_CACHE);
  if (cached) {
    try { GLOSSARY = JSON.parse(cached); } catch (e) {}
  }
  try {
    const res = await fetch('glossary.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const fresh = await res.json();
      GLOSSARY = fresh;
      localStorage.setItem(LS_KEY_CACHE, JSON.stringify(fresh));
      localStorage.setItem(LS_KEY_SYNCED, new Date().toISOString());
    }
  } catch (e) {}
  renderSyncBar();
  if (document.getElementById('view-vocab').classList.contains('active')) renderVocabList();
}

function renderSyncBar() {
  const syncBar = document.getElementById('syncBar');
  const synced = localStorage.getItem(LS_KEY_SYNCED);
  const count = GLOSSARY.length;
  if (!count) {
    syncBar.textContent = '용어를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';
    return;
  }
  const when = synced ? new Date(synced).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '오프라인 캐시';
  syncBar.innerHTML = `용어 ${count}개 · 마지막 업데이트: ${when} &nbsp; <button id="manualSync">새로고침</button>`;
  document.getElementById('manualSync').onclick = loadGlossary;
}

// ===== 화면 전환 =====
const views = ['home', 'vocab', 'mcq', 'written', 'changelog'];
const titles = { home: '계량심리 용어 퀴즈', vocab: '단어장', mcq: '객관식 퀴즈', written: '주관식 퀴즈', changelog: '업데이트 로그' };

function renderView(name) {
  views.forEach(v => document.getElementById('view-' + v).classList.toggle('active', v === name));
  document.getElementById('headerTitle').textContent = titles[name];
  document.getElementById('backBtn').style.visibility = name === 'home' ? 'hidden' : 'visible';
  if (name === 'vocab') renderVocabList();
  if (name === 'mcq') showMcqSetup();
  if (name === 'written') showWrittenSetup();
  if (name === 'changelog') renderChangelog();
}

function showSubSection(viewName, activeId) {
  document.querySelectorAll('#view-' + viewName + ' .sub-section')
    .forEach(el => el.classList.toggle('active', el.id === activeId));
}

function renderCountChips(elId, onPick) {
  const el = document.getElementById(elId);
  if (!el) return;
  const total = GLOSSARY.length;
  const presets = [10, 20, 30].filter(c => c < total);
  el.innerHTML = '';
  presets.forEach(c => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = c + '개';
    chip.onclick = () => onPick(c);
    el.appendChild(chip);
  });
  const allChip = document.createElement('button');
  allChip.className = 'chip';
  allChip.textContent = `전체(${total}개)`;
  allChip.onclick = () => onPick(total);
  el.appendChild(allChip);
}

function showView(name) {
  history.pushState({ view: name }, '', '#' + name);
  renderView(name);
}

window.addEventListener('popstate', (e) => {
  const name = (e.state && e.state.view) || 'home';
  renderView(name);
});

history.replaceState({ view: 'home' }, '', '#home');

document.getElementById('backBtn').addEventListener('click', () => history.back());
document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ===== 북마크 =====
function getBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY_BOOKMARKS) || '[]')); } catch { return new Set(); }
}
function saveBookmarks(set) {
  localStorage.setItem(LS_KEY_BOOKMARKS, JSON.stringify([...set]));
}
function toggleBookmark(en) {
  const bm = getBookmarks();
  if (bm.has(en)) bm.delete(en); else bm.add(en);
  saveBookmarks(bm);
  renderVocabList();
}

// ===== 단어장 =====
let vocabCategoryFilter = '전체';
let vocabSortMode = 'default';

function getCharType(str) {
  const ch = (str || '').charAt(0);
  if (/[가-힣]/.test(ch)) return 0;
  if (/[a-zA-Z]/.test(ch)) return 1;
  return 2;
}

function renderVocabSortChips() {
  const el = document.getElementById('vocabSortChips');
  if (!el) return;
  el.innerHTML = '';
  [['default', '기본'], ['alpha', '가나다순']].forEach(([mode, label]) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (vocabSortMode === mode ? ' active' : '');
    chip.textContent = label;
    chip.onclick = () => { vocabSortMode = mode; renderVocabList(); };
    el.appendChild(chip);
  });
}

function renderVocabChips() {
  const cats = ['전체', '북마크', ...new Set(GLOSSARY.map(g => g.category).filter(Boolean))];
  const chipsEl = document.getElementById('vocabChips');
  chipsEl.innerHTML = '';
  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (cat === vocabCategoryFilter ? ' active' : '');
    chip.textContent = cat;
    chip.onclick = () => { vocabCategoryFilter = cat; renderVocabList(); };
    chipsEl.appendChild(chip);
  });
}

function renderVocabList() {
  if (!GLOSSARY.length) return;
  renderVocabSortChips();
  renderVocabChips();

  const q = (document.getElementById('vocabSearch').value || '').trim().toLowerCase();
  const bm = getBookmarks();

  let filtered = GLOSSARY.filter(g => {
    if (vocabCategoryFilter === '북마크') {
      if (!bm.has(g.en)) return false;
      return !q || (g.en + ' ' + g.kr + ' ' + g.def).toLowerCase().includes(q);
    }
    const inCat = vocabCategoryFilter === '전체' || g.category === vocabCategoryFilter;
    if (!inCat) return false;
    return !q || (g.en + ' ' + g.kr + ' ' + g.def).toLowerCase().includes(q);
  });

  if (vocabSortMode === 'alpha') {
    filtered = [...filtered].sort((a, b) => {
      const at = getCharType(a.kr), bt = getCharType(b.kr);
      if (at !== bt) return at - bt;
      return (a.kr || '').localeCompare(b.kr || '', 'ko');
    });
  }

  const list = document.getElementById('vocabList');
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }
  list.innerHTML = filtered.map(g => `
    <div class="vocab-card">
      <div class="en">${escapeHtml(g.en)}${g.star ? ' <span class="star">★</span>' : ''}<button class="bookmark-btn${bm.has(g.en) ? ' bookmarked' : ''}" onclick="toggleBookmark(${JSON.stringify(g.en)})">🔖</button></div>
      <div class="kr">${escapeHtml(g.kr)}</div>
      <div class="def">${escapeHtml(g.def)}</div>
      <div class="meta">${escapeHtml(g.category || '')} · ${escapeHtml(g.section || '')}${g.trend ? ' · ☀️ 트렌드' : ''}</div>
    </div>
  `).join('');
}
document.getElementById('vocabSearch').addEventListener('input', renderVocabList);

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 유틸: 셔플 =====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== 객관식 퀴즈 =====
let mcqQueue = [], mcqIndex = 0, mcqCorrectCount = 0, mcqAnswered = false, mcqWrongList = [];
let mcqMode = 'en'; // 'en': 영문→설명, 'kr': 국문→설명

function renderMcqModeChips() {
  const el = document.getElementById('mcqModeChips');
  if (!el) return;
  el.innerHTML = '';
  [['en', '영문 보고 설명 고르기'], ['kr', '국문 보고 설명 고르기']].forEach(([mode, label]) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (mcqMode === mode ? ' active' : '');
    chip.textContent = label;
    chip.onclick = () => { mcqMode = mode; renderMcqModeChips(); };
    el.appendChild(chip);
  });
}

function showMcqSetup() {
  if (!GLOSSARY.length) return;
  showSubSection('mcq', 'mcqSetup');
  document.getElementById('mcqCountInput').value = '';
  renderMcqModeChips();
  renderCountChips('mcqCountChips', n => beginMcqQuiz(n));
}

document.getElementById('mcqStartBtn').addEventListener('click', () => {
  const v = parseInt(document.getElementById('mcqCountInput').value, 10);
  const n = (v && v > 0) ? Math.min(v, GLOSSARY.length) : 10;
  beginMcqQuiz(n);
});

function beginMcqQuiz(n) {
  showSubSection('mcq', 'mcqQuiz');
  mcqQueue = shuffle(GLOSSARY).slice(0, Math.min(n, GLOSSARY.length));
  mcqIndex = 0; mcqCorrectCount = 0; mcqWrongList = [];
  document.getElementById('mcqNextBtn').style.display = 'none';
  nextMcq();
}

function nextMcq() {
  const correct = mcqQueue[mcqIndex];
  const distractors = shuffle(GLOSSARY.filter(g => g.def !== correct.def)).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  mcqAnswered = false;

  document.getElementById('mcqProgress').textContent = `${mcqIndex + 1} / ${mcqQueue.length}`;
  document.getElementById('mcqScore').textContent = `정답 ${mcqCorrectCount}개`;
  document.getElementById('mcqTerm').textContent = mcqMode === 'en' ? correct.en : correct.kr;
  document.getElementById('mcqSubPrompt').textContent = mcqMode === 'en' ? '이 영단어의 알맞은 설명은?' : '이 국문 용어의 알맞은 설명은?';
  document.getElementById('mcqNextBtn').style.display = 'none';

  const optWrap = document.getElementById('mcqOptions');
  optWrap.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.def;
    btn.onclick = () => {
      if (mcqAnswered) return;
      mcqAnswered = true;
      const isRight = opt.def === correct.def;
      if (isRight) { btn.classList.add('correct'); mcqCorrectCount++; }
      else {
        btn.classList.add('wrong');
        [...optWrap.children].find(b => b.textContent === correct.def)?.classList.add('correct');
        mcqWrongList.push({ en: correct.en, kr: correct.kr, def: correct.def, yourDef: opt.def });
      }
      [...optWrap.children].forEach(b => b.disabled = true);
      document.getElementById('mcqScore').textContent = `정답 ${mcqCorrectCount}개`;
      document.getElementById('mcqNextBtn').style.display = 'block';
    };
    optWrap.appendChild(btn);
  });
}

document.getElementById('mcqNextBtn').addEventListener('click', () => {
  mcqIndex++;
  if (mcqIndex >= mcqQueue.length) showMcqResult();
  else nextMcq();
});

function showMcqResult() {
  showSubSection('mcq', 'mcqResult');
  const total = mcqQueue.length;
  const score = Math.round((mcqCorrectCount / total) * 100);
  let html = `
    <div class="result-summary">
      <div class="result-score">${mcqCorrectCount} / ${total}</div>
      <div class="result-sub">${score}점</div>
    </div>`;
  if (mcqWrongList.length) {
    html += `<div class="result-wrong-title">틀린 문제 (${mcqWrongList.length}개)</div>`;
    html += mcqWrongList.map(w => `
      <div class="wrong-card">
        <div class="en">${escapeHtml(w.en)}</div>
        <div class="kr">${escapeHtml(w.kr)}</div>
        <div class="your">내 선택: ${escapeHtml(w.yourDef)}</div>
        <div class="correct-line">정답: ${escapeHtml(w.def)}</div>
      </div>`).join('');
  }
  html += `
    <button class="primary-btn" id="mcqRetryBtn">다시 풀기</button>
    <button class="secondary-btn" id="mcqHomeBtn">처음으로</button>`;
  document.getElementById('mcqResult').innerHTML = html;
  document.getElementById('mcqRetryBtn').onclick = showMcqSetup;
  document.getElementById('mcqHomeBtn').onclick = () => showView('home');
}

// ===== 주관식 퀴즈 (키워드 기반 채점) =====
let wrQueue = [], wrIndex = 0, wrCorrectCount = 0, wrRetrying = false, wrFirstAttemptText = '', wrWrongList = [];

function showWrittenSetup() {
  if (!GLOSSARY.length) return;
  showSubSection('written', 'wrSetup');
  document.getElementById('wrCountInput').value = '';
  renderCountChips('wrCountChips', n => beginWrittenQuiz(n));
}

document.getElementById('wrStartBtn').addEventListener('click', () => {
  const v = parseInt(document.getElementById('wrCountInput').value, 10);
  const n = (v && v > 0) ? Math.min(v, GLOSSARY.length) : 10;
  beginWrittenQuiz(n);
});

function beginWrittenQuiz(n) {
  showSubSection('written', 'wrQuiz');
  wrQueue = shuffle(GLOSSARY).slice(0, Math.min(n, GLOSSARY.length));
  wrIndex = 0; wrCorrectCount = 0; wrWrongList = [];
  nextWritten();
}

function nextWritten() {
  const item = wrQueue[wrIndex];
  wrRetrying = false; wrFirstAttemptText = '';

  document.getElementById('wrProgress').textContent = `${wrIndex + 1} / ${wrQueue.length}`;
  document.getElementById('wrScore').textContent = `정답 ${wrCorrectCount}개`;
  document.getElementById('wrCategory').textContent = item.category || '';
  document.getElementById('wrTerm').textContent = item.en;
  document.getElementById('wrKr').textContent = item.kr;
  const ans = document.getElementById('wrAnswer');
  ans.value = ''; ans.disabled = false;
  document.getElementById('wrFeedback').innerHTML = '';
  document.getElementById('wrSubmitBtn').style.display = 'block';
  document.getElementById('wrSubmitBtn').textContent = '제출';
  document.getElementById('wrNextBtn').style.display = 'none';
  ans.focus();
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[.,·()'"""''\-/\\\[\]{}:;!?]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

// 핵심 키워드: 길이 3 이상인 토큰 (없으면 전체 사용)
function extractKeyTokens(text) {
  const all = tokenize(text);
  const keys = all.filter(t => t.length >= 3);
  return keys.length > 0 ? keys : all;
}

function scoreAnswer(userText, correctText) {
  const userTokens = new Set(tokenize(userText));
  const keys = extractKeyTokens(correctText);
  if (keys.length === 0) return 0;
  let hit = 0;
  keys.forEach(t => {
    if (userTokens.has(t)) { hit++; return; }
    for (const u of userTokens) {
      if (u.length >= 2 && (t.includes(u) || u.includes(t))) { hit++; return; }
    }
  });
  return hit / keys.length;
}

const SCORE_CORRECT = 0.35;
const SCORE_RETRY = 0.15;

document.getElementById('wrSubmitBtn').addEventListener('click', () => {
  const item = wrQueue[wrIndex];
  const ansEl = document.getElementById('wrAnswer');
  const userText = ansEl.value.trim();
  const fb = document.getElementById('wrFeedback');

  if (!userText) { ansEl.focus(); return; }

  if (!wrRetrying) {
    const score = scoreAnswer(userText, item.def);
    if (score >= SCORE_CORRECT) {
      finishWritten(true, item, userText);
    } else if (score >= SCORE_RETRY) {
      wrRetrying = true;
      wrFirstAttemptText = userText;
      fb.innerHTML = `<div class="feedback retry">핵심 키워드를 좀 더 포함해서 다시 설명해 보세요.</div>`;
      ansEl.value = '';
      ansEl.focus();
    } else {
      finishWritten(false, item, userText);
    }
  } else {
    const combined = wrFirstAttemptText + ' ' + userText;
    const score = scoreAnswer(combined, item.def);
    finishWritten(score >= SCORE_CORRECT, item, combined);
  }
});

function finishWritten(isCorrect, item, userText) {
  const fb = document.getElementById('wrFeedback');
  document.getElementById('wrAnswer').disabled = true;
  document.getElementById('wrSubmitBtn').style.display = 'none';
  document.getElementById('wrNextBtn').style.display = 'block';
  if (isCorrect) {
    wrCorrectCount++;
    document.getElementById('wrScore').textContent = `정답 ${wrCorrectCount}개`;
    fb.innerHTML = `<div class="feedback correct">정답입니다! 🎉<div class="answer-line">${escapeHtml(item.def)}</div></div>`;
  } else {
    fb.innerHTML = `<div class="feedback wrong">오답입니다.<div class="answer-line">정답: ${escapeHtml(item.def)}</div></div>`;
    wrWrongList.push({ en: item.en, kr: item.kr, def: item.def, yourAnswer: userText });
  }
}

document.getElementById('wrNextBtn').addEventListener('click', () => {
  wrIndex++;
  if (wrIndex >= wrQueue.length) showWrittenResult();
  else nextWritten();
});

function showWrittenResult() {
  showSubSection('written', 'wrResult');
  const total = wrQueue.length;
  const score = Math.round((wrCorrectCount / total) * 100);
  let html = `
    <div class="result-summary">
      <div class="result-score">${wrCorrectCount} / ${total}</div>
      <div class="result-sub">${score}점</div>
    </div>`;
  if (wrWrongList.length) {
    html += `<div class="result-wrong-title">틀린 문제 (${wrWrongList.length}개)</div>`;
    html += wrWrongList.map(w => `
      <div class="wrong-card">
        <div class="en">${escapeHtml(w.en)}</div>
        <div class="kr">${escapeHtml(w.kr)}</div>
        <div class="your">내 답: ${escapeHtml(w.yourAnswer) || '(미입력)'}</div>
        <div class="def">정답: ${escapeHtml(w.def)}</div>
      </div>`).join('');
  }
  html += `
    <button class="primary-btn" id="wrRetryBtn">다시 풀기</button>
    <button class="secondary-btn" id="wrHomeBtn">처음으로</button>`;
  document.getElementById('wrResult').innerHTML = html;
  document.getElementById('wrRetryBtn').onclick = showWrittenSetup;
  document.getElementById('wrHomeBtn').onclick = () => showView('home');
}

// ===== 업데이트 로그 =====
const CHANGELOG = [
  {
    date: '2026-06-30',
    items: [
      '단어장: 가나다순 정렬 옵션 추가 (한글 → 영문 → 숫자 순)',
      '단어장: 북마크 기능 추가 — 카드의 🔖 버튼으로 즐겨찾기 등록, 필터 칩의 "북마크"에서 모아보기',
      '객관식 퀴즈: 국문 용어 고르기 → 용어 설명 고르기 형식으로 변경, 영문/국문 보고 설명 고르기 모드 선택 가능',
      '주관식 퀴즈: 핵심 키워드 기반 채점으로 완화 — 설명의 핵심 단어가 포함되면 정답 처리',
      '업데이트 로그 메뉴 추가',
    ]
  }
];

function renderChangelog() {
  const el = document.getElementById('changelogList');
  if (!el) return;
  el.innerHTML = CHANGELOG.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-date">${escapeHtml(entry.date)}</div>
      <ul class="changelog-items">
        ${entry.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// ===== 초기화 =====
loadGlossary();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
    // 새 서비스 워커가 활성화되면 앱을 자동 갱신
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') location.reload();
    });
  });
}
