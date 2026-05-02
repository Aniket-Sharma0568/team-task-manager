# Team Task Manager

A full-stack team task management web app built for the assignment. Users can sign up, create projects, invite members, assign tasks, update progress, and view project dashboards with role-based access.

## Features

- JWT authentication with secure password hashing
- Project creation with creator as Admin
- Admin member management by email
- Role-based access for Admin and Member users
- Task creation, assignment, priority, due date, and status tracking
- Members can view and update only their assigned tasks
- Dashboard metrics for total tasks, status counts, tasks per user, and overdue tasks
- RESTful Express API with Prisma and PostgreSQL
- React frontend served by the backend in production

## Tech Stack

- Frontend: React, Vite, CSS, lucide-react
- Backend: Node.js, Express, JWT, bcrypt, Zod
- Database: PostgreSQL with Prisma ORM
- Deployment: Railway

## Project Structure

```text
team-task-manager/
  client/              React frontend
  server/              Express API
    prisma/            Database schema and seed
    src/               API source files
  railway.json         Railway build and start commands
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment files.

For the backend, create `server/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=5000
CLIENT_URL="http://localhost:5173"
```

For the frontend, create `client/.env`:

```env
VITE_API_URL="http://localhost:5000/api"
```

3. Run database migrations:

```bash
npm run prisma:migrate --workspace server
```

4. Optional: add demo data:

```bash
npm run seed
```

Demo accounts:

```text
admin@example.com / Password123!
member@example.com / Password123!
```

5. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend health check: `http://localhost:5000/api/health`

## API Overview

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`

Projects:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`

Tasks:

- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/status`
- `DELETE /api/tasks/:taskId`

Dashboard:

- `GET /api/projects/:projectId/dashboard`

## Railway Deployment

1. Push this project to GitHub.
2. In Railway, create a new project from the GitHub repository.
3. Add a PostgreSQL database service.
4. In the web service variables, set:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your-long-random-production-secret
NODE_ENV=production
```

5. Do not set `VITE_API_URL` for a single Railway service deployment. The frontend will call `/api` on the same public domain.
6. Railway will use `railway.json`:

- Build: `npm install && npm run build`
- Start: `npm run prisma:deploy --workspace server && npm start`
- Health check: `/api/health`

7. Open the generated Railway public URL and test signup/login.

## Submission Checklist

- Live application URL: add your Railway URL here
- GitHub repository: https://github.com/Aniket-Sharma0568/team-task-manager
- README: included
- Demo video: record a 2-5 minute walkthrough covering signup, project creation, members, task assignment, status updates, dashboard, and Railway deployment

## Notes

- Admins can manage project members and all tasks.
- Members can see only tasks assigned to them and can update only task status.
- Removing a member unassigns their tasks instead of deleting those tasks.
