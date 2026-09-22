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

  // ==========================================================================
  // 7. PWA 앱 설치 컨트롤러 (안드로이드, iOS, 데스크톱 호환)
  // ==========================================================================
  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) || 
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // 현재 앱이 이미 설치되어 단독 실행 중인지 확인
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                       window.navigator.standalone === true || 
                       document.referrer.includes("android-app://");

  const headerInstallBtn = document.getElementById("headerInstallBtn");
  const pwaInstallBanner = document.getElementById("pwaInstallBanner");
  const pwaBannerInstallBtn = document.getElementById("pwaBannerInstallBtn");
  const pwaBannerCloseBtn = document.getElementById("pwaBannerCloseBtn");

  const pwaInstallModal = document.getElementById("pwaInstallModal");
  const pwaModalCloseBtn = document.getElementById("pwaModalCloseBtn");
  const pwaModalConfirmBtn = document.getElementById("pwaModalConfirmBtn");
  const pwaDirectInstallBtn = document.getElementById("pwaDirectInstallBtn");
  const pwaManualAndroidGuide = document.getElementById("pwaManualAndroidGuide");

  const tabAndroidBtn = document.getElementById("tabAndroidBtn");
  const tabIosBtn = document.getElementById("tabIosBtn");
  const panelAndroid = document.getElementById("panelAndroid");
  const panelIos = document.getElementById("panelIos");

  // 모달 열기 함수
  function openInstallModal() {
    if (!pwaInstallModal) return;

    if (isIOS) {
      // iOS인 경우 iOS 안내 탭 활성화
      switchTab("ios");
    } else {
      // 안드로이드 및 데스크톱 기본 활성화
      switchTab("android");
      // prompt가 준비되지 않은 브라우저(PC 등)는 수동 안내 표시
      if (!deferredPrompt && pwaManualAndroidGuide) {
        pwaManualAndroidGuide.style.display = "block";
      }
    }

    pwaInstallModal.style.display = "flex";
  }

  // 모달 닫기 함수
  function closeInstallModal() {
    if (pwaInstallModal) {
      pwaInstallModal.style.display = "none";
    }
  }

  // 탭 전환 함수
  function switchTab(type) {
    if (type === "ios") {
      tabIosBtn?.classList.add("active");
      tabAndroidBtn?.classList.remove("active");
      panelIos?.classList.add("active");
      panelAndroid?.classList.remove("active");
    } else {
      tabAndroidBtn?.classList.add("active");
      tabIosBtn?.classList.remove("active");
      panelAndroid?.classList.add("active");
      panelIos?.classList.remove("active");
    }
  }

  // 탭 클릭 이벤트
  tabAndroidBtn?.addEventListener("click", () => switchTab("android"));
  tabIosBtn?.addEventListener("click", () => switchTab("ios"));

  // 모달 닫기 이벤트
  pwaModalCloseBtn?.addEventListener("click", closeInstallModal);
  pwaModalConfirmBtn?.addEventListener("click", closeInstallModal);
  pwaInstallModal?.addEventListener("click", (e) => {
    if (e.target === pwaInstallModal) {
      closeInstallModal();
    }
  });

  // 헤더 및 배너의 [앱 설치] 버튼 클릭 시 모달 열기
  headerInstallBtn?.addEventListener("click", openInstallModal);
  pwaBannerInstallBtn?.addEventListener("click", openInstallModal);

  // 플로팅 배너 닫기 버튼
  pwaBannerCloseBtn?.addEventListener("click", () => {
    if (pwaInstallBanner) {
      pwaInstallBanner.style.display = "none";
      sessionStorage.setItem("pwaBannerDismissed", "true");
    }
  });

  // 모달 내부 [지금 바로 앱 설치하기] 버튼 클릭 시 브라우저 설치 팝업 트리거
  pwaDirectInstallBtn?.addEventListener("click", async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        console.log("PWA 설치 사용자 선택 결과:", choiceResult.outcome);

        if (choiceResult.outcome === "accepted") {
          closeInstallModal();
          if (pwaInstallBanner) pwaInstallBanner.style.display = "none";
          deferredPrompt = null;
        }
      } catch (err) {
        console.error("앱 설치 프롬프트 실행 중 오류:", err);
      }
    } else {
      // 프롬프트 이벤트가 없을 경우 수동 설치 안내 표시
      if (pwaManualAndroidGuide) {
        pwaManualAndroidGuide.style.display = "block";
        pwaManualAndroidGuide.scrollIntoView({ behavior: "smooth" });
      }
    }
  });

  // 이미 독립형 앱으로 실행 중인 경우
  if (isStandalone) {
    if (headerInstallBtn) {
      headerInstallBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-label">앱 실행 중</span>';
      headerInstallBtn.style.opacity = "0.85";
      headerInstallBtn.style.cursor = "default";
      headerInstallBtn.onclick = (e) => e.preventDefault();
    }
    if (pwaInstallBanner) {
      pwaInstallBanner.style.display = "none";
    }
  } else {
    // 사이트 진입 시 플로팅 배너 표시 (세션에서 닫지 않은 경우)
    const isDismissed = sessionStorage.getItem("pwaBannerDismissed") === "true";
    if (!isDismissed && pwaInstallBanner) {
      setTimeout(() => {
        pwaInstallBanner.style.display = "flex";
      }, 700);
    }
  }

  // 브라우저의 beforeinstallprompt 이벤트 가로채기 (안드로이드 크롬, 엣지, 삼성인터넷 등)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("PWA beforeinstallprompt 감지됨: 설치 준비 완료");

    if (!isStandalone) {
      if (headerInstallBtn) headerInstallBtn.style.display = "inline-flex";
      const isDismissed = sessionStorage.getItem("pwaBannerDismissed") === "true";
      if (!isDismissed && pwaInstallBanner) {
        pwaInstallBanner.style.display = "flex";
      }
    }
  });

  // 앱 설치 완료 이벤트 리스너
  window.addEventListener("appinstalled", () => {
    console.log("PWA가 성공적으로 설치되었습니다.");
    if (pwaInstallBanner) pwaInstallBanner.style.display = "none";
    if (headerInstallBtn) {
      headerInstallBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-label">설치 완료</span>';
    }
    closeInstallModal();
    deferredPrompt = null;
    alert("🎉 AI Resume & Portfolio Builder 앱이 성공적으로 설치되었습니다!");
  });
});
