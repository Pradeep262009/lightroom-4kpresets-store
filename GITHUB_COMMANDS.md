# GitHub Push Commands

Use these commands in the terminal from your project folder.

## 1. Initialize Git
```bash
git init
```

Expected output:
```text
Initialized empty Git repository in D:/project/.git/
```

## 2. Add all files
```bash
git add .
```

Expected output:
```text
No output
```

## 3. Make the first commit
```bash
git commit -m "Initial commit"
```

Expected output:
```text
[main (root-commit) <commit-hash>] Initial commit
```

## 4. Rename the branch to main
```bash
git branch -M main
```

Expected output:
```text
No output
```

## 5. Connect to GitHub repository
```bash
git remote add origin https://github.com/your-username/your-repo-name.git
```

Expected output:
```text
No output
```

If you see this error:
```text
fatal: remote origin already exists.
```

Use this instead:
```bash
git remote set-url origin https://github.com/your-username/your-repo-name.git
```

## 6. Push to GitHub
```bash
git push -u origin main
```

Expected output:
```text
Enumerating objects: ...
Counting objects: ...
Writing objects: ...
To https://github.com/your-username/your-repo-name.git
 * [new branch]      main -> main
```

## 7. Push future updates
```bash
git add .
git commit -m "Update website"
git push origin main
```

Expected output:
```text
[main <commit-hash>] Update website
To https://github.com/your-username/your-repo-name.git
   <old-commit>.. <new-commit> main -> main
```

## 8. If Git asks for login
Use your GitHub username and a personal access token instead of your password.
