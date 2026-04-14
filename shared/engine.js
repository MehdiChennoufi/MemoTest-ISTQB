/* ═══════════════════════════════════════
   MEMOTEST ENGINE (v1.0 - Generic)
   Handles Rendering, Quiz, and Glossary
═══════════════════════════════════════ */

let currentCert = {};
let bos = [];
let chapters = [];
let quizData = [];
let glossaryData = {};

let state = {
  currentPage: "home",
  quizIndex: 0,
  quizAnswered: false,
  quizSelected: null,
  quizCorrect: 0,
  quizWrong: 0,
  timerInterval: null,
  timerSeconds: 30 * 60,
  timerStartSeconds: 30 * 60,
  totalAnswered: 0,
  bestScore: null,
};

function formatMarkdown(text) {
  if (!text) return "";

  // 1. Bold: **text** -> <strong>text</strong>
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 2. Handle lists and newlines
  const lines = html.split("\n");
  let result = [];
  let currentListType = null; // null, 'ul', 'ol'

  function closeList() {
    if (currentListType) {
      result.push(`</${currentListType}>`);
      currentListType = null;
    }
  }

  for (let line of lines) {
    let trimmed = line.trim();

    // Unordered list: * or -
    if (/^[\*\-]\s+/.test(trimmed)) {
      if (currentListType !== "ul") {
        closeList();
        result.push('<ul class="content-list">');
        currentListType = "ul";
      }
      result.push(`<li>${trimmed.replace(/^[\*\-]\s+/, "")}</li>`);
    }
    // Ordered list: 1. or 1)
    else if (/^\d+[\.\)]\s+/.test(trimmed)) {
      if (currentListType !== "ol") {
        closeList();
        result.push('<ol class="content-list">');
        currentListType = "ol";
      }
      let content = trimmed.replace(/^\d+[\.\)]\s+/, "");
      result.push(`<li>${content}</li>`);
    }
    // Normal line
    else {
      closeList();
      if (trimmed) {
        result.push(trimmed + "<br>");
      }
    }
  }
  closeList();

  return result.join("");
}

/**
 * Initialization: Data loading
 */
async function initEngine(jsonPath) {
  try {
    const response = await fetch(jsonPath);
    const data = await response.json();

    currentCert = data;
    bos = data.bos || [];
    chapters = data.chapters || [];
    quizData = data.quizData || [];
    glossaryData = data.glossaryData || {};

    // Update titles and badges
    document.title = data.title || "MEMOTEST";
    document.querySelectorAll(".nav-brand").forEach((el) => {
      el.innerHTML = `MEMOTEST <span class="nav-badge">${data.shortName || "ISTQB"}</span>`;
    });

    const mainTitle = document.getElementById("mainTitle");
    if (mainTitle) mainTitle.textContent = data.title;

    const mainDesc = document.getElementById("mainDesc");
    if (mainDesc) {
      mainDesc.innerHTML = `<span class="material-symbols-outlined" style="font-size:0.9rem;margin-right:0.4rem">emoji_events</span> ${data.fullName || "Certification ISTQB"}`;
    }

    const mainLongDesc = document.getElementById("mainLongDesc");
    if (mainLongDesc) {
      mainLongDesc.textContent =
        data.description ||
        "Préparez votre certification avec nos fiches et quiz interactifs.";
    }

    const sbShort = document.getElementById("sbShort");
    if (sbShort) sbShort.textContent = data.shortName;
    const sbFull = document.getElementById("sbFull");
    if (sbFull) sbFull.textContent = data.fullName;

    // Set initial state
    renderHome();
    renderChaptersList();
    renderGlossary();
    return data;
  } catch (error) {
    console.error("Error loading syllabus data:", error);
    alert("Impossible de charger les données du syllabus.");
  }
}

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function navigate(page, linkEl) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-links a")
    .forEach((a) => a.classList.remove("active"));
  document
    .querySelectorAll(".sidebar-link")
    .forEach((a) => a.classList.remove("active"));
  const pageEl = document.getElementById("page-" + page);
  if (pageEl) pageEl.classList.add("active");
  if (linkEl) linkEl.classList.add("active");
  state.currentPage = page;

  if (page === "chapters") {
    renderChaptersList();
    // Clear sidebar chapter highlight
    document
      .querySelectorAll("#sidebarChapters .sidebar-link")
      .forEach((el) => el.classList.remove("active"));
  }

  if (page === "quiz") initQuiz();
  if (page === "home") renderHome();
  if (page === "glossary") renderGlossary();
  window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════
   RENDERING LOGIC
