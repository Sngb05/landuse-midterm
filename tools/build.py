"""Merge lecture notes (markdown), quiz JSON and past exams into study-site/data/content.js."""
import json
import re
import sys
from pathlib import Path

from markdown_it import MarkdownIt

SRC = Path(sys.argv[1])
SITE = Path(sys.argv[2])
NOTES = SRC / "notes"
QUIZ = SRC / "quiz"

# There is no lecture 5 in this course.
LECTURES = [
    ("0", "0강", "강의계획·시험 정보", "시험 정보"),
    ("1", "1강", "토지개념 및 역할", "토지개념"),
    ("2", "2강", "토지이용관련이론", "이론"),
    ("3", "3강", "토지이용규제", "규제"),
    ("4", "4강", "용도지역제", "용도지역제"),
    ("6", "6강", "도시활동 수요분석", "수요분석"),
    ("7", "7강", "도면작성법 및 실습", "도면"),
]

SECTION_LABELS = {
    "주요 질문": "주요 질문",
    "핵심 정리": "핵심 정리",
    "손필기 모음": "✍ 필기",
    "기출 연결": "★ 기출",
    "예상 문제": "예상 문제",
}

HOT = [
    {"title": "토지의 특성 (위치고정성·부증성·연접성)", "years": [2024, 2025], "href": "#note1"},
    {"title": "미국에서 개인 토지소유권이 강해진 이유", "years": [2024, 2025], "href": "#note3"},
    {"title": "인구추정모형 빈칸 (로지스틱·지수·조성법)", "years": [2024, 2025], "href": "#note6"},
    {"title": "도시영향권 경계 계산", "years": [2024, 2025], "href": "#calc"},
    {"title": "White Zone·공간혁신구역", "years": [2023, 2024, 2025], "href": "#note4"},
    {"title": "용도지역제 (유클리드조닝·재산가치론·지역/지구/구역)", "years": [2023, 2024, 2025], "href": "#note4"},
    {"title": "주거지 입지이론 (동심원·선상지대)", "years": [2023, 2025], "href": "#note2"},
    {"title": "15분 도시", "years": [2024, 2025], "href": "#note2"},
    {"title": "보너스: 직접 문제 내고 답하기", "years": ["매년"], "href": "#exams2025"},
]

BONUS_TIP = ("공식 답은 없어요. 노트의 '예상 문제'에서 골라 쓰면 돼요.\n"
             "· 3강 개발부담금(Development Charge): 필기에 '매우 중요, 정의 쓸 수 있어야 함'\n"
             "· 2강 Murdie(1969)의 3요소, 합리주의 vs 점진주의\n"
             "· 4강 대런던계획 4-Ring, Incentive Zoning")

