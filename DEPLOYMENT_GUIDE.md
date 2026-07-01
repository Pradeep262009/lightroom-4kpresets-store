# Deployment Guide

This guide takes you from GitHub repository setup to the final deployment check for your website and backend.

## Step 1: Make sure your project is ready
Before starting, confirm your project folder contains:
- server.js
- index.html
- admin.html
- login.html
- package.json

## Step 2: Create a GitHub account and repository
1. Go to https://github.com
2. Sign in or create a new account
3. Click New repository
4. Enter a name such as:
   `lightroom-presets-store`
5. Choose Public or Private
6. Click Create repository

## Step 3: Upload your project to GitHub
Open the terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Now connect your local project to the GitHub repository:

```bash
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```

If Git asks for login, use your GitHub username and personal access token.

## Step 4: Create the web service on Render
1. Go to https://render.com
2. Sign in to your account
3. Click New +
4. Choose Web Service
5. Connect your GitHub account
6. Select the repository you just uploaded

## Step 5: Set the build and start commands
In Render, enter these values:

- Build Command:

```bash
npm install
```

- Start Command:

```bash
npm start
```

These commands tell Render how to install your app and start the backend.

## Step 6: Add environment variables
In the Render dashboard, open Environment and add these values:

```text
PORT=3000
MERCHANT_PA=6383617697@fam
MERCHANT_NAME=Match Code Digital
PRODUCT_AMOUNT=19.00
PRODUCT_NOTE=100+ Premium Lightroom Presets
DOWNLOAD_URL=https://drive.google.com/file/d/16Rax3I-RVXKZg-XFgcAkoaiA0hlESSJ-/view
ADMIN_USERNAME=ADMIN
ADMIN_PASSWORD=marsh
```

Important: change these values before using the site for real payments.

## Step 7: Deploy the website
Click the button to create or deploy the service.

Render will build the project and start it automatically.

## Step 8: Open the live website
When deployment finishes, Render will give you a public URL such as:

```text
https://your-app-name.onrender.com
```

Open that link in your browser.

## Step 9: Final check after deployment
Check these items carefully:
1. The homepage loads correctly
2. The payment section appears
3. The login page opens
4. The backend API responds
5. The admin login works with your chosen credentials

If anything fails, check the Render logs for error messages.

## Step 10: Update the site later
When you make changes, run:

```bash
git add .
git commit -m "Update website"
git push origin main
```

Render will automatically redeploy your project.

## Final note
This project currently stores orders in local files. That is fine for testing, but for larger or long-term usage, moving to a database is recommended.