═══════════════════════════════════════ */
function renderHome() {
  document.getElementById("statQuizDone").textContent = state.totalAnswered;
  document.getElementById("statScore").textContent =
    state.bestScore !== null ? state.bestScore + "%" : "—";
  const pct =
    state.totalAnswered > 0
      ? Math.min(
          100,
          Math.round(
            (state.quizCorrect / Math.max(state.totalAnswered, 1)) * 100,
          ),
        )
      : 0;
  const sidebarProgress = document.getElementById("sidebarProgress");
  if (sidebarProgress) sidebarProgress.style.width = pct + "%";

  const boGrid = document.getElementById("boGrid");
  if (boGrid)
    boGrid.innerHTML = bos
      .map(
        (b) => `
    <div class="bo-card">
      <span class="bo-tag">${b.id}</span>
      <span class="bo-text">${formatMarkdown(b.text)}</span>
    </div>`,
      )
      .join("");

  const statChapters = document.getElementById("statChapters");
  if (statChapters) statChapters.textContent = chapters.length;

  const grid = document.getElementById("homeChaptersGrid");
  if (grid) grid.innerHTML = chapters.map((ch) => chapterCardHTML(ch)).join("");
}

function chapterCardHTML(ch) {
  return `
  <div class="chapter-card" onclick="openChapter(${ch.id})">
    <div class="chapter-num">0${ch.id}</div>
    <div class="chapter-info">
      <h3>${ch.title}</h3>
      <p>${ch.sections.length} sections · ${ch.duration}</p>
    </div>
    <span class="chapter-badge">${ch.duration}</span>
    <button class="chapter-btn"><span class="material-symbols-outlined">arrow_forward</span></button>
  </div>`;
}

function renderChaptersList() {
  const grid = document.getElementById("chaptersListGrid");
  if (grid) grid.innerHTML = chapters.map((ch) => chapterCardHTML(ch)).join("");
}

