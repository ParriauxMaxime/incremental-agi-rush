import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express from "express";

const app = express();
const PORT = 3737;

const SPECS_DIR = path.resolve(import.meta.dirname, "../../specs/data");
const BALANCE_CHECK = path.resolve(import.meta.dirname, "../../specs/balance-check.js");

const ALLOWED_FILES = new Set([
	"tiers",
	"upgrades",
	"tech-tree",
	"ai-models",
	"balance",
	"events",
	"milestones",
]);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static files in production
app.use(express.static(path.resolve(import.meta.dirname, "dist")));

app.get("/api/data/:file", async (req, res) => {
	const file = req.params.file;
	if (!ALLOWED_FILES.has(file)) {
		res.status(404).json({ error: "Unknown file" });
		return;
	}
	try {
		const content = await fs.readFile(path.join(SPECS_DIR, `${file}.json`), "utf-8");
		res.json(JSON.parse(content));
	} catch (err) {
		res.status(500).json({ error: `Failed to read ${file}.json` });
	}
});

app.put("/api/data/:file", async (req, res) => {
	const file = req.params.file;
	if (!ALLOWED_FILES.has(file)) {
		res.status(404).json({ error: "Unknown file" });
		return;
	}
	try {
		const json = JSON.stringify(req.body, null, "\t");
		await fs.writeFile(path.join(SPECS_DIR, `${file}.json`), `${json}\n`);
		res.json({ ok: true });
	} catch {
		res.status(400).json({ error: "Invalid JSON" });
	}
});

app.post("/api/balance-check", (_req, res) => {
	execFile("node", [BALANCE_CHECK], { timeout: 30_000, cwd: path.dirname(BALANCE_CHECK) }, (err, stdout, stderr) => {
		const exitCode = err && "status" in err ? (err as { status: number }).status : err ? 1 : 0;
		res.json({ stdout, stderr, exitCode });
	});
});

// SPA fallback
app.get("/{*splat}", (_req, res) => {
	res.sendFile(path.resolve(import.meta.dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
	console.log(`Editor API running on http://localhost:${PORT}`);
});
