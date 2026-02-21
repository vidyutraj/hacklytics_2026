import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("phisherman.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    risk_score INTEGER DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    dept_id INTEGER,
    security_score INTEGER DEFAULT 100,
    FOREIGN KEY(dept_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'email', 'video', 'audio'
    content TEXT, -- JSON blob
    difficulty INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    status TEXT, -- 'active', 'completed', 'scheduled'
    target_dept_id INTEGER,
    sim_type TEXT,
    launched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(target_dept_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    simulation_id INTEGER,
    campaign_id INTEGER,
    is_correct BOOLEAN,
    response_time INTEGER,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(simulation_id) REFERENCES simulations(id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );
`);

// Seed initial data if empty
const seed = () => {
  const deptCount = db.prepare("SELECT COUNT(*) as count FROM departments").get() as any;
  if (deptCount.count === 0) {
    const depts = ['Engineering', 'Finance', 'Marketing', 'HR', 'Sales'];
    const insertDept = db.prepare("INSERT INTO departments (name, risk_score) VALUES (?, ?)");
    depts.forEach(d => insertDept.run(d, Math.floor(Math.random() * 40) + 60));

    const employees = [
      { name: 'Alice Chen', email: 'alice@corp.com', dept: 'Engineering' },
      { name: 'Bob Smith', email: 'bob@corp.com', dept: 'Finance' },
      { name: 'Charlie Day', email: 'charlie@corp.com', dept: 'Marketing' }
    ];
    const insertEmp = db.prepare("INSERT INTO employees (name, email, dept_id) VALUES (?, ?, (SELECT id FROM departments WHERE name = ?))");
    employees.forEach(e => insertEmp.run(e.name, e.email, e.dept));
  }
};
seed();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Admin API ---
  app.get("/api/admin/overview", (req, res) => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_sims,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as total_reports,
        SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as total_compromises
      FROM results
    `).get();
    res.json(stats || { total_sims: 0, total_reports: 0, total_compromises: 0 });
  });

  app.get("/api/admin/departments", (req, res) => {
    const depts = db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM employees e WHERE e.dept_id = d.id) as employee_count,
        (SELECT AVG(security_score) FROM employees e WHERE e.dept_id = d.id) as avg_score
      FROM departments d
    `).all();
    res.json(depts);
  });

  app.get("/api/admin/campaigns", (req, res) => {
    const campaigns = db.prepare(`
      SELECT c.*, d.name as dept_name,
        (SELECT COUNT(*) FROM results r WHERE r.campaign_id = c.id) as response_count
      FROM campaigns c
      JOIN departments d ON c.target_dept_id = d.id
      ORDER BY c.launched_at DESC
    `).all();
    res.json(campaigns);
  });

  app.post("/api/admin/campaigns", (req, res) => {
    const { name, target_dept_id, sim_type } = req.body;
    const info = db.prepare(`
      INSERT INTO campaigns (name, target_dept_id, sim_type, status)
      VALUES (?, ?, ?, 'active')
    `).run(name, target_dept_id, sim_type);
    res.json({ id: info.lastInsertRowid });
  });

  // --- Employee API ---
  app.get("/api/stats", (req, res) => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_simulations,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
        AVG(response_time) as avg_response_time
      FROM results
      WHERE employee_id = 1 -- Mock current user
    `).get();
    res.json(stats || { total_simulations: 0, correct_count: 0, avg_response_time: 0 });
  });

  app.get("/api/reports", (req, res) => {
    const reports = db.prepare(`
      SELECT 
        r.id,
        r.is_correct,
        r.response_time,
        r.feedback,
        r.created_at,
        s.type as sim_type
      FROM results r
      LEFT JOIN simulations s ON r.simulation_id = s.id
      WHERE r.employee_id = 1 -- Mock current user
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all();
    res.json(reports);
  });

  app.post("/api/results", (req, res) => {
    const { employee_id, simulation_id, campaign_id, is_correct, response_time, feedback } = req.body;
    
    let simId = simulation_id;
    if (!simId) {
      const simInfo = db.prepare(`INSERT INTO simulations (type, difficulty) VALUES (?, ?)`).run('unknown', 1);
      simId = simInfo.lastInsertRowid;
    }

    const info = db.prepare(`
      INSERT INTO results (employee_id, simulation_id, campaign_id, is_correct, response_time, feedback)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(employee_id || 1, simId, campaign_id || null, is_correct ? 1 : 0, response_time || 0, feedback || "");
    
    // Update employee score
    if (!is_correct) {
      db.prepare("UPDATE employees SET security_score = MAX(0, security_score - 5) WHERE id = ?").run(employee_id || 1);
    } else {
      db.prepare("UPDATE employees SET security_score = MIN(100, security_score + 2) WHERE id = ?").run(employee_id || 1);
    }

    res.json({ id: info.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