EXAMS = [
    {"year": 2025, "info": "2025년 2학기 · 각 3점, 총 30점 · 1~3, 6~9번은 교수님 모범답안", "items": [
        {"no": "1", "q": "토지의 다음 특성에 대해 설명하시오.\n위치고정성, 부증성, 연접성", "official": True, "lec": "1",
         "a": "위치고정성: 토지는 위치가 고정되어 있어 모두 다른 특성을 가지고 있음, 가격형성의 국지성\n부증성: 토지는 증가시킬 수 없어 공급비탄력, 토지수급 문제\n연접성: 인접토지이용과 영향 주고받음, 외부효과"},
        {"no": "2", "q": "15분 도시에 대한 다음 질문에 답하시오.\n1) 15분 도시의 반경이 1.2km가 아니라 1.6km인 이유는?\n2) 이 개념을 받아들여 '2040 서울 도시기본계획'에서 도입한 개념은 무엇인가?\n3) 이 제안을 한 사람은 누구인가?", "official": True, "lec": "2",
         "a": "1) 자전거로 5분은 1.6km (도보 15분은 약 1.2km)\n2) 보행일상권\n3) Carlos Moreno (모레노)"},
        {"no": "3", "q": "경부고속도로를 따라 고급주거지가 형성되는 현상을 '선상지대이론'으로 설명하고 그에 해당하는 주거지의 예를 들어보시오.", "official": True, "lec": "2",
         "a": "선상지대이론에서는 현존하는 가장 빠른 교통로를 따라서 고임대료 주거지가 발달한다고 하였는데, 서울에서는 경부고속도로가 바로 이에 해당하며, 압구정동, 반포동, 도곡동, 대치동 등이 여기에 해당함"},
        {"no": "4", "q": "우리나라의 중요한 용도지역지구제 3개(용도지역, 용도지구, 용도구역)의 특징을 설명하고 예를 3개씩 들어보시오.", "official": False, "lec": "4",
         "a": "① 용도지역: 토지의 용도·건폐율·용적률·높이 등을 제한하는 가장 기본적인 구분. 전 국토에 서로 중복되지 않게 지정되어 모든 토지에 적용됨\n   예) 주거지역, 상업지역, 공업지역 (녹지·관리·농림·자연환경보전지역)\n② 용도지구: 용도지역의 제한을 강화하거나 완화해 용도지역의 기능을 증진하고 미관·경관·안전 등을 도모. 필요한 곳에 덧씌워 지정해 용도지역을 보완 (9개)\n   예) 경관지구, 고도지구, 방화지구\n③ 용도구역: 용도지역·지구를 보완하는 특수 목적 구분. 무질서한 확산 방지, 시가화 유보 등 (7개)\n   예) 개발제한구역, 시가화조정구역, 도시자연공원구역\n한 줄: 지역은 기본 구분(중복 불가), 지구는 지역의 제한을 강화·완화, 구역은 지역·지구를 보완하는 특수 목적"},
        {"no": "5", "q": "다음 조건에 적합한 총주거용지 면적을 구하시오.\n가) 계획 주택호수(가구수): 10,000 가구\n나) 1가구당 주택 면적 또는 평균주택규모: 70㎡\n다) 목표 주택보급률: 110%\n라) 계획 용적률: 200%\n마) 계획 공공용지율: 30%", "official": False, "lec": "7",
         "a": "필요 주택 수 = 10,000 × 1.1 = 11,000호\n주택 연면적 = 11,000 × 70㎡ = 770,000㎡\n순주거용지 = 770,000 ÷ 2.0 = 385,000㎡\n총주거용지 = 385,000 ÷ (1 − 0.3) = 550,000㎡ = 55ha\n(7강 실습도면 p24·p27 계산식 기준. 보급률을 곱하는 단계는 슬라이드에 없어 일반적인 풀이를 따름. 빼면 50ha)"},
        {"no": "6", "q": "유럽과 달리 미국에서 토지의 개인소유권 및 이용권이 강화된 이유에 대해 설명하시오.", "official": True, "lec": "3",
         "a": "유럽에서 여러 가지 핍박을 받고 이주한 사람들이 많아서 토지소유에 대한 의지가 강했음\n목숨 걸고 확보한 땅이며, 토지를 바탕으로 새로 시작해야 하므로 토지소유권은 목숨과도 같은 것이었음"},
        {"no": "7", "q": "다음 두 도시의 정보가 아래와 같을 때, 도시영향권의 경계는 어디에서 생기는지 계산해 보시오.\n(도시인구: A 100만명, B 64만명, 두 도시간 거리 36km)", "official": True, "lec": "6",
         "a": "A로부터 20km 지점\n풀이: 36 ÷ (1 + √(64/100)) = 36 ÷ 1.8 = 20km"},
        {"no": "8", "q": "융복합 도시공간 조성을 위한 공간혁신구역 3종은 한국형 white zone인 (   ), 보스톤 혁신지구처럼 직주락 복합용도를 계획하는 (   ), 기반시설의 입체복합활용을 위한 (   )이다.", "official": True, "lec": "4",
         "a": "(도시혁신구역), (복합용도구역), (도시계획시설입체복합구역)"},
        {"no": "9", "q": "인구추정모형에서 가장 장기적인 추세를 추정할 때 쓰는 모형은 (   )모형이고, 도시성장 초기에 급격히 증가하는 도시에는 (   )모형을 적용하고, 출생률과 사망률 등을 이용하는 추정법을 (   )이라 부른다.", "official": True, "lec": "6",
         "a": "(로지스틱), (지수), (조성법, 생잔법)"},
        {"no": "10", "q": "열심히 공부했는데 나오지 않은 문제를 직접 내고 답을 달아보시오. (1~3점)", "official": False, "lec": None, "a": BONUS_TIP},
    ]},
    {"year": 2024, "info": "2024년 2학기 · 각 3점, 총 30점 · 교수님 모범답안", "items": [
        {"no": "1", "q": "토지의 다음 특성에 대해 설명하시오.\n위치고정성, 부증성, 연접성", "official": True, "lec": "1",
         "a": "위치고정성: 토지는 위치가 고정되어 있어 모두 다른 특성을 가지고 있음, 가격형성의 국지성\n부증성: 토지는 증가시킬 수 없어 공급비탄력, 토지수급 문제\n연접성: 인접토지이용과 영향 주고받음, 외부효과"},
        {"no": "2", "q": "토지이용계획과 도시계획과의 관계에 대해 '미국적 시각'과 '유럽적 시각'의 차이를 설명하시오.", "official": True, "lec": "1",
         "a": "토지이용계획의 개념: 계획구역 내의 토지를 어떻게 이용할 것인가를 결정\n미국적 시각: 교통/시설계획과 상호 긴밀한 관계의 광범위한 도시계획의 부문별계획\n유럽적 시각: 교통/시설계획을 포함하는 종합적 기본계획(독일) 내지 구체적 토지의 이용계획(프랑스)으로 도시계획과 동일"},
        {"no": "3", "q": "다음 3개의 불량주거지의 차이에 대해 설명하시오.\nSlum, Ghetto, Squatter", "official": True, "lec": "2",
         "a": "Slum: 합법적 건축물 → 노후화로 인한 노후 불량주거지\nGhetto: 유대인 집중 거주지 (특정 인종 집중 거주지)\nSquatter: 불법건축물이 집중된 불량주거지"},
        {"no": "4", "q": "최근의 토지이용경향과 관련한 다음 용어를 설명하시오.\nMXD, 15분도시, 압축도시", "official": True, "lec": "2",
         "a": "MXD: 복합개발을 통해 직주근접을 실현. 아자부다이힐스, White Zone\n15분도시: 파리대학 모레노 교수가 제안. 일상적인 생활을 도보 15분 거리 내에서 할 수 있는 보행중심 도시구조\n압축도시: 고밀복합개발을 통해 직주근접을 실행하여 통행량 감소, 에너지소비 감소"},
        {"no": "5", "q": "용도지역제의 목적과 관련하여 다음 두 이론에 대해 설명하시오.\n① 재산가치론  ② 계획이론", "official": True, "lec": "4",
         "a": "① 재산가치론: 용도지역제 초기에 강하게 제기된 이론. 부동산업자, 경제학자, 법률가의 시각. 위해한 토지이용을 분리시켜 토지소유자의 재산가치를 보호해주는 수단. 예) 님비시설의 규제, 최소대지면적의 규제\n② 계획이론: 최근 들어 보다 중요해진 시각, 계획가의 시각. 장기적이고 포괄적인 도시기본계획 및 토지이용계획의 실현수단. 민간부문에서 제공되지 않는 공원, 녹지 등의 쾌적성 제공의 수단"},
        {"no": "6", "q": "유럽과 달리 미국에서 토지의 개인소유권 및 이용권이 강화된 이유에 대해 설명하시오.", "official": True, "lec": "3",
         "a": "유럽에서 여러 가지 핍박을 받고 이주한 사람들이 많아서 토지소유에 대한 의지가 강했음\n목숨 걸고 확보한 땅이며, 토지를 바탕으로 새로 시작해야 하므로 토지소유권은 목숨과도 같은 것이었음"},
        {"no": "7", "q": "다음 두 도시의 정보가 아래와 같을 때, 도시영향권의 경계는 어디에서 생기는지 계산해 보시오.\n(도시인구: A 100만명, B 36만명, 두 도시간 거리 20km)", "official": True, "lec": "6",
         "a": "12.5km (A로부터)\n풀이: 20 ÷ (1 + √(36/100)) = 20 ÷ 1.6 = 12.5km"},
        {"no": "8", "q": "용도지역제는 (   ) 주변의 공장을 규제하기 위해 독일에서 처음 시작되었다. 이후 미국 (   ) 마을에서 부동산회사와 의회간의 소송에서 의회의 손을 들어줌으로써 정착되었다. 최근 우리나라는 모든 용도를 허용하는 싱가폴의 (   )을 도입하여 복합개발을 유도하고 있다.", "official": True, "lec": "4",
         "a": "(라인강), (유클리드), (White Zone)"},
        {"no": "9", "q": "인구추정모형에서 가장 장기적인 추세를 추정할 때 쓰는 모형은 (   )모형이고, 도시성장 초기에 급격히 증가하는 도시에는 (   )모형을 적용하고, 출생률과 사망률 등을 이용하는 추정법을 (   )이라 부른다.", "official": True, "lec": "6",
         "a": "(로지스틱), (지수), (조성법, 생잔법)"},
        {"no": "10", "q": "열심히 공부했는데 나오지 않은 문제를 직접 내고 답을 달아보시오. (1~3점)", "official": False, "lec": None, "a": BONUS_TIP},
    ]},
    {"year": 2023, "info": "2023년 2학기 · 각 5점 · 답안 파일이 없어 노트로 정리한 답이에요", "items": [
        {"no": "1", "q": "토지이용의 3요소에 대해서 적고, 각각의 요소별로 어떤 내용을 토지이용계획에서 고려해야 하는지 설명하시오.", "official": False, "lec": "1",
         "a": "① 종류: 어떤 토지이용이 필요한가 → 지목, 용도지역\n② 규모: 얼만큼 필요한가 → 면적, 밀도, 층고\n③ 위치: 어디에 필요한가 → 지리적·물리적·가치적·사회적 위치"},
        {"no": "2", "q": "근로자(저소득층) 주거지와 고급주거지 위치에 대해서 동심원 이론과 선상지대이론의 차이점을 비교하여 설명하시오.\n① 근로자주거지  ② 고급주거지", "official": False, "lec": "2",
         "a": "① 근로자주거지: 동심원이론(Burgess, 1925)에서는 CBD와 점이지대를 둘러싼 3지대(근로자 주거지대)에 원형 띠로 위치해 도심에 가까움. 선상지대이론(Hoyt, 1939)에서는 도심 및 도매·경공업지구와 접한 부채꼴 섹터에 위치해 도심에서 외곽까지 쐐기형으로 뻗음\n② 고급주거지: 동심원이론에서는 외곽의 4지대(주거지대)~5지대(통근자지대)에 원형으로 위치. 선상지대이론에서는 가장 빠른 교통로, 고지대, 수변 방향으로 선형 섹터를 이루며 외곽으로 성장\n핵심: 동심원 = 도심으로부터의 거리, 선상지대 = 교통축의 방향"},
        {"no": "3", "q": "다음의 용도지역(제)를 설명하시오.\n① 유동지역제  ② White Zone  ③ 행위기준지역제  ④ 유클리드조닝", "official": False, "lec": "4",
         "a": "① 유동지역제(Floating Zoning): 용도상 필요한 규정만 정해두고 도면상 위치 결정은 유보. 개발자의 구체적 제안이 들어오면 지자체와 협의해 배치\n② White Zone: 싱가포르 URA가 도입. 상업·주거·호텔 등 여러 용도를 유연하게 복합 개발 가능. 직주락 공존, 사례 Marina Bay Sands. 우리나라 도시혁신구역의 모델\n③ 행위기준지역제(Performance Zoning): 토지이용 구분은 유지하되 새 개발이 주변에 끼치는 물리·사회·경제·환경적 영향에 대한 행위기준을 설정해 규제\n④ 유클리드조닝(Euclidean Zoning): 1926년 Euclid v. Ambler Realty 판결로 정착한 미국의 전통적 용도지역제. 주거·상업·공업 등 배타적 단일 용도로 분리, 누적적 위계, 건물 규모·높이·후퇴거리 규제\n(4강 필기: 영어는 스펠링을 정확히 써야 함)"},
        {"no": "4", "q": "현장견학 했던 '판교 알파돔'에 대한 다음 질문에 답하시오.\n① '알파돔'이란 이름이 붙여진 이유와 현재 개발된 상황이 이름에 걸맞는 공간을 만들지 못했다고 평가할 수 있는 이유는?\n② 중앙 광장을 둘러싼 건물들의 상업시설이 크게 성공하지 못한 이유는?\n③ 마지막 방문한 상가의 공실이 많은 이유를 '주상복합건물'의 법적인 규제 차원에서 설명하시오.", "official": False, "lec": "0",
         "a": "그해 현장견학 내용이라 강의자료에는 답이 없어요.\n올해는 10/12 정비사업구역(성수전략정비구역 등) 견학이 있었으니 그때 들은 내용(사업 과정, 문제점, 법적 규제)을 정리해 두세요.\n참고: 7강 p15 판교신도시 토지이용계획표에 상업업무용지 7.63%, 주상복합 0.95%가 나와요."},
        {"no": "5", "q": "유럽과 우리나라에서 역사적으로 토지소유권에 대한 철학이 바뀌어온 과정에서 나타난 공통점과 차이점에 대해 설명하시오.\n① 프랑스혁명에서는 토지소유권에 대해 어떠한 태도를 취하고 있나?\n② 근대적 소유권에 비해 현대적 소유권에서 규제를 강화한 이유는 무엇인가?", "official": False, "lec": "3",
         "a": "공통점: 둘 다 왕토사상에서 출발해 근대적 절대 사유권을 거쳐 현대적(사회적 구속) 소유권으로 바뀜\n차이점: 유럽은 시민혁명이라는 내부 계기로 소유권을 쟁취, 한국은 일제강점기 조선민사령·토지조사령(1912)으로 외부에서 이식\n① 프랑스혁명: 왕토사상을 깨고 개인소유권의 절대성 인정. 인권선언(1789) 17조 '불가침적이고 신성한 권리', 공공 필요와 정당한 사전 보상이 있을 때만 침탈 가능\n② 절대적 사유권이 빈부격차, 지가상승, 난개발 등 자본주의 부작용을 낳았기 때문. 유럽은 바이마르헌법(1919)으로 소유권의 사회적 구속, 한국은 토지공개념과 용도지역지구제·도시계획·지구단위계획으로 사유재산권을 일부 제한"},
        {"no": "6", "q": "(보너스) 열심히 공부했는데 나오지 않은 문제를 스스로 내고 답안을 작성하시오. (2~5점)", "official": False, "lec": None, "a": BONUS_TIP},
    ]},
]

