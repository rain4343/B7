import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, departmentsTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

interface ImportRow {
  full_name: string;
  username: string;
  email: string;
  password?: string;
  department_name?: string;
}

// POST /api/users/import  — parse + bulk insert from Excel
router.post("/users/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "فایلێک نەگەیشت" });
    return;
  }

  let rows: ImportRow[];
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    rows = raw.map((r) => ({
      full_name: String(r["ناوی تەواو"] ?? r["full_name"] ?? "").trim(),
      username: String(r["ناوی بەکارهێنەر"] ?? r["username"] ?? "").trim(),
      email: String(r["ئیمەیڵ"] ?? r["email"] ?? "").trim(),
      password: String(r["ووشەی نهێنی"] ?? r["password"] ?? "").trim() || undefined,
      department_name: String(r["هۆبە"] ?? r["department"] ?? "").trim() || undefined,
    }));
  } catch (err) {
    logger.error({ err }, "Excel parse error");
    res.status(400).json({ error: "فایلەکە درووست نییە یان خراپ بووە" });
    return;
  }

  // Validate
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.full_name) errors.push(`ڕیزی ${row}: ناوی تەواو پێویستە`);
    if (!r.username) errors.push(`ڕیزی ${row}: ناوی بەکارهێنەر پێویستە`);
    if (!r.email || !r.email.includes("@")) errors.push(`ڕیزی ${row}: ئیمەیڵ دروست نییە`);
  });
  if (errors.length) { res.status(400).json({ errors }); return; }

  // Pre-load department names -> ids
  const deptNames = [...new Set(rows.map(r => r.department_name).filter(Boolean))] as string[];
  const deptMap: Record<string, number> = {};
  for (const name of deptNames) {
    const [dept] = await db.select({ id: departmentsTable.id })
      .from(departmentsTable)
      .where(ilike(departmentsTable.name, name))
      .limit(1);
    if (dept) deptMap[name] = dept.id;
  }

  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const plainPw = r.password || r.username;
      const hashed = await bcrypt.hash(plainPw, 10);
      const dept_id = r.department_name ? (deptMap[r.department_name] ?? null) : null;

      await db.insert(usersTable).values({
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        password: hashed,
        department_id: dept_id,
      });
      results.inserted++;
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        results.skipped++;
        results.errors.push(`ڕیزی ${rowNum} (${r.username}): پێشتر تۆمارکراوە`);
      } else {
        results.errors.push(`ڕیزی ${rowNum}: ${msg}`);
      }
    }
  }

  res.json(results);
});

// GET /api/users/import/template  — download Excel template
router.get("/users/import/template", (_req, res) => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["ناوی تەواو", "ناوی بەکارهێنەر", "ئیمەیڵ", "ووشەی نهێنی", "هۆبە"],
    ["ئاوات ئەحمەد", "awat.ahmad", "awat@example.com", "123456", "مامۆستایان"],
    ["سارا محەمەد", "sara.m", "sara@example.com", "", "کارگێڕی"],
  ]);

  // Column widths
  ws["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "فەرمانبەران");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", 'attachment; filename="staff-template.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

export default router;
