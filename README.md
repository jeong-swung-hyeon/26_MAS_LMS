# 📋 자기평가지 제출 안내 메시지 관리 시스템

매 수업 후 자기평가지 제출 안내 메시지를 자동 생성하고, Firebase Firestore로 관리하는 웹 앱입니다.

---

## 🚀 시작하기

### 1. Firebase 설정

`firebase-config.js` 파일을 열어 본인의 Firebase 프로젝트 정보를 입력합니다.

```js
const firebaseConfig = {
  apiKey:            "...",   // Firebase 콘솔에서 복사
  authDomain:        "...",
  projectId:         "...",
  storageBucket:     "...",
  messagingSenderId: "...",
  appId:             "..."
};
```

> Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → SDK 설정 및 구성

### 2. Firestore 보안 규칙 (개발용)

Firebase 콘솔 → Firestore → 규칙 탭에서 아래 설정 (개발 단계):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. 실행

브라우저에서 `index.html`을 직접 열면 됩니다.  
단, ES Module(`import`) 사용으로 **로컬 서버가 필요**합니다.

```bash
# VS Code의 Live Server 확장 사용 권장
# 또는 Node.js가 있다면:
npx serve .
```

---

## 📁 파일 구조

```
26_MAS_LMS/
├── index.html          # 메인 앱 화면
├── style.css           # 스타일 (다크 모던 테마)
├── app.js              # 앱 로직 (Firebase + QR + 메시지)
├── firebase-config.js  # ⚠️ Firebase 설정값 (본인 값 입력 필요)
└── README.md
```

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 반 관리 | 여러 반/수업을 추가·삭제·전환 |
| 메시지 생성 | 날짜·URL·마감·다음수업 입력 → 카카오톡 공지 스타일 자동 생성 |
| QR 자동 생성 | 제출 URL 입력 시 QR코드 즉시 생성, PNG 저장 가능 |
| 원클릭 복사 | 생성된 메시지를 클립보드에 한 번에 복사 |
| 히스토리 | Firestore에 저장된 과거 메시지 조회·삭제 |

---

## 💬 생성 메시지 예시

```
📋 [자기평가지 제출 안내]

안녕하세요! 1반 오늘 수업 수고하셨습니다 😊
오늘(2026년 9월 13일 (일)) 수업에 참여해 주셔서 감사합니다.

━━━━━━━━━━━━━━━━━━━━━
✅ 자기평가지 제출 안내
━━━━━━━━━━━━━━━━━━━━━

🔗 제출 링크
https://forms.gle/xxxxxxxx

⏰ 제출 마감 : 2026년 9월 13일 (일) 오후 11:59까지

📌 아래 QR코드로도 제출 가능합니다 👇
   (QR코드는 별도 이미지 참고)

━━━━━━━━━━━━━━━━━━━━━
📅 다음 수업 안내
━━━━━━━━━━━━━━━━━━━━━

• 일  시 : 2026년 9월 20일 (일)
• 주  제 : 데이터 시각화 기초

수업 관련 문의는 선생님께 언제든지 연락 주세요! 🙏
```
