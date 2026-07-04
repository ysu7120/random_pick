"use strict";

/* ===== 뽑기 구성 (guide.md 기준) ===== */
const TOTAL = 100;
const PRIZES = [
  { rank: 1, count: 2 },
  { rank: 2, count: 10 },
  { rank: 3, count: 15 },
  { rank: 4, count: 30 },
  { rank: 5, count: 43 },
]; // 합계 = 100, 꽝 없음

/* ===== DOM 참조 ===== */
const gridEl = document.getElementById("grid");
const resetBtn = document.getElementById("resetBtn");

const modalEl = document.getElementById("modal");
const dialogEl = document.getElementById("dialog");
const giftEl = document.getElementById("gift");
const confettiEl = document.getElementById("confetti");
const resultEl = document.getElementById("result");
const modalCongratsEl = document.getElementById("modalCongrats");
const modalRankEl = document.getElementById("modalRank");
const modalPrizeEl = document.getElementById("modalPrize");
const nextBtn = document.getElementById("nextBtn");

/* ===== 상태 ===== */
let deck = [];            // 인덱스 = 칸 위치, 값 = 등수
let opened = [];          // 인덱스별 개봉 여부(boolean)
let remaining = {};       // { rank: 남은 개수 }
let openedCount = 0;
let modalOpen = false;    // 모달 표시 중에는 다른 칸 클릭 무시
let revealTimer = null;
let redTimer = null;      // 1등 붉은빛 연출 타이머

const STORAGE_KEY = "luckyDraw:v1";

/* ===== 상태 저장 / 복원 (localStorage) ===== */
function saveState() {
  try {
    const prizes = {};
    PRIZES.forEach(({ rank }) => {
      const el = document.getElementById(`prize-${rank}`);
      prizes[rank] = el ? el.value : "";
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deck, opened, prizes }));
  } catch (e) {
    /* 저장 불가(프라이빗 모드 등) 시 조용히 무시 */
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.deck) || data.deck.length !== TOTAL) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function restorePrizes(prizes) {
  if (!prizes) return;
  PRIZES.forEach(({ rank }) => {
    const el = document.getElementById(`prize-${rank}`);
    if (el && typeof prizes[rank] === "string") el.value = prizes[rank];
  });
}

/* 복원된 opened 기준으로 남은 개수/개봉 수 재계산 */
function recomputeRemaining() {
  initRemaining();
  openedCount = 0;
  deck.forEach((rank, idx) => {
    if (opened[idx]) {
      remaining[rank] = Math.max(0, remaining[rank] - 1);
      openedCount++;
    }
  });
}

/* ===== 유틸: Fisher-Yates 셔플 ===== */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ===== 등수 배열 생성 + 개수 검증 ===== */
function buildDeck() {
  const cards = [];
  PRIZES.forEach(({ rank, count }) => {
    for (let i = 0; i < count; i++) cards.push(rank);
  });
  if (cards.length !== TOTAL) {
    throw new Error(`뽑기 개수 오류: ${cards.length} (기대값 ${TOTAL})`);
  }
  return shuffle(cards);
}

/* ===== 남은 개수 초기화 / 표시 ===== */
function initRemaining() {
  remaining = {};
  PRIZES.forEach(({ rank, count }) => (remaining[rank] = count));
}
function renderCounts() {
  PRIZES.forEach(({ rank }) => {
    const el = document.getElementById(`count-${rank}`);
    if (el) el.textContent = remaining[rank];
  });
}

/* ===== 그리드 렌더링 ===== */
function renderGrid() {
  gridEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  deck.forEach((rank, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.rank = rank;
    btn.dataset.index = idx;
    if (opened[idx]) {
      // 이전에 개봉한 칸 복원
      btn.classList.add("card--opened", `rank-${rank}`);
      btn.textContent = `${rank}등`;
      btn.setAttribute("aria-label", `${rank}등 당첨`);
    } else {
      btn.textContent = "🍀";
      btn.setAttribute("aria-label", `${idx + 1}번 뽑기 (미개봉)`);
    }
    frag.appendChild(btn);
  });
  gridEl.appendChild(frag);
}

/* ===== 카드 클릭 처리 ===== */
function openCard(btn) {
  if (modalOpen) return;                              // 모달 중 클릭 무시
  if (btn.classList.contains("card--opened")) return; // 중복 차감 방지

  const rank = Number(btn.dataset.rank);
  const idx = Number(btn.dataset.index);

  // 카드 상태 갱신
  btn.classList.add("card--opened", `rank-${rank}`);
  btn.textContent = `${rank}등`;
  btn.setAttribute("aria-label", `${rank}등 당첨`);
  opened[idx] = true;

  // 남은 개수 1 감소 (0 미만 방지)
  remaining[rank] = Math.max(0, remaining[rank] - 1);
  renderCounts();
  openedCount++;

  saveState(); // 개봉 상태 저장

  // 결과 모달 열기
  showModal(rank);
}