NOTICE = ("5강은 원래 없는 강의예요. 노트의 페이지 표기(p12)는 PDF 쪽 번호라 "
          "0~4강, 7강은 슬라이드 아래 번호보다 1 커요.")

md = MarkdownIt("commonmark", {"html": False}).enable("table")
PAGE_RUN = r"p\d+(?:\s*[,~–\-·]\s*p?\d+)*"


def preprocess(text):
    lines = text.splitlines()
    out = []
    for i, line in enumerate(lines):
        prev = out[-1] if out else ""
        if prev.lstrip().startswith("|") and line.strip() and not line.lstrip().startswith("|"):
            out.append("")
        out.append(line)
    return "\n".join(out)


def decorate(html, in_hand_section):
    if in_hand_section:
        html = re.sub(r"(?:&quot;|“)(.+?)(?:&quot;|”)", r'<span class="hand">\1</span>', html)
    html = re.sub(r"✍️?\s*(?:&quot;|“)(.+?)(?:&quot;|”)",
                  r'<span class="hand-mark" aria-label="필기">✍</span> <span class="hand">\1</span>', html)
    html = re.sub(r"✍️?", '<span class="hand-mark" aria-label="필기">✍</span>', html)
    html = re.sub(r"★\s*기출\s*(\d{4})", r'<span class="tag tag-gichul">★ 기출 \1</span>', html)
    html = html.replace("(보충)", '<span class="tag tag-sup">보충</span>')
    html = re.sub(r"\((" + PAGE_RUN + r")\)", r'<span class="pg">\1</span>', html)
    html = re.sub(r"(→\s*)(" + PAGE_RUN + r")(?![\w])", r'\1<span class="pg">\2</span>', html)
    html = re.sub(r"<table>", '<div class="tbl"><table>', html)
    html = re.sub(r"</table>", "</table></div>", html)
    return html


