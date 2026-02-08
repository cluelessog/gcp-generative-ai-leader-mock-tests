"""
Build data/mocks.json: 6-7 mock tests with 50 questions each, 90 min (official exam structure).
Section weights: 30/35/20/15.
"""
import json
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(APP_ROOT, "data")
QUESTIONS_PATH = os.path.join(DATA_DIR, "questions.json")
MOCKS_PATH = os.path.join(DATA_DIR, "mocks.json")

# Exam section weights: 1=30%, 2=35%, 3=20%, 4=15%
SECTION_WEIGHTS = {1: 0.30, 2: 0.35, 3: 0.20, 4: 0.15}
QUESTIONS_PER_MOCK = 50
DURATION_MINUTES = 90


def main():
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        questions = json.load(f)
    by_section = {1: [], 2: [], 3: [], 4: []}
    for q in questions:
        s = q.get("section", 1)
        if s in by_section:
            by_section[s].append(q["id"])

    num_mocks = 7
    mocks = []
    rng = random.Random(42)  # reproducible
    for i in range(1, num_mocks + 1):
        n = QUESTIONS_PER_MOCK
        n1 = max(1, round(n * SECTION_WEIGHTS[1]))
        n2 = max(1, round(n * SECTION_WEIGHTS[2]))
        n3 = max(1, round(n * SECTION_WEIGHTS[3]))
        n4 = n - n1 - n2 - n3
        if n4 < 1:
            n4 = 1
            n1 = n - n2 - n3 - n4
        ids1 = rng.sample(by_section[1], min(n1, len(by_section[1])))
        ids2 = rng.sample(by_section[2], min(n2, len(by_section[2])))
        ids3 = rng.sample(by_section[3], min(n3, len(by_section[3])))
        ids4 = rng.sample(by_section[4], min(n4, len(by_section[4])))
        all_ids = ids1 + ids2 + ids3 + ids4
        rng.shuffle(all_ids)
        mocks.append({
            "mockId": f"mock-{i}",
            "title": f"Mock {i}",
            "questionCount": len(all_ids),
            "durationMinutes": DURATION_MINUTES,
            "questionIds": all_ids,
        })
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(MOCKS_PATH, "w", encoding="utf-8") as f:
        json.dump(mocks, f, indent=2)
    print(f"Wrote {len(mocks)} mocks to {MOCKS_PATH}")


if __name__ == "__main__":
    main()
