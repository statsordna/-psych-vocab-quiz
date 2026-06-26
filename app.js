// ===== 데이터 로딩 =====
let GLOSSARY = [];
const LS_KEY_CACHE = 'glossary_cache_v1';
const LS_KEY_SYNCED = 'glossary_synced_at';

async function loadGlossary() {
  const syncBar = document.getElementById('syncBar');
  // 1) 캐시 먼저 사용 (즉시 표시)
  const cached = localStorage.getItem(LS_KEY_CACHE);
  if (cached) {
    try { GLOSSARY = JSON.parse(cached); } catch (e) {}
  }
  // 2) 네트워크에서 최신본 시도 (캐시 무력화 쿼리)
  try {
    const res = await fetch('glossary.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const fresh = await res.json();
      GLOSSARY = fresh;
      localStorage.setItem(LS_KEY_CACHE, JSON.stringify(fresh));
      localStorage.setItem(LS_KEY_SYNCED, new Date().toISOString());
    }
  } catch (e) {
    // 오프라인이면 캐시 유지
  }
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
const views = ['home', 'vocab', 'mcq', 'written'];
const titles = { home: '계량심리 용어 퀴즈', vocab: '단어장', mcq: '객관식 퀴즈', written: '주관식 퀴즈' };

function renderView(name) {
  views.forEach(v => document.getElementById('view-' + v).classList.toggle('active', v === name));
  document.getElementById('headerTitle').textContent = titles[name];
  document.getElementById('backBtn').style.visibility = name === 'home' ? 'hidden' : 'visible';
  if (name === 'vocab') renderVocabList();
  if (name === 'mcq') startMcq();
  if (name === 'written') startWritten();
}

// 화면 전환 시 히스토리에 기록 -> 안드로이드 뒤로가기를 누르면
// 앱 종료 대신 popstate가 발생해 이전 화면(초기 화면)으로 돌아감
function showView(name) {
  if (name === 'home') {
    history.pushState({ view: 'home' }, '', '#home');
  } else {
    history.pushState({ view: name }, '', '#' + name);
  }
  renderView(name);
}

window.addEventListener('popstate', (e) => {
  const name = (e.state && e.state.view) || 'home';
  renderView(name);
});

// 최초 진입 시 히스토리에 home 상태를 깔아둠 (없으면 첫 뒤로가기에서 바로 종료됨)
history.replaceState({ view: 'home' }, '', '#home');

document.getElementById('backBtn').addEventListener('click', () => history.back());
document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ===== 단어장 =====
let vocabCategoryFilter = '전체';

function renderVocabChips() {
  const cats = ['전체', ...new Set(GLOSSARY.map(g => g.category).filter(Boolean))];
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
  renderVocabChips();
  const q = (document.getElementById('vocabSearch').value || '').trim().toLowerCase();
  const list = document.getElementById('vocabList');
  const filtered = GLOSSARY.filter(g => {
    const inCat = vocabCategoryFilter === '전체' || g.category === vocabCategoryFilter;
    if (!inCat) return false;
    if (!q) return true;
    return (g.en + ' ' + g.kr + ' ' + g.def).toLowerCase().includes(q);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }
  list.innerHTML = filtered.map(g => `
    <div class="vocab-card">
      <div class="en">${escapeHtml(g.en)} ${g.star ? '<span class="star">★</span>' : ''}</div>
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
let mcqQueue = [], mcqIndex = 0, mcqCorrectCount = 0, mcqAnswered = false;

function startMcq() {
  if (!GLOSSARY.length) return;
  mcqQueue = shuffle(GLOSSARY);
  mcqIndex = 0; mcqCorrectCount = 0;
  document.getElementById('mcqNextBtn').style.display = 'none';
  nextMcq();
}

function nextMcq() {
  if (mcqIndex >= mcqQueue.length) { mcqQueue = shuffle(GLOSSARY); mcqIndex = 0; }
  const correct = mcqQueue[mcqIndex];
  const distractors = shuffle(GLOSSARY.filter(g => g.kr !== correct.kr)).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  mcqAnswered = false;

  document.getElementById('mcqProgress').textContent = `${mcqIndex + 1} / ${mcqQueue.length}`;
  document.getElementById('mcqScore').textContent = `정답 ${mcqCorrectCount}개`;
  document.getElementById('mcqTerm').textContent = correct.en;
  document.getElementById('mcqNextBtn').style.display = 'none';

  const optWrap = document.getElementById('mcqOptions');
  optWrap.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.kr;
    btn.onclick = () => {
      if (mcqAnswered) return;
      mcqAnswered = true;
      const isRight = opt.kr === correct.kr;
      if (isRight) { btn.classList.add('correct'); mcqCorrectCount++; }
      else {
        btn.classList.add('wrong');
        [...optWrap.children].find(b => b.textContent === correct.kr)?.classList.add('correct');
      }
      [...optWrap.children].forEach(b => b.disabled = true);
      document.getElementById('mcqScore').textContent = `정답 ${mcqCorrectCount}개`;
      document.getElementById('mcqNextBtn').style.display = 'block';
    };
    optWrap.appendChild(btn);
  });
}
document.getElementById('mcqNextBtn').addEventListener('click', () => { mcqIndex++; nextMcq(); });

// ===== 주관식 퀴즈 (유사도 채점) =====
let wrQueue = [], wrIndex = 0, wrCorrectCount = 0, wrRetrying = false, wrFirstAttemptText = '';

function startWritten() {
  if (!GLOSSARY.length) return;
  wrQueue = shuffle(GLOSSARY);
  wrIndex = 0; wrCorrectCount = 0;
  nextWritten();
}

function nextWritten() {
  if (wrIndex >= wrQueue.length) { wrQueue = shuffle(GLOSSARY); wrIndex = 0; }
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

// 한국어/영어 혼용 텍스트에서 의미 토큰 추출 (조사 등 1글자 토큰 제거)
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[.,·()'"“”‘’\-/\\\[\]{}:;!?]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

// Jaccard 유사도 기반 채점: 정답 토큰 중 사용자 답변에 포함된 비율(recall) 중심
function scoreAnswer(userText, correctText) {
  const userTokens = new Set(tokenize(userText));
  const correctTokens = new Set(tokenize(correctText));
  if (correctTokens.size === 0) return 0;
  let hit = 0;
  correctTokens.forEach(t => {
    if (userTokens.has(t)) hit++;
    else {
      // 부분 포함(어간 일부 일치) 허용
      for (const u of userTokens) {
        if (u.length >= 2 && (t.includes(u) || u.includes(t))) { hit++; break; }
      }
    }
  });
  return hit / correctTokens.size;
}

const SCORE_CORRECT = 0.45;
const SCORE_RETRY = 0.2;

document.getElementById('wrSubmitBtn').addEventListener('click', () => {
  const item = wrQueue[wrIndex];
  const ansEl = document.getElementById('wrAnswer');
  const userText = ansEl.value.trim();
  const fb = document.getElementById('wrFeedback');

  if (!userText) { ansEl.focus(); return; }

  if (!wrRetrying) {
    const score = scoreAnswer(userText, item.def);
    if (score >= SCORE_CORRECT) {
      finishWritten(true, item);
    } else if (score >= SCORE_RETRY) {
      wrRetrying = true;
      wrFirstAttemptText = userText;
      fb.innerHTML = `<div class="feedback retry">조금 더 구체적으로 설명해 보세요. 핵심 키워드를 더 포함시켜 보세요.</div>`;
      ansEl.value = '';
      ansEl.focus();
    } else {
      finishWritten(false, item);
    }
  } else {
    // 재시도: 두 답변을 합쳐서 누적 평가
    const combined = wrFirstAttemptText + ' ' + userText;
    const score = scoreAnswer(combined, item.def);
    finishWritten(score >= SCORE_CORRECT, item);
  }
});

function finishWritten(isCorrect, item) {
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
  }
}

document.getElementById('wrNextBtn').addEventListener('click', () => { wrIndex++; nextWritten(); });

// ===== 초기화 =====
loadGlossary();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
