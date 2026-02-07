"""
Build data/questions.json from GitHub GCP Generative AI Leader MCQ markdown files.
Optionally merge DocScanner OCR output if it contains real question text.
"""
import json
import os
import re
import sys
from urllib.request import urlopen

# GitHub raw URLs for the 5 MCQ sets
GITHUB_BASE = "https://raw.githubusercontent.com/rajesh-suryaprakash/GCP-Generative-AI-Leader-Certification/main"
SETS = [
    ("GCP's%20Generative%20AI%20Leader/GCP's%20Generative%20AI%20Leader%20MCQ%20Set%201.md", 1, "GitHub Set 1"),
    ("GCP's%20Generative%20AI%20Leader/GCP's%20Generative%20AI%20Leader%20MCQ%20Set%202.md", 2, "GitHub Set 2"),
    ("GCP's%20Generative%20AI%20Leader/GCP's%20Generative%20AI%20Leader%20MCQ%20Set%203.md", 3, "GitHub Set 3"),
    ("GCP's%20Generative%20AI%20Leader/GCP's%20Generative%20AI%20Leader%20MCQ%20Set%204.md", 4, "GitHub Set 4"),
    ("GCP's%20Generative%20AI%20Leader/GCP's%20Generative%20AI%20Leader%20MCQ%20Set%205.md", 5, "GitHub Set 5"),
]

# Section mapping: exam guide 1=30%, 2=35%, 3=20%, 4=15%
# Set 2 has explicit # Section 1/2/3/4. Others we assign by set or default to 1.
SECTION_HEADERS = {
    "fundamentals of gen ai": 1,
    "google cloud's gen ai offerings": 2,
    "techniques to improve gen ai model output": 3,
    "business strategies for a successful gen ai solution": 4,
}


def fetch_md(url: str) -> str:
    with urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_correct_answer(line: str) -> str:
    """Parse **Correct Answer: D** or **Correct Answer: A** and B -> return single or first for multi."""
    m = re.search(r"\*\*Correct Answer:\s*([A-E])(?:\s*and\s*([A-E]))?\s*\*\*", line, re.I)
    if m:
        return m.group(1).upper()
    return ""


def parse_github_set(content: str, set_num: int, source_label: str) -> list:
    questions = []
    # Split by ## N. (question header)
    blocks = re.split(r"\n##\s*\d+\.\s+", content)
    current_section = 1  # default
    for block in blocks:
        block = block.strip()
        if not block or block.startswith("# "):  # skip title or section header
            if "Section 1:" in block or "fundamentals" in block.lower():
                current_section = 1
            elif "Section 2:" in block or "google cloud" in block.lower():
                current_section = 2
            elif "Section 3:" in block or "techniques" in block.lower():
                current_section = 3
            elif "Section 4:" in block or "business" in block.lower():
                current_section = 4
            continue
        lines = block.split("\n")
        question_text = lines[0].strip()
        question_text = re.sub(r"^##\s*\d+\.\s*", "", question_text)
        if not question_text or len(question_text) < 10:
            continue
        options = []
        correct_answer = ""
        explanation = ""
        for line in lines[1:]:
            line_stripped = line.strip()
            # Option: * **A) text** or * **A) text
            opt_m = re.match(r"\*\s*\*\*([A-E])\)\s*(.+?)(?:\*\*)?\s*$", line_stripped)
            if opt_m:
                options.append({"key": opt_m.group(1).upper(), "text": opt_m.group(2).strip().strip("*")})
                continue
            if "**Correct Answer:" in line_stripped:
                correct_answer = parse_correct_answer(line_stripped)
                continue
            if line_stripped.startswith(">"):
                explanation = line_stripped.lstrip("> ").strip()
                continue
        if not options or not correct_answer:
            continue
        # Ensure we have A,B,C,D (or E) in order
        option_keys = [o["key"] for o in options]
        if "A" not in option_keys and options:
            options = [{"key": chr(65 + i), "text": o["text"]} for i, o in enumerate(options)]
        qid = f"github-set{set_num}-{len(questions) + 1}"
        questions.append({
            "id": qid,
            "section": current_section,
            "questionText": question_text,
            "options": options,
            "correctAnswer": correct_answer,
            "explanation": explanation or None,
            "source": source_label,
        })
    return questions


