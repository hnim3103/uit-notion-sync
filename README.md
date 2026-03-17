# UIT Notion Sync

UIT Notion Sync is an automated bot that logs into the University of Information Technology (UIT) Moodle system ([courses.uit.edu.vn](https://courses.uit.edu.vn)), crawls your course deadlines from the calendar, and automatically synchronizes them to a Notion database.

This project leverages **Playwright** for web scraping and the **Notion API** to maintain your task list.

## Features
- **Automated Login**: Securely logs into your UIT Moodle account.
- **Deadline Extraction**: Scrapes upcoming assignments, ignoring quizzes, from the course calendar.
- **Notion Integration**: Automatically creates new tasks or updates existing deadlines in your Notion database.
- **GitHub Actions Ready**: Automatically run the synchronization every day without needing a local server.

## Prerequisites

Before setting up the project, you need:
1. **UIT Account credentials** (Username and Password).
2. **Notion Integration API Key**.
3. **Notion Database ID**.

### Step 1: Create a Notion API Key (Integration)
1. Go to [Notion My Integrations](https://www.notion.so/my-integrations).
2. Click **New integration** (or the "+ New integration" button).
3. Name your integration (e.g., "UIT Deadline Bot"), select the workspace where your database will live, and click **Submit**.
4. Under the **Secrets** section, click **Show** and copy your **Internal Integration Secret**. **This is your `NOTION_API_KEY`**.

### Step 2: Create the Notion Database
1. Open Notion and create a new page.
2. Select **Table** or **Board** database layout, and choose **New database**.
3. **Important:** Your database must have the following properties with *exact* names and types:
   - `Title` (Type: **Title** - usually the default first column): For the assignment name.
   - `Class` (Type: **Rich text**): For the course name or code.
   - `Deadline` (Type: **Date**): For the specific deadline date.
   - `Link` (Type: **URL**): Direct link to the assignment on Moodle.

### Step 3: Connect your Bot to the Database
1. In the top right corner of your new Notion database page, click the **three dots (`...`)**.
2. Scroll down to **Connections** (or **Add connections**) and search for the name of the integration you created in Step 1 (e.g., "UIT Deadline Bot").
3. Click on your integration to invite it, giving it read and write permissions to this specific database page.

### Step 4: Get your Notion Database ID
1. Still on your new Notion database page, click the **Share** button in the top right, and click **Copy link**.
2. Paste the link into a notepad. It will look something like this:
   `https://www.notion.so/myworkspace/a8bec43388be4f5cb36deeb2f2e519c2?v=...`
3. The **Database ID** is the 32-character string between the workspace name slash (`/`) and the question mark (`?`). In the example above, the ID is `a8bec43388be4f5cb36deeb2f2e519c2`. **This is your `NOTION_DATABASE_ID`**.

## Auto-run with GitHub Actions (Recommended)

You can fully automate this bot to run daily in the cloud using GitHub Actions. The workflow file `.github/workflows/main.yml` is already included and will run the bot at 20:00 Vietnam Time (13:00 UTC) every day.

### Setup Instructions

1. Push this repository to your GitHub account.
2. Go to your repository **Settings** -> **Secrets and variables** -> **Actions**.
3. Click on **New repository secret** and add the following 4 secrets:
   - `UIT_USERNAME`: Your student ID.
   - `UIT_PASSWORD`: Your account password.
   - `NOTION_API_KEY`: Your Notion integration token from Step 1.
   - `NOTION_DATABASE_ID`: Your target Notion database ID from Step 4.
4. Go to the **Actions** tab in your repository and enable workflows if prompted. You can click **Run workflow** (under the "Daily UIT Deadline Sync" workflow) to test it manually via the `workflow_dispatch` trigger.

## Running Locally

If you prefer to test or run the project on your local machine:

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   npx playwright install --with-deps chromium
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your credentials:
   ```env
   UIT_USERNAME=your_student_id
   UIT_PASSWORD=your_password
   NOTION_API_KEY=your_notion_secret_key
   NOTION_DATABASE_ID=your_notion_database_id
   ```

3. **Run the bot:**
   ```bash
   node index.js
   ```
