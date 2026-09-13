/**
 * 자기평가지 제출 안내 메시지 관리 시스템
 * app.js — Firebase Firestore + QR + 메시지 생성 로직
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  addDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ── Firebase 설정 import ──
// firebase-config.js 에서 본인 프로젝트 설정값을 입력해 주세요
let db;

// ──────────────────────────────────────────────────
//  앱 상태
// ──────────────────────────────────────────────────
const state = {
  classes:         [],   // { id, name, subject, color }
  selectedClassId: null,
  currentMessage:  "",
  currentQRUrl:    "",
  modalDocId:      null,
};

// 반 색상 팔레트
const CLASS_COLORS = [
  "#7c3aed","#06b6d4","#10b981","#f59e0b",
  "#ec4899","#3b82f6","#ef4444","#8b5cf6",
];

// ──────────────────────────────────────────────────
//  Firebase 초기화
// ──────────────────────────────────────────────────
async function initFirebase() {
  try {
    // firebase-config.js 에서 설정값 로드
    const module = await import("./firebase-config.js");
    const config = module.default;

    if (config.apiKey === "YOUR_API_KEY") {
      showConfigError();
      return false;
    }

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
    badge.className = "badge badge-teal";
  } else {
    badge.textContent = "Firebase 미연결";
    badge.className = "badge";
    badge.style.background = "rgba(239,68,68,0.2)";
    badge.style.color = "#ef4444";
  }
}

function showConfigError() {
  setConnectionBadge(false);
  document.getElementById("main-content").innerHTML = `
    <div class="empty-state" style="max-width:520px;margin:auto;">
      <div class="empty-icon">⚙️</div>
      <p style="font-size:16px;font-weight:700;margin-bottom:8px;">Firebase 설정이 필요합니다</p>
      <p style="color:var(--text-secondary);line-height:1.8;">
        <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">firebase-config.js</code> 파일을 열어<br/>
        본인의 Firebase 프로젝트 설정값을 입력해 주세요.<br/><br/>
        Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성
      </p>
    </div>
  `;
}

// ──────────────────────────────────────────────────
//  반(Class) CRUD
// ──────────────────────────────────────────────────
async function loadClasses() {
  if (!db) return;
  try {
    const snap = await getDocs(
      query(collection(db, "classes"), orderBy("createdAt", "asc"))
    );
    state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderClassList();
  } catch (e) {
    console.error("반 목록 로드 실패:", e);
  }
}

function renderClassList() {
  const el = document.getElementById("class-list");
  if (state.classes.length === 0) {
    el.innerHTML = `<div class="history-empty" style="padding:16px 8px;">아직 추가된 반이 없습니다.<br/>아래에서 새 반을 추가하세요.</div>`;
    return;
  }
  el.innerHTML = state.classes.map(cls => `
    <div class="class-item ${cls.id === state.selectedClassId ? 'active' : ''}"
         id="class-item-${cls.id}"
         onclick="window._app.selectClass('${cls.id}')">
      <div class="class-dot" style="background:${cls.color || '#7c3aed'}"></div>
      <span class="class-name">${escHtml(cls.name)}</span>
      <span class="class-count" id="count-${cls.id}">-</span>
      <button class="class-delete-btn" title="반 삭제"
              onclick="event.stopPropagation(); window._app.deleteClass('${cls.id}','${escHtml(cls.name)}')">✕</button>
    </div>
  `).join("");

  // 메시지 수 표시
  state.classes.forEach(cls => loadMessageCount(cls.id));
}

async function loadMessageCount(classId) {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "classes", classId, "messages"));
    const el = document.getElementById(`count-${classId}`);
    if (el) el.textContent = snap.size + "건";
  } catch {}
}

async function addClass() {
  const name    = document.getElementById("new-class-name").value.trim();
  const subject = document.getElementById("new-class-subject").value.trim();
  if (!name) { alert("반 이름을 입력해 주세요."); return; }
  if (!db)   { alert("Firebase가 연결되지 않았습니다."); return; }

  const btn = document.getElementById("btn-add-class");
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  try {
    const color = CLASS_COLORS[state.classes.length % CLASS_COLORS.length];
    const docRef = await addDoc(collection(db, "classes"), {
      name, subject, color, createdAt: serverTimestamp()
    });
    document.getElementById("new-class-name").value    = "";
    document.getElementById("new-class-subject").value = "";
    await loadClasses();
    selectClass(docRef.id);
  } catch (e) {
    alert("반 추가 실패: " + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = "＋ 반 추가";
  }
}

async function deleteClass(classId, className) {
  if (!confirm(`"${className}" 반을 삭제하시겠습니까?\n메시지 히스토리도 모두 삭제됩니다.`)) return;
  if (!db) return;

  try {
    // 하위 messages 컬렉션 삭제
    const msgsSnap = await getDocs(collection(db, "classes", classId, "messages"));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
    // 반 문서 삭제
    await deleteDoc(doc(db, "classes", classId));

    if (state.selectedClassId === classId) {
      state.selectedClassId = null;
      showEmptyState();
    }
    await loadClasses();
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

function selectClass(classId) {
  state.selectedClassId = classId;
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;

  // 사이드바 활성 표시 업데이트
  document.querySelectorAll(".class-item").forEach(el => el.classList.remove("active"));
  const item = document.getElementById(`class-item-${classId}`);
  if (item) item.classList.add("active");

  // 워크스페이스 표시
  document.getElementById("empty-state").style.display = "none";
  const ws = document.getElementById("class-workspace");
  ws.style.display = "flex";

  document.getElementById("ws-class-name").textContent    = cls.name;
  document.getElementById("ws-class-subject").textContent = cls.subject || "";
  document.getElementById("ws-class-badge").textContent   = cls.subject || cls.name;
  document.getElementById("ws-class-badge").style.background = hexToRgba(cls.color || "#7c3aed", 0.2);
  document.getElementById("ws-class-badge").style.color      = cls.color || "#7c3aed";

  // 오늘 날짜 기본값
  setDefaultDates();
  resetPreview();
  loadHistory();
}

function showEmptyState() {
  document.getElementById("empty-state").style.display  = "flex";
  document.getElementById("class-workspace").style.display = "none";
}

function setDefaultDates() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  document.getElementById("f-class-date").value = todayStr;

  // 다음 수업: 기본 7일 후
  const next = new Date(today);
  next.setDate(next.getDate() + 7);
  document.getElementById("f-next-date").value = next.toISOString().split("T")[0];
}

// ──────────────────────────────────────────────────
//  QR 코드 생성
// ──────────────────────────────────────────────────
function generateQR() {
  const url = document.getElementById("f-submit-url").value.trim();
  if (!url) { alert("제출 링크를 먼저 입력해 주세요."); return; }

  const container = document.getElementById("qr-canvas-container");
  container.innerHTML = ""; // 기존 QR 제거

  try {
    new QRCode(container, {
      text: url,
      width:  180,
      height: 180,
      colorDark:  "#ffffff",
      colorLight: "transparent",
      correctLevel: QRCode.CorrectLevel.M,
    });
    state.currentQRUrl = url;
    document.getElementById("qr-url-hint").textContent = url;

    // 다운로드 버튼 활성화
    document.getElementById("btn-download-qr").disabled = false;
  } catch (e) {
    container.innerHTML = `<div class="qr-placeholder" style="color:var(--red);">QR 생성 실패<br/>${e.message}</div>`;
  }
}

// ──────────────────────────────────────────────────
//  메시지 생성 & Firestore 저장
// ──────────────────────────────────────────────────
async function generateMessage() {
  // 유효성 검사
  const url       = document.getElementById("f-submit-url").value.trim();
  const classDate = document.getElementById("f-class-date").value;
  const deadTime  = document.getElementById("f-deadline-time").value;
  const nextDate  = document.getElementById("f-next-date").value;
  const nextTopic = document.getElementById("f-next-topic").value.trim();
  const extraNote = document.getElementById("f-extra-note").value.trim();

  if (!url || !classDate || !deadTime || !nextDate || !nextTopic) {
    alert("⚠️ 필수 항목(*)을 모두 입력해 주세요.");
    return;
  }

  if (!db) { alert("Firebase가 연결되지 않았습니다."); return; }

  // 날짜 포맷
  const cls        = state.classes.find(c => c.id === state.selectedClassId);
  const classDateFmt = formatDate(classDate);
  const nextDateFmt  = formatDate(nextDate);
  const deadTimeFmt  = formatTime(deadTime);

  // 카카오톡 공지 스타일 메시지 생성
  const msgLines = [
    "📋 [자기평가지 제출 안내]",
    "",
    `안녕하세요! ${cls ? cls.name + " " : ""}오늘 수업 수고하셨습니다 😊`,
    `오늘(${classDateFmt}) 수업에 참여해 주셔서 감사합니다.`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━",
    "✅ 자기평가지 제출 안내",
    "━━━━━━━━━━━━━━━━━━━━━",
    "",
    `🔗 제출 링크`,
    url,
    "",
    `⏰ 제출 마감 : ${classDateFmt} ${deadTimeFmt}까지`,
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
    msgLines.push("");
    msgLines.push("━━━━━━━━━━━━━━━━━━━━━");
    msgLines.push("📢 추가 공지사항");
    msgLines.push("━━━━━━━━━━━━━━━━━━━━━");
    msgLines.push("");
    msgLines.push(extraNote);
  }

  msgLines.push("");
  msgLines.push("수업 관련 문의는 선생님께 언제든지 연락 주세요! 🙏");

  const messageText = msgLines.join("\n");
  state.currentMessage = messageText;

  // 미리보기 업데이트
  const preview = document.getElementById("message-preview");
  preview.textContent = messageText;
  preview.classList.remove("empty");
  document.getElementById("btn-copy-msg").disabled = false;

  // QR도 자동 생성 (URL 입력되어 있으면)
  if (url && url !== state.currentQRUrl) generateQR();

  // Firestore 저장
  const btn = document.getElementById("btn-generate");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 저장 중…';

  try {
    await addDoc(collection(db, "classes", state.selectedClassId, "messages"), {
      classDate, deadTime, nextDate, nextTopic,
      submitUrl: url, extraNote,
      messageText,
      createdAt: serverTimestamp(),
    });
    showToast("✓ 메시지가 저장되었습니다!");
    await loadHistory();
    loadMessageCount(state.selectedClassId);
  } catch (e) {
    alert("저장 실패: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "✨ 메시지 생성 &amp; 저장";
  }
}

// ──────────────────────────────────────────────────
//  히스토리
// ──────────────────────────────────────────────────
async function loadHistory() {
  if (!db || !state.selectedClassId) return;
  const el = document.getElementById("history-list");
  el.innerHTML = `<div class="history-empty">불러오는 중…</div>`;

  try {
    const snap = await getDocs(
      query(
        collection(db, "classes", state.selectedClassId, "messages"),
        orderBy("createdAt", "desc")
      )
    );

    if (snap.empty) {
      el.innerHTML = `<div class="history-empty">아직 저장된 메시지가 없습니다.</div>`;
      return;
    }

    el.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const cd   = data.classDate ? formatDate(data.classDate) : "-";
      const dt   = data.deadTime  ? formatTime(data.deadTime)  : "-";
      const nd   = data.nextDate  ? formatDate(data.nextDate)  : "-";
      const dayNum = data.classDate ? new Date(data.classDate).getDate() : "-";
      const monStr = data.classDate ? formatMonthShort(data.classDate) : "";

      return `
        <div class="history-item" onclick="window._app.openModal('${d.id}')">
          <div class="history-date">
            <div class="date-day">${dayNum}</div>
            <div class="date-mon">${monStr}</div>
          </div>
          <div class="history-info">
            <div class="history-title">📋 ${cd} 수업 자기평가 안내</div>
            <div class="history-meta">
              <span>⏰ 마감 ${dt}</span>
              <span>📅 다음 ${nd}</span>
              <span>📚 ${escHtml(data.nextTopic || "-")}</span>
            </div>
          </div>
          <div class="history-actions">
            <button class="btn btn-secondary btn-sm"
                    onclick="event.stopPropagation(); window._app.openModal('${d.id}')">
              보기
            </button>
          </div>
        </div>`;
    }).join("");

    // 문서 캐시 저장 (모달용)
    window._historyDocs = {};
    snap.docs.forEach(d => { window._historyDocs[d.id] = d.data(); });

  } catch (e) {
    el.innerHTML = `<div class="history-empty" style="color:var(--red);">로드 실패: ${e.message}</div>`;
  }
}

// ──────────────────────────────────────────────────
//  모달 (히스토리 상세)
// ──────────────────────────────────────────────────
function openModal(docId) {
  state.modalDocId = docId;
  const data = window._historyDocs?.[docId];
  if (!data) return;

  document.getElementById("modal-title").textContent =
    `📋 ${data.classDate ? formatDate(data.classDate) : ""} 저장된 메시지`;
  document.getElementById("modal-message-text").textContent = data.messageText || "";
  document.getElementById("modal-delete-btn").onclick = () => deleteHistoryItem(docId);

  document.getElementById("history-modal").classList.add("open");
}

function closeModal(e) {
  if (e.target === document.getElementById("history-modal")) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById("history-modal").classList.remove("open");
  state.modalDocId = null;
}

function copyModalMessage() {
  const text = document.getElementById("modal-message-text").textContent;
  copyToClipboard(text);
}

async function deleteHistoryItem(docId) {
  if (!confirm("이 메시지를 삭제하시겠습니까?")) return;
  if (!db || !state.selectedClassId) return;

  try {
    await deleteDoc(doc(db, "classes", state.selectedClassId, "messages", docId));
    closeModalDirect();
    await loadHistory();
    loadMessageCount(state.selectedClassId);
    showToast("🗑️ 삭제되었습니다.");
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

// ──────────────────────────────────────────────────
//  유틸리티
// ──────────────────────────────────────────────────
function copyMessage() {
  if (!state.currentMessage) return;
  copyToClipboard(state.currentMessage);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast("✓ 클립보드에 복사되었습니다!"))
    .catch(() => {
      // 폴백: textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select(); document.execCommand("copy");
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
  document.getElementById("f-submit-url").value  = "";
  document.getElementById("f-next-topic").value  = "";
  document.getElementById("f-extra-note").value  = "";
  document.getElementById("f-deadline-time").value = "23:59";
  setDefaultDates();
  resetPreview();
}

function resetPreview() {
  const preview = document.getElementById("message-preview");
  preview.textContent = "메시지를 생성하면 여기에 미리보기가 표시됩니다.";
  preview.classList.add("empty");
  document.getElementById("btn-copy-msg").disabled = true;
  document.getElementById("btn-download-qr").disabled = true;
  document.getElementById("qr-canvas-container").innerHTML =
    `<div class="qr-placeholder">URL을 입력하고<br/>'QR 생성'을 눌러주세요</div>`;
  document.getElementById("qr-url-hint").textContent = "";
  state.currentMessage = "";
  state.currentQRUrl   = "";
}

function showToast(msg) {
  const toast = document.getElementById("copy-toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

// 날짜: "2026-09-13" → "2026년 9월 13일 (일)"
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일","월","화","수","목","금","토"];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

// 월 약칭: "2026-09-13" → "9월"
function formatMonthShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth()+1}월`;
}

// 시간: "23:59" → "오후 11:59"
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour12}:${String(m).padStart(2,"0")}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ──────────────────────────────────────────────────
//  초기화 & 전역 노출
// ──────────────────────────────────────────────────
(async function init() {
  const ok = await initFirebase();
  if (!ok) return;
  await loadClasses();
})();

// HTML onclick에서 호출할 수 있도록 전역 노출
window._app = {
  addClass,
  deleteClass,
  selectClass,
  generateQR,
  generateMessage,
  copyMessage,
  downloadQR,
  resetForm,
  loadHistory,
  openModal,
  closeModal,
  closeModalDirect,
  copyModalMessage,
};