def build_from_github() -> list:
    all_questions = []
    for path_suffix, set_num, source_label in SETS:
        url = f"{GITHUB_BASE}/{path_suffix}"
        print(f"Fetching Set {set_num}...")
        try:
            content = fetch_md(url)
        except Exception as e:
            print(f"  Error: {e}")
            continue
        qs = parse_github_set(content, set_num, source_label)
        # Assign section by set if not already set by header: Set 1->1, Set 2 has headers, Set 3->2, Set 4->4, Set 5->round
        for i, q in enumerate(qs):
            if set_num == 1 and q["section"] == 1:
                pass  # keep
            elif set_num == 3:
                q["section"] = (i % 4) + 1  # spread
            elif set_num == 4:
                q["section"] = 4
            elif set_num == 5:
                q["section"] = (i % 4) + 1
        all_questions.extend(qs)
        print(f"  Parsed {len(qs)} questions.")
    return all_questions


def parse_docscanner_sample(filepath: str) -> list:
    """Parse docscanner_questions_sample.txt: blocks with Question N, paragraph, A. B. C. D. and [CORRECT]."""
    if not os.path.isfile(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    questions = []
    blocks = re.split(r"\n---\s*\n", text)
    for block in blocks:
        block = block.strip()
        if not block or block.startswith("# ") or "DocScanner PDF" in block or "To get all 50" in block:
            continue
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        if re.match(r"Question\s+\d+", lines[0], re.I):
            lines = lines[1:]
        if not lines:
            continue
        question_parts = []
        options = []
        correct = ""
        for line in lines:
            opt_m = re.match(r"^([A-D])\.\s*(.+)$", line, re.I)
            if opt_m:
                key = opt_m.group(1).upper()
                opt_text = opt_m.group(2).strip()
                opt_text = re.sub(r"\s*\[CORRECT\]\s*$", "", opt_text, flags=re.I).strip()
                if "[CORRECT]" in line:
                    correct = key
                options.append({"key": key, "text": opt_text})
            elif not options and len(line) > 15:
                question_parts.append(line)
        question_text = " ".join(question_parts).strip()
        if question_text and len(options) >= 2 and correct:
            n = len(questions) + 1
            questions.append({
                "id": f"docscanner-sample-{n}",
                "section": min(4, n % 4 or 4),
                "questionText": question_text,
                "options": options,
                "correctAnswer": correct,
                "explanation": None,
                "source": "DocScanner (sample)",
            })
    return questions


def parse_docscanner_ocr(filepath: str) -> list:
    """If file has real OCR text (not 'OCR skipped'), parse per-page blocks into questions. Else return [].
    OCR-sourced questions may use the first option as placeholder correct answer when not detected."""
    if not os.path.isfile(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    if "OCR skipped" in text or "(no text detected)" in text:
        if text.count("OCR skipped") > 10:
            return []
    questions = []
    blocks = re.split(r"={40,}\s*\nPage\s+(\d+)\s*\n={40,}", text)
    # Lettered options only when followed by ) . or : (not space), so "A developer..." stays question text
    option_pattern = re.compile(r"^\s*([A-D])[\).:]\s*(.+)$", re.I)
    # OCR bubble markers become ©, ®, | ©, ©., ®. — treat as options and assign A,B,C,D in order
    ocr_option_pattern = re.compile(r"^(?:\|\s*)?[©®]\.?\s*(.+)$")
    skip_pattern = re.compile(r"^(Question\s+\d+|Explain this further|Nästa|Rensa|Logga|Skicka)$", re.I)
    # Skip page header line: "Question N Incorrect/Correct/Skipped ... Explain..."
    def is_header_line(line: str) -> bool:
        if "Question" not in line or "Explain" not in line:
            return False
        return bool(re.search(r"Incorrect|Correct|Skipped", line, re.I))
    for i in range(1, len(blocks), 2):
        if i + 1 >= len(blocks):
            break
        page_num = int(blocks[i])
        body = blocks[i + 1].strip()
        if not body or len(body) < 50 or "OCR skipped" in body:
            continue
        lines = [l.strip() for l in body.split("\n") if l.strip()]
        question_parts = []
        options = []
        correct = ""
        for line in lines:
            if is_header_line(line):
                continue
            opt_m = option_pattern.match(line)
            if opt_m:
                key = opt_m.group(1).upper()
                opt_text = opt_m.group(2).strip()
                opt_text = re.sub(r"\s*\[?CORRECT\]?\s*$", "", opt_text, flags=re.I).strip()
                opt_text = re.sub(r"\s*Your answer is correct\s*$", "", opt_text, flags=re.I).strip()
                opt_text = re.sub(r"\s*Correct answer\s*$", "", opt_text, flags=re.I).strip()
                if "[CORRECT]" in line or re.search(r"(?:your answer is )?correct\s*$", line, re.I):
                    correct = key
                options.append({"key": key, "text": opt_text})
                continue
            ocr_m = ocr_option_pattern.match(line)
            if ocr_m:
                key = chr(65 + len(options)) if len(options) < 4 else "D"
                if len(options) >= 4:
                    continue
                opt_text = ocr_m.group(1).strip()
                opt_text = re.sub(r"\s*\[?CORRECT\]?\s*$", "", opt_text, flags=re.I).strip()
                opt_text = re.sub(r"\s*Your answer is correct\s*$", "", opt_text, flags=re.I).strip()
                opt_text = re.sub(r"\s*Correct answer\s*$", "", opt_text, flags=re.I).strip()
                if "[CORRECT]" in line or re.search(r"(?:your answer is )?correct\s*$", line, re.I):
                    correct = key
                options.append({"key": key, "text": opt_text})
                continue
            if re.search(r"correct\s*answer|your answer is correct", line, re.I):
                m = re.search(r"([A-D])\b", line, re.I)
                if m and not correct and options:
                    idx = ord(m.group(1).upper()) - 65
                    if 0 <= idx < len(options):
                        correct = options[idx]["key"]
                continue
            if not options:
                if len(line) >= 15 and not skip_pattern.match(line):
                    question_parts.append(line)
        # When correct answer not detected, use first option so OCR questions are still merged
        if len(options) >= 2 and not correct:
            correct = options[0]["key"]
        question_text = " ".join(question_parts).strip()
        if question_text and len(options) >= 2 and correct:
            questions.append({
                "id": f"docscanner-{page_num}",
                "section": min(4, (page_num % 4) + 1),
                "questionText": question_text,
                "options": options,
                "correctAnswer": correct,
                "explanation": None,
                "source": "DocScanner",
            })
    return questions


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_root = os.path.dirname(script_dir)
    data_dir = os.path.join(app_root, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, "questions.json")

    all_q = build_from_github()
    project_root = os.path.dirname(app_root)
    sample_path = os.path.join(project_root, "docscanner_questions_sample.txt")
    sample_q = parse_docscanner_sample(sample_path)
    if sample_q:
        all_q.extend(sample_q)
        print(f"Merged {len(sample_q)} DocScanner (sample) questions.")
    docscanner_path = os.path.join(project_root, "docscanner_ocr_output.txt")
    doc_q = parse_docscanner_ocr(docscanner_path)
    if doc_q:
        all_q.extend(doc_q)
        print(f"Merged {len(doc_q)} DocScanner (OCR) questions.")
    elif not sample_q:
        print("DocScanner: no sample or OCR text (run OCR script with Tesseract for full set).")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_q, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(all_q)} questions to {out_path}")


if __name__ == "__main__":
    main()
