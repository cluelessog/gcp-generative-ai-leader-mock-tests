# Push this repo to GitHub

The initial commit is done. To put it on GitHub, use one of these:

## Option A: GitHub CLI (after logging in)

```bash
gh auth login
gh repo create gcp-generative-ai-leader-mock-tests --public --source=. --remote=origin --push
```

(Use `--private` instead of `--public` if you want a private repo.)

## Option B: Create repo on GitHub, then push

1. On [GitHub](https://github.com/new), create a new repository:
   - Name: **gcp-generative-ai-leader-mock-tests**
   - Leave it empty (no README, .gitignore, or license).

2. In this folder, run (replace `YOUR_USERNAME` with your GitHub username):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/gcp-generative-ai-leader-mock-tests.git
   git push -u origin main
   ```

3. In the README, replace `YOUR_USERNAME` in the clone URL with your actual username.

You can delete this file after the first push if you like.
