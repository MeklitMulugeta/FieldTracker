# FieldTrack — Offline Field Issue Tracker

**A web-based field issue reporting and management system designed to work online and offline.**

## 1. Project Overview

FieldTrack is an offline-capable field issue tracking application designed to help field workers report problems and enable coordinators to manage, assign, monitor, and resolve them efficiently.

The system supports offline report creation and local data storage, allowing field workers to continue working even when internet connectivity is unavailable. When connectivity is restored, pending reports can synchronize with the central database.

FieldTrack aims to improve communication, accountability, and efficiency in field issue management.

## 2. Project Objectives

- Enable field workers to create and manage issue reports.
- Support offline report creation and storage.
- Synchronize locally saved reports when internet connectivity returns.
- Allow coordinators to review, assign, and monitor reports.
- Provide a structured issue resolution workflow.
- Maintain report history and activity records.
- Protect information through authentication and role-based access control.

## 3. User Roles

### Worker
- Register and log in.
- Create and save issue reports.
- Create reports while offline.
- View personal reports and their statuses.
- Edit draft reports.
- Correct reports returned by coordinators.
- Monitor synchronization status.

### Coordinator
- Log in to the coordinator dashboard.
- View and manage submitted reports.
- Assign reports to workers.
- Update report statuses.
- Return reports for correction with a reason.
- Reject reports with a reason.
- Resolve and reopen reports.
- Monitor report activity and history.

## 4. Main Features

- User authentication and role-based access.
- Issue reporting and management.
- Offline-first data storage.
- Automatic synchronization support.
- Report assignment.
- Report status tracking.
- Photo evidence and attachments.
- Location information.
- Activity and report history.
- Secure database access.
- Responsive user interface.

## 5. Report Workflow

The report management workflow includes:

1. **Draft** — A worker creates and saves a report.
2. **Submitted** — The report is submitted for review.
3. **Assigned** — A coordinator assigns the report to a worker.
4. **In Progress** — Work on the issue begins.
5. **Resolved** — The reported issue is resolved.

Additional statuses include:

- **Needs Correction** — The report is returned to the worker for editing.
- **Rejected** — The report is rejected with a recorded reason.

## 6. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Backend Language | TypeScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Offline Storage | IndexedDB with Dexie.js |
| Testing | Vitest |
| Version Control | Git and GitHub |

## 7. Project Architecture

The project follows a separate frontend and backend architecture.

```text
FieldTrack/
│
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── offline/
│   │   ├── types/
│   │   └── lib/
│   └── package.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── validators/
│   │   └── config/
│   └── package.json
│
├── supabase/               # Database and configuration
│   ├── migrations/
│   ├── functions/
│   ├── tests/
│   └── seed.sql
│
├── docs/                   # Project documentation
├── scripts/
├── package.json
├── README.md
└── .gitignore
```

## 8. Installation and Setup

### Prerequisites

Install the following:

- Node.js (recommended: version 20 or later)
- npm
- Git
- A Supabase project

### Step 1: Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd FieldTrack
```

### Step 2: Install Dependencies

```bash
npm install
```

If the root project uses separate package installations, install the client and server dependencies as well:

```bash
cd client
npm install
cd ../server
npm install
cd ..
```

### Step 3: Configure Environment Variables

Create the appropriate `.env` files using the provided `.env.example` templates.

**Client environment variables (`client/.env`):**

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

**Server environment variables (`server/.env`):**

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
```

**Security note:** Never expose the Supabase secret key in frontend