def render_note(lec_id, text):
    text = text.strip()
    summary = ""
    body = []
    for line in text.splitlines():
        if line.startswith("# ") and not body:
            continue
        if line.startswith("> ") and not summary and not any(l.strip() for l in body):
            summary = line[2:].strip()
            continue
        body.append(line)
    text = preprocess("\n".join(body))

    chunks = re.split(r"(?m)^(?=## )", text)
    html_parts, sections = [], []
    hand_count = gichul_count = 0
    for chunk in chunks:
        if not chunk.strip():
            continue
        m = re.match(r"## (.+)", chunk)
        if not m:
            html_parts.append(decorate(md.render(chunk), False))
            continue
        heading = m.group(1).strip()
        plain = re.sub(r"[★✍️]\s*기출\s*\d{4}|★기출\d{4}", "", heading).strip()
        sid = f"s{lec_id}-{len(sections) + 1}"
        label = SECTION_LABELS.get(plain, plain if len(plain) <= 10 else plain[:10] + "…")
        sections.append({"id": sid, "label": label})
        is_hand = plain.startswith("손필기")
        rest = chunk[m.end():]
        inner = decorate(md.render(rest), is_hand)
        if is_hand:
            items = re.findall(r"<li>(.*?)</li>", inner, re.S)
            hand_count = len([i for i in items if "없음" not in i])
        if plain.startswith("기출 연결"):
            gichul_count = len([l for l in rest.splitlines() if l.startswith("- ") and "보너스" not in l])
        cls = ' class="hand-sec"' if is_hand else ""
        html_parts.append(f'<section{cls}><h2 id="{sid}">{decorate(md.render(heading).strip()[3:-4], False)}</h2>{inner}</section>')
    return summary, "".join(html_parts), sections, hand_count, gichul_count


