import { generateId } from "@briar/shared"
import { query, queryOne, execute } from "../lib/db"

export interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt?: Date
}

interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string
  created_at: Date
  updated_at: Date
}

const mapRowToRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const userDal = {
  async list(): Promise<UserRecord[]> {
    const rows = await query<UserRow>(
      "SELECT id, name, email, password_hash, created_at, updated_at FROM users ORDER BY created_at DESC",
    )
    return rows.map(mapRowToRecord)
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = ?",
      [email],
    )
    return row ? mapRowToRecord(row) : null
  },

  async findById(id: string): Promise<UserRecord | null> {
    const row = await queryOne<UserRow>(
      "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE id = ?",
      [id],
    )
    return row ? mapRowToRecord(row) : null
  },

  async create(
    data: Omit<UserRecord, "id" | "createdAt">,
  ): Promise<UserRecord> {
    const id = generateId()
    await execute(
      "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
      [id, data.name, data.email, data.passwordHash],
    )

    const record = await userDal.findById(id)
    if (!record) {
      throw new Error("Failed to create user")
    }
    return record
  },

  async update(
    id: string,
    data: Partial<Omit<UserRecord, "id" | "createdAt">>,
  ): Promise<UserRecord | null> {
    const updates: string[] = []
    const values: any[] = []

    if (data.name !== undefined) {
      updates.push("name = ?")
      values.push(data.name)
    }
    if (data.email !== undefined) {
      updates.push("email = ?")
      values.push(data.email)
    }
    if (data.passwordHash !== undefined) {
      updates.push("password_hash = ?")
      values.push(data.passwordHash)
    }

    if (updates.length === 0) {
      return userDal.findById(id)
    }

    values.push(id)
    await execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values)

    return userDal.findById(id)
  },

  async delete(id: string): Promise<boolean> {
    const result = await execute("DELETE FROM users WHERE id = ?", [id])
    return result.affectedRows > 0
  },
}
