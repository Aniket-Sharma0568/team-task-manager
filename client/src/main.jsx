import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarClock,
  Check,
  Circle,
  ClipboardList,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const statuses = ["TODO", "IN_PROGRESS", "DONE"];
const statusLabels = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done"
};
const priorityLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High"
};

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("ttm-session")) || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );
}

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const session = await request(path, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("ttm-session", JSON.stringify(session));
      onAuthed(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <div className="brand-mark">
            <ClipboardList size={28} />
          </div>
          <h1>Team Task Manager</h1>
          <p>Projects, roles, assigned work, and progress tracking in one workspace.</p>
        </div>

        <form onSubmit={submit} className="auth-card">
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
              Signup
            </button>
          </div>

          {mode === "signup" && (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={mode === "signup" ? 8 : 1}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>
            {loading && <Loader2 className="spin" size={16} />}
            {mode === "login" ? "Login" : "Create account"}
          </button>
          <p className="demo-note">Demo: admin@example.com or member@example.com / Password123!</p>
        </form>
      </section>
    </main>
  );
}

function ProjectSidebar({ projects, selectedId, onSelect, onCreate, user, onLogout }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name, description });
    setName("");
    setDescription("");
  }

  return (
    <aside className="sidebar">
      <div className="side-head">
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <button className="icon-button" onClick={onLogout} title="Log out">
          <LogOut size={18} />
        </button>
      </div>

      <div className="project-list">
        {projects.map((project) => (
          <button
            key={project.id}
            className={`project-item ${selectedId === project.id ? "active" : ""}`}
            onClick={() => onSelect(project.id)}
          >
            <span>{project.name}</span>
            <small>{project.role}</small>
          </button>
        ))}
      </div>

      <form className="create-project" onSubmit={submit}>
        <h2>New Project</h2>
        <input placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button className="primary">
          <Plus size={16} />
          Create
        </button>
      </form>
    </aside>
  );
}

function Dashboard({ dashboard }) {
  const cards = [
    { label: "Total tasks", value: dashboard?.totalTasks || 0, icon: ClipboardList },
    { label: "To do", value: dashboard?.byStatus?.TODO || 0, icon: Circle },
    { label: "In progress", value: dashboard?.byStatus?.IN_PROGRESS || 0, icon: BarChart3 },
    { label: "Done", value: dashboard?.byStatus?.DONE || 0, icon: Check },
    { label: "Overdue", value: dashboard?.overdueTasks?.length || 0, icon: CalendarClock }
  ];

  return (
    <section className="dashboard-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className="metric" key={card.label}>
            <Icon size={18} />
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        );
      })}
    </section>
  );
}

