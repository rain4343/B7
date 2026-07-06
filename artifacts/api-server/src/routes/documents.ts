import { Router } from "express";
import { eq, ilike, and, desc, type SQL } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { db, documentsTable, documentLogsTable, usersTable, departmentsTable } from "@workspace/db";
import {
  UpdateDocumentBody,
  GetDocumentParams,
  UpdateDocumentParams,
  DeleteDocumentParams,
  ListDocumentLogsParams,
  CreateDocumentLogParams,
  CreateDocumentLogBody,
  ListDocumentsQueryParams,
  ReplaceDocumentAttachmentParams,
  ForwardDocumentParams,
  ForwardDocumentBody,
} from "@workspace/api-zod";
import { getUserRoleNames } from "./auth";

const router = Router();

// Role name that grants document-forwarding permission, in addition to the
// hardcoded super admin (user id 1).
export const FORWARD_DOCUMENTS_ROLE = "ئاڕاستەکردنی نووسراو";

async function canForwardDocuments(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  if (userId === 1) return true;
  const roles = await getUserRoleNames(userId);
  return roles.includes(FORWARD_DOCUMENTS_ROLE);
}

// ── File upload setup ─────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads", "attachments");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("PDF files only"));
    }
  },
});


// ── Helpers ───────────────────────────────────────────────────
async function getDocumentWithCreator(id: number) {
  const [doc] = await db
    .select({
      id: documentsTable.id,
      document_number: documentsTable.document_number,
      document_date: documentsTable.document_date,
      subject: documentsTable.subject,
      creator_id: documentsTable.creator_id,
      creator_name: usersTable.full_name,
      current_status: documentsTable.current_status,
      file_path: documentsTable.file_path,
      created_at: documentsTable.created_at,
      updated_at: documentsTable.updated_at,
    })
    .from(documentsTable)
    .leftJoin(usersTable, eq(documentsTable.creator_id, usersTable.id))
    .where(eq(documentsTable.id, id))
    .limit(1);
  return doc;
}

// ── Routes ────────────────────────────────────────────────────

// GET /documents/next-number
// Must be registered before /documents/:id to avoid route conflict
router.get("/documents/next-number", async (_req, res) => {
  const [last] = await db
    .select({ document_number: documentsTable.document_number })
    .from(documentsTable)
    .orderBy(desc(documentsTable.id))
    .limit(1);

  let nextNum = 1;
  if (last) {
    const match = last.document_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return res.json({ next_number: String(nextNum).padStart(3, "0") });
});

// GET /documents
router.get("/documents", async (req, res) => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query parameters" });
  const { search, status } = parsed.data;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(documentsTable.subject, `%${search}%`));
  if (status) conditions.push(eq(documentsTable.current_status, status));

  const rows = await db
    .select({
      id: documentsTable.id,
      document_number: documentsTable.document_number,
      document_date: documentsTable.document_date,
      subject: documentsTable.subject,
      creator_id: documentsTable.creator_id,
      creator_name: usersTable.full_name,
      current_status: documentsTable.current_status,
      file_path: documentsTable.file_path,
      created_at: documentsTable.created_at,
      updated_at: documentsTable.updated_at,
    })
    .from(documentsTable)
    .leftJoin(usersTable, eq(documentsTable.creator_id, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(documentsTable.document_date));

  return res.json(rows);
});

// POST /documents — multipart/form-data with PDF attachment
router.post("/documents", upload.single("attachment"), async (req, res) => {
  const creatorId = req.session?.userId;
  if (!creatorId) return res.status(401).json({ error: "Authentication required" });

  if (!req.file) return res.status(400).json({ error: "PDF attachment is required" });

  const { document_number, document_date, subject, current_status } = req.body as Record<string, string>;
  if (!document_number?.trim() || !document_date?.trim() || !subject?.trim()) {
    return res.status(400).json({ error: "document_number, document_date, and subject are required" });
  }
  if (document_number.length > 100 || subject.length > 255) {
    return res.status(400).json({ error: "Field exceeds maximum length" });
  }

  const [existing] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(eq(documentsTable.document_number, document_number.trim()))
    .limit(1);
  if (existing) return res.status(409).json({ error: "Document number already exists" });

  const filePath = `attachments/${req.file.filename}`;

  const parsedDate = new Date(document_date.trim());
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: "Invalid document_date format" });
  }

  const [doc] = await db
    .insert(documentsTable)
    .values({
      document_number: document_number.trim(),
      document_date: parsedDate.toISOString().slice(0, 10),
      subject: subject.trim(),
      file_path: filePath,
      creator_id: creatorId,
      current_status: current_status?.trim() || "نوێ",
    })
    .returning();

  await db.insert(documentLogsTable).values({
    document_id: doc.id,
    user_id: creatorId,
    action: "نوسراوەکە دروستکرا",
    notes: null,
  });

  const result = await getDocumentWithCreator(doc.id);
  return res.status(201).json(result);
});