/* ===== 종이 폭죽 생성 ===== */
function launchConfetti(special) {
  confettiEl.innerHTML = "";
  const count = special ? 90 : 45;
  const spread = special ? 260 : 180;
  const colors = special
    ? ["#ffd700", "#ffec99", "#ffa94d", "#ff6b6b", "#ffffff", "#ffb703"]
    : ["#f06595", "#845ef7", "#4dabf7", "#51cf66", "#ffd43b", "#ff8787"];

  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "confetti-piece";
    const x = (Math.random() * 2 - 1) * spread;      // 좌우 퍼짐
    const y = -(Math.random() * 160 + 120);          // 위로 튀어오름
    const r = Math.random() * 720 - 360;             // 회전
    p.style.setProperty("--x", `${x}px`);
    p.style.setProperty("--y", `${y}px`);
    p.style.setProperty("--r", `${r}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    p.style.animationDuration = `${1.6 + Math.random() * 1.0}s`;
    if (Math.random() > 0.5) p.style.borderRadius = "50%";
    frag.appendChild(p);
  }
  confettiEl.appendChild(frag);
}

/* ===== 모달: 뽑기 여는 애니메이션 ===== */
function showModal(rank) {
  modalOpen = true;
  const special = rank <= 2; // 1·2등 특별 연출

  // 상품명 (입력값이 없으면 문구 표시)
  const prizeInput = document.getElementById(`prize-${rank}`);
  const prizeName = prizeInput ? prizeInput.value.trim() : "";
  modalCongratsEl.textContent = special ? "🎉 특별 당첨! 🎉" : "축하합니다!";
  modalRankEl.textContent = `${rank}등`;
  modalPrizeEl.textContent = prizeName ? `🎁 ${prizeName}` : "";

  // 초기 상태로 리셋
  giftEl.hidden = false;
  giftEl.classList.remove("open", "gift--special", "gift--gone", "shake", "gift--shake-strong");
  giftEl.classList.add("shake");
  if (special) giftEl.classList.add("gift--special");
  dialogEl.classList.remove("modal__dialog--special", "modal__dialog--special-red");
  if (special) dialogEl.classList.add("modal__dialog--special");
  resultEl.classList.toggle("result--special", special);
  resultEl.hidden = true;
  resultEl.classList.remove("show");
  nextBtn.hidden = true;
  confettiEl.innerHTML = "";

  modalEl.hidden = false;

  // 잠시 흔들다가 열림 (너무 빠르지 않게 ~1.4초, 특별은 조금 더 긴 기대감)
  clearTimeout(revealTimer);
  clearTimeout(redTimer);
  revealTimer = setTimeout(() => {
    if (rank === 1) {
      // 1등: 흔들리는 중 붉은빛으로 전환 + 1초간 더 강하게 흔들고 열림
      dialogEl.classList.remove("modal__dialog--special");
      dialogEl.classList.add("modal__dialog--special-red");
      giftEl.classList.add("gift--shake-strong");
      redTimer = setTimeout(() => openGift(rank, special), 1000);
    } else {
      openGift(rank, special);
    }
  }, special ? 1700 : 1400);
}

/* ===== 선물상자 열기 → 상자 제거 → 결과 표시 ===== */
function openGift(rank, special) {
  giftEl.classList.remove("shake", "gift--shake-strong");
  giftEl.classList.add("open");
  launchConfetti(special); // 뚜껑 열릴 때 폭죽

  // 열림 모션 후 상자를 제거하고 → 등수/축하메시지 표시
  setTimeout(() => {
    giftEl.classList.add("gift--gone");
    setTimeout(() => {
      giftEl.hidden = true;
      resultEl.hidden = false;
      requestAnimationFrame(() => resultEl.classList.add("show"));
      nextBtn.hidden = false;
      nextBtn.focus();
    }, 350);
  }, 750);
}

/* ===== 모달 닫기 (다음 뽑기 버튼으로만) ===== */
function closeModal() {
  clearTimeout(revealTimer);
  clearTimeout(redTimer);
  modalEl.hidden = true;
  confettiEl.innerHTML = "";
  dialogEl.classList.remove("modal__dialog--special", "modal__dialog--special-red");
  giftEl.classList.remove("open", "gift--special", "gift--gone", "shake", "gift--shake-strong");
  modalOpen = false;
}

/* ===== 새 판 시작 (상품명은 유지) ===== */
function startNewBoard() {
  deck = buildDeck();
  opened = new Array(TOTAL).fill(false);
  initRemaining();
  openedCount = 0;
  renderGrid();
  renderCounts();
  saveState();
}

/* ===== 초기 실행: 저장된 상태가 있으면 복원, 없으면 새 판 ===== */
function init() {
  const saved = loadState();
  if (saved) {
    deck = saved.deck;
    opened = Array.isArray(saved.opened) ? saved.opened.slice(0, TOTAL) : [];
    while (opened.length < TOTAL) opened.push(false); // 길이 보정
    restorePrizes(saved.prizes);
    recomputeRemaining();
    renderGrid();
    renderCounts();
  } else {
    startNewBoard();
  }
}

/* ===== 이벤트 바인딩 ===== */
gridEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".card");
  if (btn) openCard(btn);
});
nextBtn.addEventListener("click", closeModal);
resetBtn.addEventListener("click", () => {
  if (modalOpen) return; // 모달 중엔 리셋 금지
  startNewBoard();       // 재셔플·개봉 초기화 (상품명은 유지)
});
// 상품명 입력 시 저장
document.querySelectorAll(".prize-row__input").forEach((el) => {
  el.addEventListener("input", saveState);
});

/* ===== 초기 실행 ===== */
init();