function MemberPanel({ project, onAddMember, onRemoveMember }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  async function submit(event) {
    event.preventDefault();
    if (!email.trim()) return;
    await onAddMember({ email, role });
    setEmail("");
  }

  return (
    <section className="members-panel">
      <header>
        <h2>
          <Users size={18} />
          Members
        </h2>
      </header>
      <div className="member-list">
        {project.members?.map((member) => (
          <div className="member-row" key={member.id}>
            <div>
              <strong>{member.user.name}</strong>
              <span>{member.user.email}</span>
            </div>
            <small>{member.role}</small>
            {project.role === "ADMIN" && member.role !== "ADMIN" && (
              <button className="icon-button danger" onClick={() => onRemoveMember(member.userId)} title="Remove member">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {project.role === "ADMIN" && (
        <form className="inline-form" onSubmit={submit}>
          <input
            type="email"
            placeholder="member@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button className="icon-button filled" title="Add member">
            <UserPlus size={18} />
          </button>
        </form>
      )}
    </section>
  );
}

function TaskForm({ members, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    assigneeId: ""
  });

  async function submit(event) {
    event.preventDefault();
    await onSubmit({
      ...form,
      dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00.000Z`).toISOString() : null,
      assigneeId: form.assigneeId || null
    });
    setForm({ title: "", description: "", dueDate: "", priority: "MEDIUM", assigneeId: "" });
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <input
        placeholder="Task title"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        required
      />
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
      />
      <div className="form-row">
        <input
          type="date"
          value={form.dueDate}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
        />
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
        <option value="">Unassigned</option>
        {members?.map((member) => (
          <option value={member.userId} key={member.id}>
            {member.user.name}
          </option>
        ))}
      </select>
      <button className="primary">
        <Plus size={16} />
        Add task
      </button>
    </form>
  );
}

function TaskCard({ task, members, canManage, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description || "",
    dueDate: toDateInput(task.dueDate),
    priority: task.priority,
    assigneeId: task.assigneeId || ""
  });

  async function save(event) {
    event.preventDefault();
    await onUpdate(task.id, {
      ...draft,
      dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00.000Z`).toISOString() : null,
      assigneeId: draft.assigneeId || null
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <form className="task-card editing" onSubmit={save}>
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <textarea
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
        <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
        <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select value={draft.assigneeId} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}>
          <option value="">Unassigned</option>
          {members?.map((member) => (
            <option value={member.userId} key={member.id}>
              {member.user.name}
            </option>
          ))}
        </select>
        <div className="actions">
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    );
  }

  return (
    <article className={`task-card priority-${task.priority.toLowerCase()}`}>
      <div className="task-top">
        <span>{priorityLabels[task.priority]}</span>
        {canManage && (
          <button className="icon-button danger" onClick={() => onDelete(task.id)} title="Delete task">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-meta">
        <span>{task.assignee?.name || "Unassigned"}</span>
        <span>{formatDate(task.dueDate)}</span>
      </div>
      <div className="task-actions">
        <select value={task.status} onChange={(event) => onUpdate(task.id, { status: event.target.value })}>
          {statuses.map((status) => (
            <option value={status} key={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        {canManage && (
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

function TaskBoard({ tasks, members, canManage, onCreateTask, onUpdateTask, onDeleteTask }) {
  const grouped = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status, tasks.filter((task) => task.status === status)])),
    [tasks]
  );

  return (
    <section className="board-wrap">
      {canManage && <TaskForm members={members} onSubmit={onCreateTask} />}
      <div className="board">
        {statuses.map((status) => (
          <section className="column" key={status}>
            <h2>{statusLabels[status]}</h2>
            <div className="task-stack">
              {grouped[status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  canManage={canManage}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                />
              ))}
              {grouped[status].length === 0 && <p className="empty">No tasks</p>}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [session, setSession] = useState(readSession);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = session?.token;
  const canManage = project?.role === "ADMIN";

  async function loadProjects() {
    const data = await request("/projects", {}, token);
    setProjects(data.projects);
    if (!selectedId && data.projects[0]) {
      setSelectedId(data.projects[0].id);
    }
  }

  async function loadProject(id = selectedId) {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [projectData, taskData, dashboardData] = await Promise.all([
        request(`/projects/${id}`, {}, token),
        request(`/projects/${id}/tasks`, {}, token),
        request(`/projects/${id}/dashboard`, {}, token)
      ]);
      setProject(projectData.project);
      setTasks(taskData.tasks);
      setDashboard(dashboardData.dashboard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadProjects().catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) return;
    loadProject(selectedId);
  }, [token, selectedId]);

  async function mutate(action) {
    setError("");
    try {
      await action();
      await loadProjects();
      await loadProject(selectedId);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("ttm-session");
    setSession(null);
    setProjects([]);
    setSelectedId("");
    setProject(null);
  }

  if (!session) {
    return <AuthScreen onAuthed={setSession} />;
  }

  return (
    <div className="app-shell">
      <ProjectSidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        user={session.user}
        onLogout={logout}
        onCreate={(body) =>
          mutate(async () => {
            const data = await request("/projects", { method: "POST", body: JSON.stringify(body) }, token);
            setSelectedId(data.project.id);
          })
        }
      />

      <main className="workspace">
        {!project && !loading && (
          <section className="blank-state">
            <ClipboardList size={40} />
            <h1>Create or select a project</h1>
          </section>
        )}

        {project && (
          <>
            <header className="workspace-head">
              <div>
                <p>{project.role}</p>
                <h1>{project.name}</h1>
                {project.description && <span>{project.description}</span>}
              </div>
              {loading && <Loader2 className="spin" size={22} />}
            </header>
            {error && <p className="error banner">{error}</p>}
            <Dashboard dashboard={dashboard} />
            <div className="content-grid">
              <TaskBoard
                tasks={tasks}
                members={project.members}
                canManage={canManage}
                onCreateTask={(body) =>
                  mutate(() =>
                    request(`/projects/${project.id}/tasks`, { method: "POST", body: JSON.stringify(body) }, token)
                  )
                }
                onUpdateTask={(taskId, body) =>
                  mutate(() => request(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) }, token))
                }
                onDeleteTask={(taskId) => mutate(() => request(`/tasks/${taskId}`, { method: "DELETE" }, token))}
              />
              <MemberPanel
                project={project}
                onAddMember={(body) =>
                  mutate(() =>
                    request(`/projects/${project.id}/members`, { method: "POST", body: JSON.stringify(body) }, token)
                  )
                }
                onRemoveMember={(userId) =>
                  mutate(() => request(`/projects/${project.id}/members/${userId}`, { method: "DELETE" }, token))
                }
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
