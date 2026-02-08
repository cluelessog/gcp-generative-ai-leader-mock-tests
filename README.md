# GCP Generative AI Leader – Mock Tests

Local, timed mock exam practice for the [Google Cloud Generative AI Leader](https://cloud.google.com/learn/certification/generative-ai-leader) certification. No login required; runs entirely in your browser.

**Live site (GitHub Pages):** https://cluelessog.github.io/gcp-generative-ai-leader-mock-tests/

## How to use

1. **Clone the repo**
   ```bash
   git clone https://github.com/cluelessog/gcp-generative-ai-leader-mock-tests.git
   ```

2. **Go into the folder**
   ```bash
   cd gcp-generative-ai-leader-mock-tests
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the app**
   ```bash
   npm start
   ```

5. **Open in a browser**  
   Visit the URL shown in the terminal (e.g. [http://localhost:8080](http://localhost:8080)).

6. **Use from another device (optional)**  
   On the same network, use `http://<this-computer-IP>:8080`. To find your IP: **Windows** – `ipconfig` (look for IPv4 Address); **Mac/Linux** – `ip addr` or `ifconfig`. If needed, allow port 8080 in your firewall.

## Alternative: Python server

If you prefer not to use Node:

```bash
cd gcp-generative-ai-leader-mock-tests
python -m http.server 8080
```

To allow other devices on your network to connect (Windows):

```bash
python -m http.server 8080 --bind 0.0.0.0
```

Then open **http://localhost:8080** on this machine or **http://\<your-IP\>:8080** on another device.

## What's included

- **7 mock tests**, 50 questions each, 90 minutes per test (aligned to the official exam format).
- **Section weights** matching the exam: Fundamentals ~30%, GCP offerings ~35%, Techniques ~20%, Business strategies ~15%.
- **Timer** with auto-submit when time runs out, plus 10- and 5-minute warnings.
- **Results** with score, pass/fail (70% threshold), section breakdown, and per-question review with correct answers and explanations where available.
- **Resume** in-progress tests and **reset** completed ones from the dashboard.

## Sources and thanks

- **Question bank:** Questions are sourced from the [GCP Generative AI Leader Certification – MCQ collection](https://github.com/rajesh-suryaprakash/GCP-Generative-AI-Leader-Certification) on GitHub by [rajesh-suryaprakash](https://github.com/rajesh-suryaprakash). Thank you for making this practice material available.
- **Official resources:** [Google Cloud Generative AI Leader certification](https://cloud.google.com/learn/certification/generative-ai-leader) and [official sample questions (Google Form)](https://docs.google.com/forms/d/e/1FAIpQLScNn5oUIFeMQjtsHilQsJPxDsnP-0DbhDVsIXaBeCmPj-dgYw/viewform).

This project is **unofficial** practice material and is not affiliated with or endorsed by Google LLC.

## Rebuilding question data (optional)

To regenerate `data/questions.json` and `data/mocks.json` from the GitHub MCQ source, run the Python scripts in the `scripts/` folder (see script docstrings for usage).