def check_quiz(items):
    problems = []
    for q in items:
        t = q.get("type")
        if t == "mcq" and not (0 <= q.get("answer", -1) < len(q.get("choices", []))):
            problems.append(f"{q['id']}: mcq answer out of range")
        if t == "blank":
            n = len(set(re.findall(r"\{\{(\d+)\}\}", q["q"])))
            if n != len(q.get("blanks", [])):
                problems.append(f"{q['id']}: {n} placeholders vs {len(q.get('blanks', []))} blanks")
        if t == "ox" and not isinstance(q.get("answer"), bool):
            problems.append(f"{q['id']}: ox answer not bool")
        if t == "essay" and not q.get("answer"):
            problems.append(f"{q['id']}: essay without answer")
        if t not in ("mcq", "ox", "blank", "essay"):
            problems.append(f"{q['id']}: unknown type {t}")
        q.setdefault("tags", [])
        q.setdefault("page", "")
        q.setdefault("explain", "")
    return problems


lectures, quiz = [], []
for lec_id, label, title, short in LECTURES:
    text = (NOTES / f"{lec_id}강.md").read_text(encoding="utf-8")
    summary, html, sections, hand, gichul = render_note(lec_id, text)
    lectures.append({"id": lec_id, "label": label, "title": title, "short": short, "summary": summary,
                     "html": html, "sections": sections, "counts": {"hand": hand, "gichul": gichul}})
    qf = QUIZ / f"{lec_id}강.json"
    items = json.loads(qf.read_text(encoding="utf-8"))["items"] if qf.exists() else []
    for q in items:
        q["lec"] = lec_id
    quiz.extend(items)

problems = check_quiz(quiz)
ids = [q["id"] for q in quiz]
dupes = {i for i in ids if ids.count(i) > 1}
if dupes:
    problems.append(f"duplicate ids: {sorted(dupes)}")

data = {"meta": {"notice": NOTICE}, "lectures": lectures, "quiz": quiz, "exams": EXAMS, "hot": HOT}
out = SITE / "data" / "content.js"
out.write_text("window.DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")

print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
for l in lectures:
    n = sum(1 for q in quiz if q["lec"] == l["id"])
    print(f"  {l['label']:<4} sections={len(l['sections'])} hand={l['counts']['hand']} gichul={l['counts']['gichul']} quiz={n}")
by_type = {}
for q in quiz:
    by_type[q["type"]] = by_type.get(q["type"], 0) + 1
print("  quiz total", len(quiz), by_type)
print("problems:", problems or "none")
