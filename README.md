# 토지이용계획 중간고사 학습 사이트

https://sngb05.github.io/landuse-midterm/

- 노트: 0~4강, 7강 요약 + 아이패드 손필기 (5·6강 자료 없음)
- 퀴즈: 객관식, OX, 빈칸, 서술형 125문항. 진도는 브라우저에 저장됨
- 계산 연습: 도시영향권 경계, 총주거용지 면적
- 기출: 2023~2025 중간고사와 답

## 내용 고치기

`src/notes/*.md`(노트)와 `src/quiz/*.json`(퀴즈)을 고친 뒤 데이터를 다시 만든다.

```bash
pip install markdown-it-py
python3 tools/build.py src .
```

`data/content.js`가 새로 만들어진다. 커밋하고 푸시하면 1분쯤 뒤 사이트에 반영된다.
