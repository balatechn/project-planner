# Project Planner

A premium, enterprise-grade **Project & Task Management** web application with
**Microsoft 365 Single Sign-On**. It combines the best of Microsoft Planner,
Asana, Monday.com and Jira — Kanban, Gantt, Calendar and List views,
role-based access, reporting, and Microsoft Graph integrations — in a fast,
clean, Fluent-inspired interface with light & dark modes.

> **Status:** This repository is a production-grade **foundation**. The core
> flows (auth, RBAC, projects, tasks/subtasks, comments, attachments, the five
> views, notifications, reporting, exports, admin) are implemented and working.
> Some advanced integrations (Graph email/OneDrive) activate automatically when
> tenant credentials are provided, and fall back to local drivers otherwise.

---

## ✨ Features

| Area | Highlights |
|------|-----------|
| **Auth** | Microsoft Entra ID (Azure AD) SSO, single-tenant + domain allow-list, secure 8h JWT sessions, dev-login fallback |
| **RBAC** | Admin · Project Manager · Team Member · Viewer, capability-based permissions enforced in API + UI |
| **Projects** | Create / edit / archive / delete, owner, department, priority, status, budget, dates, members, progress tracking |
| **Tasks** | Tasks & subtasks, assignees, priorities, due dates, dependencies, progress, comments, attachments |
| **Views** | Dashboard · Kanban (drag & drop) · List · Gantt · Calendar |
| **Collaboration** | Comments, activity timeline, file uploads (OneDrive/SharePoint or local) |
| **Notifications** | In-app bell + email via Microsoft Graph (console fallback) |
| **Reporting** | Completion %, delayed tasks, department rollups, resource utilization, **Excel & PDF export** |
| **Security** | Audit log, activity tracking, RBAC, CSRF-safe Auth.js, XSS-safe React, middleware route gating |
| **UX** | Fluent-inspired, blue/green/gray corporate gradient theme, responsive, dark/light, smooth animations |

---

## 🧱 Tech Stack

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · ShadCN-style UI (Radix)
- **Backend:** Next.js Route Handlers
- **Database:** PostgreSQL · Prisma ORM
- **Auth:** Auth.js (NextAuth v5) + Microsoft Entra ID
- **Integrations:** Microsoft Graph (Mail.Send, Files.ReadWrite)
- **Exports:** ExcelJS (.xlsx) + printable HTML (PDF)
- **Hosting:** Vercel (app) · Coolify / any Postgres (database)

---

## 🚀 Quick start (local)

### 1. Prerequisites
- Node.js 20+ (tested on Node 24)
- Docker (for local Postgres) **or** any reachable PostgreSQL instance

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# A ready-to-use .env is already generated for local dev (dev-login enabled).
# Generate a secret if you need one:
npx auth secret
```

### 4. Start the database
```bash
docker compose up -d        # starts Postgres on localhost:5432
```
> No Docker? Point `DATABASE_URL` at any PostgreSQL server.

### 5. Create the schema & seed data
```bash
npm run db:push     # apply schema (or: npm run db:migrate for migrations)
npm run db:seed     # load demo users, projects and tasks
```

### 6. Run
```bash
npm run dev
# http://localhost:3000
```

### 7. Sign in (dev login)
While Entra SSO is not yet configured, use the developer login:

| Email | Role |
|-------|------|
| `admin@contoso.com` | Admin |
| `manager@contoso.com` | Project Manager |
| `alice@contoso.com` | Team Member |
| `viewer@contoso.com` | Viewer |

Password for all: **`Password123!`**

---

## 📁 Project structure

```
prisma/
  schema.prisma         # full data model (see docs/DATABASE.md)
  seed.ts               # demo data
src/
  app/
    (app)/              # authenticated route group (sidebar shell)
      dashboard/        # workspace dashboard
      projects/         # list + [id] workspace (all 5 views)
      my-tasks/ calendar/ reports/ team/ profile/ search/
      admin/            # users & roles, audit log
    api/                # route handlers (projects, tasks, notifications, …)
    login/              # SSO + dev login
  components/
    ui/                 # ShadCN-style primitives
    tasks/              # kanban, list, gantt, calendar, task dialog
  lib/                  # prisma, auth, rbac, graph, email, storage, validation
  types/                # shared + next-auth type augmentation
docs/                   # setup & deployment guides + API reference
```

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:push` | Push schema to DB (no migration files) |
| `npm run db:migrate` | Create & apply a dev migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-apply and re-seed |

---

## 📚 Documentation

- [docs/SSO_SETUP.md](docs/SSO_SETUP.md) — Microsoft Entra ID app registration & Graph permissions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Deploy to Vercel + Coolify Postgres
- [docs/API.md](docs/API.md) — REST API reference
- [docs/DATABASE.md](docs/DATABASE.md) — Schema & entity relationships

---

## 🔐 Roles & permissions

| Capability | Admin | PM | Member | Viewer |
|-----------|:-:|:-:|:-:|:-:|
| View projects/reports | ✅ | ✅ | ✅ | ✅ |
| Create/edit projects | ✅ | ✅ | — | — |
| Archive projects | ✅ | ✅ | — | — |
| Delete projects | ✅ | — | — | — |
| Create/edit tasks | ✅ | ✅ | ✅ | — |
| Update task status | ✅ | ✅ | ✅ | — |
| Comment & attach | ✅ | ✅ | ✅ | — |
| Export reports | ✅ | ✅ | — | — |
| Manage users/audit | ✅ | — | — | — |

Full matrix lives in [`src/lib/rbac.ts`](src/lib/rbac.ts).