// GET /documents/:id
router.get("/documents/:id", async (req, res) => {
  const parsed = GetDocumentParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const doc = await getDocumentWithCreator(parsed.data.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.json(doc);
});

// POST /documents/:id/attachment — replace the PDF attachment
router.post("/documents/:id/attachment", upload.single("attachment"), async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const paramParsed = ReplaceDocumentAttachmentParams.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid document ID" });

  if (!req.file) return res.status(400).json({ error: "PDF attachment is required" });

  const [existing] = await db
    .select({ id: documentsTable.id, file_path: documentsTable.file_path })
    .from(documentsTable)
    .where(eq(documentsTable.id, paramParsed.data.id))
    .limit(1);

  if (!existing) {
    // Clean up the uploaded file since the document doesn't exist.
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Document not found" });
  }

  const newFilePath = `attachments/${req.file.filename}`;
  const oldFilePath = existing.file_path;

  await db
    .update(documentsTable)
    .set({ file_path: newFilePath, updated_at: new Date() })
    .where(eq(documentsTable.id, paramParsed.data.id));

  await db.insert(documentLogsTable).values({
    document_id: paramParsed.data.id,
    user_id: userId,
    action: "هاوپێچی نووسراو نوێکرایەوە",
    notes: null,
  });

  // Remove the old file from disk now that the DB record points to the new one.
  if (oldFilePath) {
    const oldAbsolutePath = path.join(process.cwd(), "uploads", oldFilePath);
    fs.unlink(oldAbsolutePath, () => {});
  }

  const result = await getDocumentWithCreator(paramParsed.data.id);
  return res.json(result);
});

// POST /documents/:id/forward
router.post("/documents/:id/forward", async (req, res) => {
  const allowed = await canForwardDocuments(req.session?.userId);
  if (!allowed) {
    return res.status(403).json({ error: "تۆ دەسەڵاتی ئاڕاستەکردنی نووسراوت نییە" });
  }

  const paramParsed = ForwardDocumentParams.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const parsed = ForwardDocumentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [existing] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(eq(documentsTable.id, paramParsed.data.id))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Document not found" });

  const [department] = await db
    .select({ id: departmentsTable.id, name: departmentsTable.name })
    .from(departmentsTable)
    .where(eq(departmentsTable.id, parsed.data.department_id))
    .limit(1);
  if (!department) return res.status(400).json({ error: "Department not found" });

  const newStatus = `ئاڕاستەکرا بۆ: ${department.name}`;

  await db
    .update(documentsTable)
    .set({ current_status: newStatus, updated_at: new Date() })
    .where(eq(documentsTable.id, paramParsed.data.id));

  await db.insert(documentLogsTable).values({
    document_id: paramParsed.data.id,
    user_id: req.session?.userId ?? null,
    action: `نووسراوەکە ئاڕاستەکرا بۆ: ${department.name}`,
    notes: parsed.data.notes || null,
  });

  const result = await getDocumentWithCreator(paramParsed.data.id);
  return res.json(result);
});

// PATCH /documents/:id
router.patch("/documents/:id", async (req, res) => {
  const paramParsed = UpdateDocumentParams.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [exists] = await db
    .select({ id: documentsTable.id, current_status: documentsTable.current_status })
    .from(documentsTable)
    .where(eq(documentsTable.id, paramParsed.data.id))
    .limit(1);
  if (!exists) return res.status(404).json({ error: "Document not found" });

  if (parsed.data.document_number) {
    const [dup] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(eq(documentsTable.document_number, parsed.data.document_number))
      .limit(1);
    if (dup && dup.id !== paramParsed.data.id)
      return res.status(409).json({ error: "Document number already exists" });
  }

  await db
    .update(documentsTable)
    .set({
      ...parsed.data,
      document_date: parsed.data.document_date
        ? parsed.data.document_date.toISOString().slice(0, 10)
        : undefined,
      updated_at: new Date(),
    })
    .where(eq(documentsTable.id, paramParsed.data.id));

  if (parsed.data.current_status && parsed.data.current_status !== exists.current_status) {
    await db.insert(documentLogsTable).values({
      document_id: paramParsed.data.id,
      user_id: req.session?.userId ?? null,
      action: `دۆخ گۆڕدرا بۆ: ${parsed.data.current_status}`,
      notes: null,
    });
  } else {
    await db.insert(documentLogsTable).values({
      document_id: paramParsed.data.id,
      user_id: req.session?.userId ?? null,
      action: "نوێکرایەوە",
      notes: null,
    });
  }

  const result = await getDocumentWithCreator(paramParsed.data.id);
  return res.json(result);
});

// DELETE /documents/:id
router.delete("/documents/:id", async (req, res) => {
  const parsed = DeleteDocumentParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, parsed.data.id))
    .returning();
  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.status(204).send();
});