function openChapter(id) {
  const chIndex = chapters.findIndex((c) => c.id === id);
  const ch = chapters[chIndex];
  if (!ch) return;
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const detailPage = document.getElementById("page-chapter-detail");
  if (detailPage) detailPage.classList.add("active");

  // Sidebar highlight
  document
    .querySelectorAll("#sidebarChapters .sidebar-link")
    .forEach((el, idx) => {
      el.classList.toggle("active", idx === chIndex);
    });

  // Nav data
  const prevChapter = chapters[chIndex - 1];
  const nextChapter = chapters[chIndex + 1];

  const contentEl = document.getElementById("chapterDetailContent");
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="chapter-view-header">
        <div class="tag">Chapitre ${ch.id} · ${ch.duration}</div>
        <h1>${ch.title}</h1>
        <p>${ch.sections.length} section${ch.sections.length > 1 ? "s" : ""} · Objectifs : ${ch.los || ""}</p>
      </div>
      <div class="chapter-nav-bar">
        <button class="btn-secondary" onclick="navigate('chapters')"><span class="material-symbols-outlined">arrow_back</span> Retour</button>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:100%"></div></div>
        <button class="btn-next" onclick="navigate('quiz')">Quiz <span class="material-symbols-outlined">quiz</span></button>
      </div>
      ${ch.sections
        .map(
          (sec) => `
      <div class="section-card">
        <h2><span class="sec-num">${sec.num}</span> ${sec.title}</h2>
        ${sec.content
          .split("\n\n")
          .map((p) => `<div class="content-p">${formatMarkdown(p)}</div>`)
          .join("")}
        ${sec.keyPoints ? `<div class="key-points"><h3>Points clés à retenir</h3><ul>${sec.keyPoints.map((k) => `<li>${k}</li>`).join("")}</ul></div>` : ""}
        ${sec.alert ? `<div class="exam-alert"><div class="icon"><span class="material-symbols-outlined">lightbulb</span></div><div><h3>Alerte examen</h3><p>${sec.alert}</p></div></div>` : ""}
      </div>`,
        )
        .join("")}

      <div class="chapter-bottom-nav">
        <div>
          ${
            prevChapter
              ? `
            <button class="btn-secondary" onclick="openChapter(${prevChapter.id})">
              <span class="material-symbols-outlined">arrow_back</span> ${prevChapter.title}
            </button>
          `
              : ""
          }
        </div>
        <div>
          ${
            nextChapter
              ? `
            <button class="btn-next" onclick="openChapter(${nextChapter.id})">
              ${nextChapter.title} <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }
  window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════
   QUIZ LOGIC
═══════════════════════════════════════ */
function initQuiz() {
  state.quizIndex = 0;
  state.quizAnswered = false;
  state.quizSelected = null;
  state.quizCorrect = 0;
  state.quizWrong = 0;
  state.timerSeconds = 30 * 60;
  const quizActive = document.getElementById("quizActive");
  if (quizActive) quizActive.style.display = "flex";
  const quizResult = document.getElementById("quizResult");
  if (quizResult) {
    quizResult.classList.remove("show");
    quizResult.style.display = "none";
  }
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(tickTimer, 1000);
  renderQuestion();
}

function tickTimer() {
  state.timerSeconds--;
  if (state.timerSeconds <= 0) {
    clearInterval(state.timerInterval);
    showResult();
    return;
  }
  const m = Math.floor(state.timerSeconds / 60),
    s = state.timerSeconds % 60;
  const display = document.getElementById("timerDisplay");
  if (display) display.textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

function renderQuestion() {
  if (quizData.length === 0) return;
  const q = quizData[state.quizIndex],
    total = quizData.length;
  const pb = document.getElementById("quizProgressBar");
  if (pb) pb.style.width = (state.quizIndex / total) * 100 + "%";
  const badge = document.getElementById("quizBadge");
  if (badge) badge.textContent = `Question ${state.quizIndex + 1} sur ${total}`;

  const dotsEl = document.getElementById("quizDots");
  if (dotsEl) {
    dotsEl.innerHTML =
      Array.from({ length: Math.min(total, 12) }, (_, i) => {
        let cls =
          i < state.quizIndex
            ? "done"
            : i === state.quizIndex
              ? "current"
              : "empty";
        return `<div class="quiz-dot ${cls}">${i < state.quizIndex ? '<span class="material-symbols-outlined">check</span>' : ""}</div>`;
      }).join("") +
      `<span style="font-size:.75rem;color:var(--on-surface-variant);margin-left:.25rem;">${total - state.quizIndex - 1} restantes</span>`;
  }

  document.getElementById("quizQuestion").innerHTML = formatMarkdown(q.q);
  document.getElementById("quizOptions").innerHTML = q.opts
    .map(
      (opt, i) => `
    <label class="quiz-option" id="opt-${i}" onclick="selectOption(${i})">
      <input type="radio" name="qopt" id="radio-${i}"/>
      <span class="quiz-option-text">${opt}</span>
      <div class="quiz-option-icon" id="opt-icon-${i}"></div>
    </label>`,
    )
    .join("");

  const expEl = document.getElementById("quizExplanation");
  if (expEl) {
    expEl.classList.remove("show");
    expEl.innerHTML = "";
  }
  const btnVal = document.getElementById("btnValidate");
  if (btnVal) btnVal.disabled = true;
  const btnNext = document.getElementById("btnNext");
  if (btnNext) {
    btnNext.innerHTML =
      state.quizIndex < total - 1
        ? 'Suivant <span class="material-symbols-outlined">arrow_forward</span>'
        : 'Terminer <span class="material-symbols-outlined">check_circle</span>';
  }
  const tip = document.getElementById("quizTip");
  if (tip) tip.textContent = q.tip || "Lisez attentivement.";
  updateSessionCircle();
  state.quizAnswered = false;
  state.quizSelected = null;
}

function selectOption(i) {
  if (state.quizAnswered) return;
  state.quizSelected = i;
  document
    .querySelectorAll(".quiz-option")
    .forEach((el, idx) => el.classList.toggle("selected", idx === i));
  const btnVal = document.getElementById("btnValidate");
  if (btnVal) btnVal.disabled = false;
}

function validateAnswer() {
  if (state.quizAnswered || state.quizSelected === null) return;
  state.quizAnswered = true;
  const q = quizData[state.quizIndex],
    correct = q.answer,
    selected = state.quizSelected;
  document.querySelectorAll(".quiz-option").forEach((el, i) => {
    el.style.cursor = "default";
    if (i === correct) {
      el.classList.add("correct");
      const icon = document.getElementById("opt-icon-" + i);
      if (icon)
        icon.innerHTML =
          '<span class="material-symbols-outlined">check_circle</span>';
    } else if (i === selected && selected !== correct) {
      el.classList.add("wrong");
      const icon = document.getElementById("opt-icon-" + i);
      if (icon)
        icon.innerHTML =
          '<span class="material-symbols-outlined">cancel</span>';
    }
    el.classList.remove("selected");
  });
  if (selected === correct) state.quizCorrect++;
  else state.quizWrong++;
  state.totalAnswered++;
  const expEl = document.getElementById("quizExplanation");
  if (expEl) {
    expEl.innerHTML = `<strong>${selected === correct ? "✓ Correct !" : "✗ Incorrect."}</strong> ${formatMarkdown(q.explanation)}`;
    expEl.classList.add("show");
  }
  const btnVal = document.getElementById("btnValidate");
  if (btnVal) btnVal.disabled = true;
  updateSessionCircle();
  const s = Math.round((state.quizCorrect / (state.quizIndex + 1)) * 100);
  if (state.bestScore === null || s > state.bestScore) state.bestScore = s;
}

function nextQuestion() {
  if (!state.quizAnswered && state.quizSelected !== null) validateAnswer();
  if (state.quizIndex >= quizData.length - 1) {
    showResult();
    return;
  }
  state.quizIndex++;
  renderQuestion();
}

function updateSessionCircle() {
  const total = quizData.length,
    done = state.quizIndex + (state.quizAnswered ? 1 : 0);
  const offset = 113.1 - (total > 0 ? (done / total) * 113.1 : 0);
  const el = document.getElementById("sessionFillCircle");
  if (el) el.setAttribute("stroke-dashoffset", offset);
  const lbl = document.getElementById("sessionLbl");
  if (lbl) lbl.textContent = `${done}/${total}`;
}

function showResult() {
  clearInterval(state.timerInterval);
  const elapsed = state.timerStartSeconds - state.timerSeconds;
  const m = Math.floor(elapsed / 60),
    s = elapsed % 60;
  const active = document.getElementById("quizActive");
  if (active) active.style.display = "none";
  const result = document.getElementById("quizResult");
  if (result) {
    result.style.display = "flex";
    result.classList.add("show");
  }
  const total = quizData.length,
    pct = total > 0 ? Math.round((state.quizCorrect / total) * 100) : 0;
  document.getElementById("resultPct").textContent = pct + "%";
  document.getElementById("resultCorrect").textContent = state.quizCorrect;
  document.getElementById("resultWrong").textContent = state.quizWrong;
  document.getElementById("resultTime").textContent =
    `${m}:${s.toString().padStart(2, "0")}`;

  const ring = document.getElementById("resultRingFill");
  if (ring)
    ring.setAttribute("stroke-dashoffset", 314.16 - (pct / 100) * 314.16);

  document.getElementById("statQuizDone").textContent = state.totalAnswered;
  document.getElementById("statScore").textContent = state.bestScore + "%";
}

function restartQuiz() {
  initQuiz();
}

/* ═══════════════════════════════════════
   GLOSSARY LOGIC
═══════════════════════════════════════ */
function renderGlossary() {
  const container = document.getElementById("glossaryContent");
  if (!container) return;
  container.innerHTML = Object.entries(glossaryData)
    .map(
      ([letter, terms]) => `
    <div class="glossary-letter" data-letter="${letter}">
      <div class="glossary-letter-head">${letter}</div>
      ${terms.map((t) => `<div class="glossary-term" data-term="${t.term.toLowerCase()}"><h3>${t.term}</h3><div class="content-p" style="font-size: 0.8125rem;">${formatMarkdown(t.def)}</div></div>`).join("")}
    </div>`,
    )
    .join("");
}

function filterGlossary(val) {
  const v = val.toLowerCase().trim();
  document.querySelectorAll(".glossary-term").forEach((el) => {
    el.classList.toggle(
      "hidden",
      v.length > 0 && !el.textContent.toLowerCase().includes(v),
    );
  });
  document.querySelectorAll(".glossary-letter").forEach((el) => {
    el.style.display =
      el.querySelectorAll(".glossary-term:not(.hidden)").length > 0
        ? "block"
        : "none";
  });
}
