// ==========================================================================
// AI Resume & Portfolio Builder - app.js
// 폼 제출, API 비동기 통신, 로딩 처리, 오류 안내, 복사 및 다운로드 기능
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. DOM 요소 선택
  const resumeForm = document.getElementById("resumeForm");
  const generateBtn = document.getElementById("generateBtn");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const emptyState = document.getElementById("emptyState");
  const resultContainer = document.getElementById("resultContainer");
  const resultText = document.getElementById("resultText");
  const actionButtons = document.getElementById("actionButtons");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const errorMessage = document.getElementById("errorMessage");

  // 원본 마크다운 텍스트 보관 변수
  let currentMarkdown = "";

  // 2. 오류 메시지 표시 헬퍼 함수
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = "block";
  }

  // 3. 오류 메시지 숨김 헬퍼 함수
  function hideError() {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }

  // 4. 폼 제출 이벤트 처리
  resumeForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // 기본 브라우저 새로고침 방지
    hideError();

    // 입력값 추출 및 공백 제거
    const name = document.getElementById("name").value.trim();
    const role = document.getElementById("role").value.trim();
    const experience = document.getElementById("experience").value.trim();
    const projects = document.getElementById("projects").value.trim();
    const tone = document.getElementById("tone").value;
    const promptType = document.querySelector('input[name="prompt_type"]:checked')?.value || "A";

    // Frontend 1차 유효성 검증
    if (!name || !role || !experience || !projects) {
      showError("모든 필수 항목(이름, 지원 직무, 경력 사항, 프로젝트)을 빠짐없이 입력해 주세요.");
      return;
    }

    // UI를 로딩 상태로 전환
    generateBtn.disabled = true;
    generateBtn.textContent = "⏳ AI가 이력서를 작성하고 있습니다...";
    emptyState.style.display = "none";
    resultContainer.style.display = "none";
    actionButtons.style.display = "none";
    loadingIndicator.style.display = "block";

    try {
      // Flask Backend /generate 엔드포인트로 POST 요청 전송
      const response = await fetch("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          role: role,
          experience: experience,
          projects: projects,
          tone: tone,
          prompt_type: promptType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // 서버에서 반환된 오류 메시지 처리
        throw new Error(data.error || "이력서 생성 중 서버 오류가 발생했습니다.");
      }

      // 원본 마크다운 텍스트 저장
      currentMarkdown = data.content;

      // 마크다운을 예쁜 HTML로 렌더링하여 화면에 출력
      if (typeof marked !== "undefined" && marked.parse) {
        resultText.innerHTML = marked.parse(currentMarkdown);
      } else {
        resultText.textContent = currentMarkdown;
      }

      resultContainer.style.display = "block";
      actionButtons.style.display = "flex";

    } catch (err) {
      console.error("이력서 생성 요청 오류:", err);
      showError(err.message || "서버와 통신하는 중 문제가 발생했습니다. 백엔드 로그를 확인해 주세요.");
      emptyState.style.display = "block"; // 오류 시 대기 상태 복구
    } finally {
      // 로딩 종료 및 버튼 복구
      loadingIndicator.style.display = "none";
      generateBtn.disabled = false;
      generateBtn.textContent = "✨ AI 이력서 & 포트폴리오 생성";
    }
  });

  // 5. 클립보드 복사 기능 (원본 마크다운 텍스트 복사)
  copyBtn.addEventListener("click", async () => {
    if (!currentMarkdown) return;

    try {
      await navigator.clipboard.writeText(currentMarkdown);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "✅ 복사 완료!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
      alert("클립보드 복사에 실패했습니다. 직접 텍스트를 드래그하여 복사해 주세요.");
    }
  });

  // 6. Markdown(.md) 파일 다운로드 기능
  downloadBtn.addEventListener("click", () => {
    if (!currentMarkdown) return;

    const applicantName = document.getElementById("name").value.trim() || "지원자";
    const filename = `이력서_포트폴리오_${applicantName}.md`;

    // 마크다운 Blob 생성 및 가상 다운로드 링크 트리거
    const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
