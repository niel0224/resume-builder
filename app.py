import os
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import google.generativeai as genai

# 1. 환경변수(.env) 로드
load_dotenv()

# 2. 로깅 설정 (요청, 응답, 오류 출력)
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)
logger = logging.getLogger(__name__)

# 3. Flask 앱 초기화 (Vercel Serverless 및 로컬 공통 절대 경로 설정)
base_dir = os.path.abspath(os.path.dirname(__file__))
app = Flask(
    __name__,
    template_folder=os.path.join(base_dir, "templates"),
    static_folder=os.path.join(base_dir, "static")
)

# 4. Gemini API 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
    logger.warning("경고: GEMINI_API_KEY가 .env 파일에 올바르게 설정되지 않았습니다.")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API가 성공적으로 설정되었습니다.")


@app.route("/")
def index():
    """메인 페이지 화면 렌더링"""
    logger.info("메인 페이지(/) 접속 요청 수신")
    return render_template("index.html")


@app.route("/manifest.json")
def manifest():
    """PWA 웹 앱 매니페스트 서빙"""
    return app.send_static_file("manifest.json")


@app.route("/sw.js")
def service_worker():
    """PWA 서비스 워커 스크립트 서빙 (루트 스코프 허용 헤더 포함)"""
    response = app.send_static_file("sw.js")
    response.headers["Content-Type"] = "application/javascript"
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.route("/generate", methods=["POST"])
def generate():
    """
    사용자 입력을 바탕으로 Gemini API를 호출하여
    이력서와 포트폴리오 초안을 생성하는 API 엔드포인트
    """
    logger.info("이력서 생성 요청(/generate) 수신")

    # 1. 요청 데이터 파싱 및 검증
    try:
        data = request.get_json()
    except Exception as e:
        logger.error(f"JSON 파싱 실패: {str(e)}")
        return jsonify({"error": "요청 형식이 올바른 JSON이 아닙니다."}), 400

    if not data:
        logger.warning("빈 요청 데이터 수신")
        return jsonify({"error": "입력 데이터가 비어 있습니다."}), 400

    # 2. 필수 필드 추출 및 백엔드 검증
    name = data.get("name", "").strip()
    role = data.get("role", "").strip()
    experience = data.get("experience", "").strip()
    projects = data.get("projects", "").strip()
    tone = data.get("tone", "전문적이고 신뢰감 있는 어조").strip()
    prompt_type = data.get("prompt_type", "A").strip().upper()

    missing_fields = []
    if not name:
        missing_fields.append("이름")
    if not role:
        missing_fields.append("지원 직무")
    if not experience:
        missing_fields.append("경력 사항")
    if not projects:
        missing_fields.append("프로젝트 경험")

    if missing_fields:
        error_msg = f"다음 필수 항목을 입력해 주세요: {', '.join(missing_fields)}"
        logger.warning(f"입력 검증 실패: {error_msg}")
        return jsonify({"error": error_msg}), 400

    # 3. Gemini API Key 유효성 검증
    current_key = os.getenv("GEMINI_API_KEY")
    if not current_key or current_key == "your_gemini_api_key_here":
        error_msg = ".env 파일에 GEMINI_API_KEY가 설정되지 않았습니다. API 키를 확인해 주세요."
        logger.error(error_msg)
        return jsonify({"error": error_msg}), 500

    # 4. 프롬프트 엔지니어링 (Prompt A: 일반형 / Prompt B: 전문가형)
    logger.info(f"프롬프트 구성 시작 - 대상: {name}, 직무: {role}, 모드: Prompt {prompt_type}")

    if prompt_type == "B":
        # Prompt B: 전문가형 (대학교수, 연구원, 임원급 고도화 프롬프트)
        system_instruction = (
            "당신은 최고 권위의 학술·비즈니스 채용 심사위원이자 헤드헌팅 디렉터입니다.\n"
            "지원자의 경력과 프로젝트를 학술적 권위와 실무 혁신성이 결합된 최고급 '교수 임용 및 전문가 포트폴리오'로 가공하세요.\n"
            "단순 나열을 지양하고, 구체적인 성과 지표(Metrics), STAR/TAR 문제해결 구조, 역량 매트릭스 표, 품격 있는 교육 철학을 반드시 포함하세요."
        )
        prompt = f"""{system_instruction}

[지원자 기본 정보]
- 이름: {name}
- 지원 직무: {role}
- 경력 사항:
{experience}

- 핵심 프로젝트 및 성과:
{projects}

[작성 및 출력 가이드라인]
반드시 다음 구조와 서식을 준수하여 완벽한 마크다운(Markdown) 문서로 작성하세요:

# [이력서] {name} ({role})
`전문 분야: {role}` | `문체: {tone}`

---

## 1. 프로필 요약 (Executive Summary)
학술적 권위와 산업 실무 혁신성을 아우르는 깊이 있는 요약문 (3~4문장으로 완성도 높게 서술)

---

## 2. 핵심 역량 매트릭스 (Core Competencies)
지원자의 역량을 한눈에 보여주는 마크다운 표(Table)로 작성:
| 핵심 영역 | 세부 전문성 | 학술 및 산업 기여도 |
| :--- | :--- | :--- |
(3~4개 핵심 행 작성)

---

## 3. 주요 경력 사항 (Professional & Academic Experience)
입력된 경력을 최신순으로 정돈하고, 각 경력별 주요 역할과 구체적인 성과를 글머리 기호로 상세 기술

---

# [포트폴리오] 핵심 프로젝트 및 연구 성과 (Selected Projects)

입력된 프로젝트들을 아래 STAR/TAR 구조로 전문성 있게 심층 분석하여 서술:
### 프로젝트명 (예: AutoTax, FIN TOOL 등)
* **배경 및 목표 (Task):** 해결하고자 한 산업/학술적 과제 및 목표
* **수행 내용 및 혁신성 (Action):** 적용 기술, AI/데이터 융합 아키텍처, 독창적 접근법
* **정량·정성 성과 (Result):** 수치화된 성과(예: 효율 40% 개선, 오차율 0% 등) 및 파급 효과

---

## 4. 담당 가능 추천 교과목 (Teaching Capabilities)
지원 직무와 관련된 대학/대학원 개설 추천 교과목 3~4개 제시

---

## 5. 교육관 및 직업 철학 (Statement of Philosophy)
> "인상 깊은 핵심 교육/직업 철학 슬로건을 인용구 형태로 작성"

실용주의 교육, 문제 정의 역량, 미래 융합 인재 양성에 대한 지원자의 깊이 있는 교육 철학을 2~3개 단락으로 품격 있게 서술.
"""
    else:
        # Prompt A: 일반형 (기업 및 공공기관 지원용 표준 완성형 이력서)
        system_instruction = (
            "당신은 실력 있는 커리어 전략 컨설턴트입니다.\n"
            "지원자의 역량이 서류 통과율 100%를 달성할 수 있도록, 인사담당자의 시선을 사로잡는 설득력 있고 체계적인 표준 이력서와 포트폴리오를 작성하세요."
        )
        prompt = f"""{system_instruction}

[지원자 기본 정보]
- 이름: {name}
- 지원 직무: {role}
- 경력 사항:
{experience}

- 프로젝트 경험:
{projects}

[작성 및 출력 가이드라인]
마크다운 서식을 적극 활용하여 읽기 쉽고 매력적인 구조로 작성하세요:

# [이력서] {name} - {role} 지원
`직무: {role}` | `어조: {tone}`

---

## 1. 핵심 프로필 (About Me)
지원자의 강점과 직무 적합성을 압축한 매력적인 3줄 소개

---

## 2. 주요 경력 사항 (Experience)
최신순 정돈 및 각 포지션별 주요 업무와 성과를 글머리 기호로 명확히 작성

---

## 3. 직무 핵심 역량 (Key Skills)
| 역량 분류 | 보유 스킬 및 경험 | 실무 활용 수준 |
| :--- | :--- | :--- |
(실무 역량을 요약하는 마크다운 표 포함)

---

# [포트폴리오] 수행 프로젝트 (Key Projects)
입력된 프로젝트를 바탕으로 '프로젝트명', '담당 역할', '주요 성과 및 배운 점'을 항목별로 깔끔하게 정리

---

## 4. 입사 후 포부 및 직무 비전 (Vision)
> "지원자의 직무적 목표를 담은 한 줄 다짐"
지원 직무에서 발휘할 기여 방안 서술.
"""

    # 5. Gemini API 호출
    try:
        genai.configure(api_key=current_key)
        model = genai.GenerativeModel("gemini-3.5-flash-lite")
        
        logger.info("Gemini 모델 호출 중 (gemini-3.5-flash-lite)...")
        response = model.generate_content(prompt)
        
        generated_content = response.text
        logger.info(f"Gemini 응답 생성 성공! (글자 수: {len(generated_content)}자)")

        return jsonify({
            "success": True,
            "content": generated_content
        })

    except Exception as e:
        error_detail = str(e)
        logger.error(f"Gemini API 호출 중 오류 발생: {error_detail}")
        return jsonify({
            "error": f"AI 이력서 생성 중 오류가 발생했습니다: {error_detail}"
        }), 500


if __name__ == "__main__":
    logger.info("AI Resume & Portfolio Builder 서버 시작: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
