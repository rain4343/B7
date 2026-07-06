import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, rolesTable, usersTable, departmentsTable, roleUserTable } from "@workspace/db";
import { CreateRoleBody, DeleteRoleParams, GetRoleUsersParams } from "@workspace/api-zod";

const router = Router();

// GET /roles
router.get("/roles", async (_req, res) => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  res.json(roles);
});

// POST /roles
router.post("/roles", async (req, res) => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [existing] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, parsed.data.name)).limit(1);
  if (existing) return res.status(409).json({ error: "Role name already exists" });

  const [role] = await db.insert(rolesTable).values({ name: parsed.data.name }).returning();
  return res.status(201).json(role);
});

// DELETE /roles/:id
router.delete("/roles/:id", async (req, res) => {
  const parsed = DeleteRoleParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid role ID" });

  const [role] = await db.delete(rolesTable).where(eq(rolesTable.id, parsed.data.id)).returning();
  if (!role) return res.status(404).json({ error: "Role not found" });
  return res.status(204).send();
});

// GET /roles/:id/users
router.get("/roles/:id/users", async (req, res) => {
  const parsed = GetRoleUsersParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid role ID" });

  const [role] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.id, parsed.data.id)).limit(1);
  if (!role) return res.status(404).json({ error: "Role not found" });

  const memberIds = await db
    .select({ user_id: roleUserTable.user_id })
    .from(roleUserTable)
    .where(eq(roleUserTable.role_id, parsed.data.id));
  const userIds = memberIds.map((m) => m.user_id);

  if (userIds.length === 0) return res.json([]);

  const users = await db
    .select({
      id: usersTable.id,
      full_name: usersTable.full_name,
      username: usersTable.username,
      email: usersTable.email,
      department_id: usersTable.department_id,
      department_name: departmentsTable.name,
      created_at: usersTable.created_at,
      updated_at: usersTable.updated_at,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.department_id, departmentsTable.id))
    .where(inArray(usersTable.id, userIds))
    .orderBy(usersTable.full_name);

  const roleRows = await db
    .select({ user_id: roleUserTable.user_id, role_id: rolesTable.id, role_name: rolesTable.name })
    .from(roleUserTable)
    .innerJoin(rolesTable, eq(roleUserTable.role_id, rolesTable.id))
    .where(inArray(roleUserTable.user_id, userIds));

  const roleMap: Record<number, { id: number; name: string }[]> = {};
  for (const r of roleRows) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push({ id: r.role_id, name: r.role_name });
  }

  return res.json(users.map((u) => ({ ...u, roles: roleMap[u.id] ?? [] })));
});

export default router;
