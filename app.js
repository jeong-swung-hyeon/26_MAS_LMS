/**
 * 자기평가지 제출 안내 메시지 관리 시스템
 * app.js
 *
 * 흐름: 폼 작성 → 메시지 생성(미리보기) → 반 선택(체크박스) → 저장
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  addDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let db;

// ─── 앱 상태 ───────────────────────────────────────
const state = {
  classes:                [],   // { id, name, subject, color }
  selectedHistoryClassId: null, // 사이드바에서 선택된 반 (히스토리 조회용)
  currentMessage:         "",   // 생성된 메시지 텍스트
  currentQRUrl:           "",
  currentFormData:        null, // 저장용 폼 데이터
  modalDocId:             null,
  modalClassId:           null,
};

const CLASS_COLORS = [
  "#7c3aed","#06b6d4","#10b981","#f59e0b",
  "#ec4899","#3b82f6","#ef4444","#8b5cf6",
];

// ─── Firebase 초기화 ───────────────────────────────
async function initFirebase() {
  try {
    const module = await import("./firebase-config.js");
    const config = module.default;
    if (config.apiKey === "YOUR_API_KEY") { showConfigError(); return false; }
    const app = initializeApp(config);
    db = getFirestore(app);
    setConnectionBadge(true);
    return true;
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
    setConnectionBadge(false);
    return false;
  }
}

function setConnectionBadge(ok) {
  const badge = document.getElementById("connection-badge");
  if (ok) {
    badge.textContent = "Firebase 연결됨";
    badge.className   = "badge badge-teal";
  } else {
    badge.textContent = "Firebase 미연결";
    badge.className   = "badge";
    badge.style.background = "rgba(220,38,38,0.15)";
    badge.style.color      = "#dc2626";
  }
}

function showConfigError() {
  setConnectionBadge(false);
  document.getElementById("class-list").innerHTML =
    `<div class="history-empty" style="color:var(--red);font-size:12px;padding:12px;">
       firebase-config.js에<br/>설정값을 입력해 주세요.
     </div>`;
}

// ─── 반 목록 로드 ──────────────────────────────────
async function loadClasses() {
  if (!db) return;
  try {
    const snap = await getDocs(
      query(collection(db, "classes"), orderBy("createdAt", "asc"))
    );
    state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderClassList();
    renderClassCheckboxes();
  } catch (e) {
    console.error("반 목록 로드 실패:", e);
  }
}

// 사이드바 반 목록 렌더링
function renderClassList() {
  const el = document.getElementById("class-list");
  if (state.classes.length === 0) {
    el.innerHTML = `<div class="history-empty" style="font-size:12px;padding:12px;">
                      아직 추가된 반이 없습니다.
                    </div>`;
    return;
  }
  el.innerHTML = state.classes.map(cls => `
    <div class="class-item ${cls.id === state.selectedHistoryClassId ? 'active' : ''}"
         id="class-item-${cls.id}"
         onclick="window._app.selectHistoryClass('${cls.id}')">
      <div class="class-dot" style="background:${cls.color || '#7c3aed'}"></div>
      <span class="class-name">${escHtml(cls.name)}</span>
      <span class="class-count" id="count-${cls.id}">-</span>
      <button class="class-delete-btn" title="반 삭제"
              onclick="event.stopPropagation(); window._app.deleteClass('${cls.id}','${escHtml(cls.name)}')">✕</button>
    </div>
  `).join("");
  state.classes.forEach(cls => loadMessageCount(cls.id));
}

// 메인 영역 체크박스 렌더링 (카드 3)
function renderClassCheckboxes() {
  const el = document.getElementById("class-checkboxes");
  if (!el) return;
  if (state.classes.length === 0) {
    el.innerHTML = `<p class="text-muted" style="padding:4px 0;">
                      먼저 사이드바에서 반을 추가하세요.
                    </p>`;
    return;
  }
  el.innerHTML = state.classes.map(cls => `
    <label class="class-checkbox-label" for="chk-${cls.id}">
      <input type="checkbox" class="class-checkbox" id="chk-${cls.id}" value="${cls.id}" checked />
      <span class="class-checkbox-inner" style="--cls-color:${cls.color || '#7c3aed'}">
        <span class="class-checkbox-dot" style="background:${cls.color || '#7c3aed'}"></span>
        <span class="class-checkbox-name">${escHtml(cls.name)}</span>
        ${cls.subject ? `<span class="class-checkbox-sub">${escHtml(cls.subject)}</span>` : ""}
      </span>
    </label>
  `).join("");
}

async function loadMessageCount(classId) {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "classes", classId, "messages"));
    const el = document.getElementById(`count-${classId}`);
    if (el) el.textContent = snap.size + "건";
  } catch {}
}

// ─── 반 추가 / 삭제 ───────────────────────────────
async function addClass() {
  const name    = document.getElementById("new-class-name").value.trim();
  const subject = document.getElementById("new-class-subject").value.trim();
  if (!name) { alert("반 이름을 입력해 주세요."); return; }
  if (!db)   { alert("Firebase가 연결되지 않았습니다."); return; }

  const btn = document.getElementById("btn-add-class");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const color = CLASS_COLORS[state.classes.length % CLASS_COLORS.length];
    await addDoc(collection(db, "classes"), {
      name, subject, color, createdAt: serverTimestamp()
    });
    document.getElementById("new-class-name").value    = "";
    document.getElementById("new-class-subject").value = "";
    await loadClasses();
  } catch (e) {
    alert("반 추가 실패: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "＋ 반 추가";
  }
}

async function deleteClass(classId, className) {
  if (!confirm(`"${className}" 반을 삭제하시겠습니까?\n메시지 히스토리도 모두 삭제됩니다.`)) return;
  if (!db) return;
  try {
    const msgsSnap = await getDocs(collection(db, "classes", classId, "messages"));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "classes", classId));
    if (state.selectedHistoryClassId === classId) {
      state.selectedHistoryClassId = null;
      document.getElementById("sidebar-history-section").style.display = "none";
    }
    await loadClasses();
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

// ─── 사이드바 히스토리 ─────────────────────────────
function selectHistoryClass(classId) {
  state.selectedHistoryClassId = classId;

  document.querySelectorAll(".class-item").forEach(el => el.classList.remove("active"));
  const item = document.getElementById(`class-item-${classId}`);
  if (item) item.classList.add("active");

  const cls = state.classes.find(c => c.id === classId);
  document.getElementById("sidebar-history-class-name").textContent = cls?.name || "";
  document.getElementById("sidebar-history-class-dot").style.background = cls?.color || "#7c3aed";
  document.getElementById("sidebar-history-section").style.display = "block";

  loadSidebarHistory();
}

async function loadSidebarHistory() {
  const classId = state.selectedHistoryClassId;
  if (!db || !classId) return;

  const el = document.getElementById("sidebar-history-list");
  el.innerHTML = `<div class="history-empty" style="font-size:12px;padding:8px;">불러오는 중…</div>`;

  try {
    const snap = await getDocs(
      query(
        collection(db, "classes", classId, "messages"),
        orderBy("createdAt", "desc")
      )
    );

    if (snap.empty) {
      el.innerHTML = `<div class="history-empty" style="font-size:12px;padding:8px;">
                        저장된 메시지가 없습니다.
                      </div>`;
      return;
    }

    // 캐시 저장
    window._historyDocs = window._historyDocs || {};
    snap.docs.forEach(d => {
      window._historyDocs[d.id] = { ...d.data(), _classId: classId };
    });

    el.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const dateStr  = data.classDate ? formatDate(data.classDate, "short") : "-";
      const topicStr = data.nextTopic ? escHtml(data.nextTopic) : "";
      return `
        <div class="sidebar-history-item" onclick="window._app.openModal('${d.id}','${classId}')">
          <span class="sidebar-history-date">${dateStr}</span>
          <span class="sidebar-history-topic">${topicStr}</span>
        </div>`;
    }).join("");

  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);font-size:12px;padding:8px;">로드 실패</div>`;
  }
}

// ─── QR 코드 생성 ──────────────────────────────────
function generateQR() {
  const url = document.getElementById("f-submit-url").value.trim();
  if (!url) { alert("제출 링크를 먼저 입력해 주세요."); return; }

  const container = document.getElementById("qr-canvas-container");
  container.innerHTML = "";

  try {
    new QRCode(container, {
      text:  url,
      width: 180, height: 180,
      colorDark:  "#1e1b3a",
      colorLight: "transparent",
      correctLevel: QRCode.CorrectLevel.M,
    });
    state.currentQRUrl = url;
    document.getElementById("qr-url-hint").textContent = url;
    document.getElementById("btn-download-qr").disabled = false;
  } catch (e) {
    container.innerHTML = `<div class="qr-placeholder" style="color:var(--red);">QR 생성 실패</div>`;
  }
}

// ─── 메시지 생성 (저장 X, 미리보기만) ────────────────
function generateMessage() {
  const url       = document.getElementById("f-submit-url").value.trim();
  const classDate = document.getElementById("f-class-date").value;
  const deadDate  = document.getElementById("f-deadline-date").value;
  const deadTime  = document.getElementById("f-deadline-time").value;
  const nextDate  = document.getElementById("f-next-date").value;
  const nextTopic = document.getElementById("f-next-topic").value.trim();
  const extraNote = document.getElementById("f-extra-note").value.trim();

  if (!url || !classDate || !deadDate || !deadTime || !nextDate || !nextTopic) {
    alert("⚠️ 필수 항목(*)을 모두 입력해 주세요.");
    return;
  }

  const classDateFmt = formatDate(classDate);
  const nextDateFmt  = formatDate(nextDate);
  const deadDateFmt  = formatDate(deadDate);
  const deadTimeFmt  = formatTime(deadTime);

  const msgLines = [
    "📋 [자기평가지 제출 안내]",
    "",
    "안녕하세요! 오늘 수업 수고하셨습니다 😊",
    `오늘(${classDateFmt}) 수업에 참여해 주셔서 감사합니다.`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━",
    "✅ 자기평가지 제출 안내",
    "━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🔗 제출 링크",
    url,
    "",
    `⏰ 제출 마감 : ${deadDateFmt} ${deadTimeFmt}까지`,
    "",
    "📌 아래 QR코드로도 제출 가능합니다 👇",
    "   (QR코드는 별도 이미지 참고)",
    "",
    "━━━━━━━━━━━━━━━━━━━━━",
    "📅 다음 수업 안내",
    "━━━━━━━━━━━━━━━━━━━━━",
    "",
    `• 일  시 : ${nextDateFmt}`,
    `• 주  제 : ${nextTopic}`,
  ];

  if (extraNote) {
    msgLines.push(
      "", "━━━━━━━━━━━━━━━━━━━━━",
      "📢 추가 공지사항",
      "━━━━━━━━━━━━━━━━━━━━━",
      "", extraNote
    );
  }
  msgLines.push("", "수업 관련 문의는 선생님께 언제든지 연락 주세요! 🙏");

  state.currentMessage  = msgLines.join("\n");
  state.currentFormData = { classDate, deadDate, deadTime, nextDate, nextTopic, submitUrl: url, extraNote };

  // 미리보기 업데이트
  const preview = document.getElementById("message-preview");
  preview.textContent = state.currentMessage;
  preview.classList.remove("empty");
  document.getElementById("btn-copy-msg").disabled = false;

  // QR 자동 생성
  if (url && url !== state.currentQRUrl) generateQR();

  // 반 선택 카드 표시
  const selectorCard = document.getElementById("class-selector-card");
  selectorCard.style.display = "block";
  renderClassCheckboxes();

  setTimeout(() => selectorCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

// ─── 선택한 반에 저장 ──────────────────────────────
async function saveToSelectedClasses() {
  if (!state.currentMessage || !state.currentFormData) {
    alert("먼저 메시지를 생성해 주세요."); return;
  }
  if (!db) { alert("Firebase가 연결되지 않았습니다."); return; }

  const checked = [...document.querySelectorAll(".class-checkbox:checked")];
  if (checked.length === 0) {
    alert("저장할 반을 하나 이상 선택해 주세요."); return;
  }

  const btn = document.getElementById("btn-save-classes");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 저장 중…';

  try {
    await Promise.all(
      checked.map(chk =>
        addDoc(collection(db, "classes", chk.value, "messages"), {
          ...state.currentFormData,
          messageText: state.currentMessage,
          createdAt: serverTimestamp(),
        })
      )
    );

    const classNames = checked.map(chk => {
      const cls = state.classes.find(c => c.id === chk.value);
      return cls?.name || "";
    }).filter(Boolean);

    showToast(`✓ [${classNames.join("] [") }]에 저장되었습니다!`);

    // 카운트 새로고침
    checked.forEach(chk => loadMessageCount(chk.value));

    // 현재 보고 있는 히스토리 반이 포함돼 있으면 새로고침
    if (state.selectedHistoryClassId &&
        checked.find(c => c.value === state.selectedHistoryClassId)) {
      loadSidebarHistory();
    }

    // 반 선택 카드 숨기기
    document.getElementById("class-selector-card").style.display = "none";
    state.currentFormData = null;

  } catch (e) {
    alert("저장 실패: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "💾 선택한 반에 저장";
  }
}

function selectAllClasses()   { document.querySelectorAll(".class-checkbox").forEach(c => c.checked = true); }
function deselectAllClasses() { document.querySelectorAll(".class-checkbox").forEach(c => c.checked = false); }

// ─── 모달 (히스토리 상세) ──────────────────────────
function openModal(docId, classId) {
  state.modalDocId   = docId;
  state.modalClassId = classId || state.selectedHistoryClassId;

  window._historyDocs = window._historyDocs || {};
  const data = window._historyDocs[docId];
  if (!data) return;

  document.getElementById("modal-title").textContent =
    `📋 ${data.classDate ? formatDate(data.classDate) : ""} 저장된 메시지`;
  document.getElementById("modal-message-text").textContent = data.messageText || "";
  document.getElementById("modal-delete-btn").onclick = () => deleteHistoryItem(docId);

  const meta = document.getElementById("modal-meta");
  meta.innerHTML = [
    data.deadTime  ? `<span class="badge badge-purple">⏰ 마감 ${data.deadDate ? formatDate(data.deadDate, "short") + " " : ""}${formatTime(data.deadTime)}</span>` : "",
    data.nextDate  ? `<span class="badge badge-teal">📅 다음 ${formatDate(data.nextDate, "short")}</span>` : "",
    data.nextTopic ? `<span class="badge" style="background:#f0fdf4;color:#059669;">📚 ${escHtml(data.nextTopic)}</span>` : "",
  ].join("");

  document.getElementById("history-modal").classList.add("open");
}

function closeModal(e) {
  if (e.target === document.getElementById("history-modal")) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById("history-modal").classList.remove("open");
  state.modalDocId = state.modalClassId = null;
}

function copyModalMessage() {
  copyToClipboard(document.getElementById("modal-message-text").textContent);
}

function loadToForm() {
  const data = window._historyDocs?.[state.modalDocId];
  if (!data) return;

  if (data.classDate)  document.getElementById("f-class-date").value     = data.classDate;
  if (data.deadDate || data.classDate)
    document.getElementById("f-deadline-date").value = data.deadDate || data.classDate;
  if (data.deadTime)   document.getElementById("f-deadline-time").value   = data.deadTime;
  if (data.submitUrl)  document.getElementById("f-submit-url").value      = data.submitUrl;
  if (data.nextDate)   document.getElementById("f-next-date").value       = data.nextDate;
  if (data.nextTopic)  document.getElementById("f-next-topic").value      = data.nextTopic;
  document.getElementById("f-extra-note").value = data.extraNote || "";

  if (data.submitUrl) { state.currentQRUrl = ""; generateQR(); }

  // 이전에 생성해 둔 메시지/반 선택 상태는 새로 불러온 값과 맞지 않으므로 초기화
  state.currentMessage  = "";
  state.currentFormData = null;
  const preview = document.getElementById("message-preview");
  preview.textContent = "내용을 수정한 뒤 '메시지 생성'을 다시 눌러주세요.";
  preview.classList.add("empty");
  document.getElementById("btn-copy-msg").disabled = true;
  document.getElementById("class-selector-card").style.display = "none";

  closeModalDirect();
  document.querySelector(".card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("✅ 폼에 불러왔습니다! 수정 후 '메시지 생성'을 눌러주세요.");
}

async function deleteHistoryItem(docId) {
  if (!confirm("이 메시지를 삭제하시겠습니까?")) return;
  if (!db) return;
  const classId = state.modalClassId;
  if (!classId) return;
  try {
    await deleteDoc(doc(db, "classes", classId, "messages", docId));
    closeModalDirect();
    loadSidebarHistory();
    loadMessageCount(classId);
    showToast("🗑️ 삭제되었습니다.");
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

// ─── 유틸리티 ──────────────────────────────────────
function copyMessage() {
  if (state.currentMessage) copyToClipboard(state.currentMessage);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast("✓ 클립보드에 복사되었습니다!"))
    .catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("✓ 클립보드에 복사되었습니다!");
    });
}

function downloadQR() {
  const canvas = document.querySelector("#qr-canvas-container canvas");
  if (!canvas) { alert("QR코드를 먼저 생성해 주세요."); return; }
  const link = document.createElement("a");
  link.download = "QR_자기평가제출.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetForm() {
  document.getElementById("f-submit-url").value    = "";
  document.getElementById("f-next-topic").value    = "";
  document.getElementById("f-extra-note").value    = "";
  document.getElementById("f-deadline-time").value = "23:59";
  setDefaultDates();

  const preview = document.getElementById("message-preview");
  preview.textContent = "메시지를 생성하면 여기에 미리보기가 표시됩니다.";
  preview.classList.add("empty");
  document.getElementById("btn-copy-msg").disabled    = true;
  document.getElementById("btn-download-qr").disabled = true;
  document.getElementById("qr-canvas-container").innerHTML =
    `<div class="qr-placeholder">URL을 입력하고<br/>'QR 생성'을 눌러주세요</div>`;
  document.getElementById("qr-url-hint").textContent = "";
  document.getElementById("class-selector-card").style.display = "none";

  state.currentMessage  = "";
  state.currentQRUrl    = "";
  state.currentFormData = null;
}

function setDefaultDates() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  document.getElementById("f-class-date").value = todayStr;
  document.getElementById("f-deadline-date").value = todayStr;
  const next = new Date(today);
  next.setDate(next.getDate() + 7);
  document.getElementById("f-next-date").value = next.toISOString().split("T")[0];
}

function showToast(msg) {
  const toast = document.getElementById("copy-toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

// "2026-09-13" → full: "2026년 9월 13일 (일)" / short: "9/13(일)"
function formatDate(dateStr, mode = "full") {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일","월","화","수","목","금","토"];
  if (mode === "short") {
    return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
  }
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

// "23:59" → "오후 11:59"
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour12}:${String(m).padStart(2, "0")}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── 초기화 ────────────────────────────────────────
(async function init() {
  setDefaultDates();
  const ok = await initFirebase();
  if (!ok) return;
  await loadClasses();
})();

// 전역 노출
window._app = {
  addClass, deleteClass,
  selectHistoryClass, loadSidebarHistory,
  generateQR, generateMessage,
  saveToSelectedClasses, selectAllClasses, deselectAllClasses,
  copyMessage, downloadQR, resetForm,
  openModal, closeModal, closeModalDirect,
  copyModalMessage, loadToForm,
};