// GET /documents/:id/logs
router.get("/documents/:id/logs", async (req, res) => {
  const parsed = ListDocumentLogsParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(eq(documentsTable.id, parsed.data.id))
    .limit(1);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const logs = await db
    .select({
      id: documentLogsTable.id,
      document_id: documentLogsTable.document_id,
      user_id: documentLogsTable.user_id,
      user_name: usersTable.full_name,
      action: documentLogsTable.action,
      notes: documentLogsTable.notes,
      timestamp: documentLogsTable.timestamp,
    })
    .from(documentLogsTable)
    .leftJoin(usersTable, eq(documentLogsTable.user_id, usersTable.id))
    .where(eq(documentLogsTable.document_id, parsed.data.id))
    .orderBy(documentLogsTable.timestamp); // asc — oldest first, matching original model

  return res.json(logs);
});

// POST /documents/:id/logs
router.post("/documents/:id/logs", async (req, res) => {
  const paramParsed = CreateDocumentLogParams.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid document ID" });

  const parsed = CreateDocumentLogBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(eq(documentsTable.id, paramParsed.data.id))
    .limit(1);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const [log] = await db
    .insert(documentLogsTable)
    .values({
      document_id: paramParsed.data.id,
      user_id: req.session?.userId ?? null,
      action: parsed.data.action,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  return res.status(201).json(log);
});

// POST /documents/:id/sign — embed the current user's signature onto the PDF
router.post("/documents/:id/sign", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const docId = parseInt(req.params.id, 10);
  if (isNaN(docId)) return res.status(400).json({ error: "Invalid document ID" });

  // Load document + user in parallel
  const [[doc], [user]] = await Promise.all([
    db
      .select({ id: documentsTable.id, file_path: documentsTable.file_path })
      .from(documentsTable)
      .where(eq(documentsTable.id, docId))
      .limit(1),
    db
      .select({ id: usersTable.id, full_name: usersTable.full_name, signature_image: usersTable.signature_image })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
  ]);

  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (!user?.signature_image) {
    return res.status(422).json({ error: "تۆ هێشتا ئیمزای ئەلیکترۆنیت نەناردووە. تکایە لە پرۆفایلەکەت ئیمزاکەت زیاد بکە." });
  }

  // Read files from disk
  const pdfAbsPath = path.join(process.cwd(), "uploads", doc.file_path);
  if (!fs.existsSync(pdfAbsPath)) {
    return res.status(404).json({ error: "فایلی PDF نەدۆزرایەوە" });
  }

  const sigFilename = path.basename(user.signature_image);
  const sigAbsPath = path.join(process.cwd(), "uploads", "signatures", sigFilename);
  if (!fs.existsSync(sigAbsPath)) {
    return res.status(422).json({ error: "فایلی ئیمزا نەدۆزرایەوە. تکایە ئیمزاکەت دووبارە بارگیری بکە." });
  }

  const [pdfBytes, sigBytes] = await Promise.all([
    fs.promises.readFile(pdfAbsPath),
    fs.promises.readFile(sigAbsPath),
  ]);

  // Embed signature onto the last page
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  const ext = path.extname(sigFilename).toLowerCase();
  let sigImage;
  if (ext === ".png") {
    sigImage = await pdfDoc.embedPng(sigBytes);
  } else {
    sigImage = await pdfDoc.embedJpg(sigBytes);
  }

  // Scale the signature so it fits in a ~160×80 pt box, preserving aspect ratio
  const maxW = 160, maxH = 80;
  const { width: iw, height: ih } = sigImage.size();
  const scale = Math.min(maxW / iw, maxH / ih);
  const sigW = iw * scale;
  const sigH = ih * scale;

  // Place at bottom-left with 30pt margin (RTL: right side = width - margin - sigW)
  const x = width - sigW - 30;
  const y = 30;

  lastPage.drawImage(sigImage, { x, y, width: sigW, height: sigH });

  // Save signed PDF to a new file (keep original intact)
  const signedBytes = await pdfDoc.save();
  const newFilename = `signed-${Date.now()}-${path.basename(doc.file_path)}`;
  const newAbsPath = path.join(process.cwd(), "uploads", "attachments", newFilename);
  await fs.promises.writeFile(newAbsPath, signedBytes);

  const newFilePath = `attachments/${newFilename}`;

  // Update DB and log
  await db
    .update(documentsTable)
    .set({ file_path: newFilePath, updated_at: new Date() })
    .where(eq(documentsTable.id, docId));

  await db.insert(documentLogsTable).values({
    document_id: docId,
    user_id: userId,
    action: `ئیمزای ئەلیکترۆنی کرا`,
    notes: `ئیمزاکرا لەلایەن: ${user.full_name}`,
  });

  const result = await getDocumentWithCreator(docId);
  return res.json(result);
});

// GET /documents/uploads/attachments/:filename — authenticated file download
// file_path in DB is stored as "attachments/<filename>", so this route mirrors that shape.
router.get("/documents/uploads/attachments/:filename", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(process.cwd(), "uploads", "attachments", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  return res.sendFile(filePath);
});

export default router;
