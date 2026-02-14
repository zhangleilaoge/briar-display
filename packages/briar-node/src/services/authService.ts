import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import type { User } from "@briar/shared"
import { AUTH_CONFIG } from "../config/auth"
import { userDal, type UserRecord } from "../dal/userDal"

export interface AuthPayload {
  sub: string
  email: string
  name: string
}

const toPublicUser = (record: UserRecord): User => ({
  id: record.id,
  name: record.name,
  email: record.email,
  createdAt: record.createdAt,
})

/**
 * 创建默认管理员账户
 */
const seedDefaultUser = async () => {
  try {
    const existing = await userDal.findByEmail("admin@briar.dev")
    if (existing) {
      return
    }

    const passwordHash = await bcrypt.hash("admin123", 10)
    await userDal.create({
      name: "Briar Admin",
      email: "admin@briar.dev",
      passwordHash,
    })
    console.log("✅ 默认管理员账户已创建")
  } catch (error) {
    console.error("❌ 创建默认管理员账户失败:", error)
  }
}

// 延迟执行，确保数据库连接已建立
setTimeout(() => {
  seedDefaultUser()
}, 1000)

export const authService = {
  async register(name: string, email: string, password: string) {
    const existing = await userDal.findByEmail(email)
    if (existing) {
      throw new Error("EMAIL_EXISTS")
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const record = await userDal.create({ name, email, passwordHash })
    const token = authService.createToken(record)
    return { user: toPublicUser(record), token }
  },

  async login(email: string, password: string) {
    const record = await userDal.findByEmail(email)
    if (!record) {
      throw new Error("INVALID_CREDENTIALS")
    }

    const match = await bcrypt.compare(password, record.passwordHash)
    if (!match) {
      throw new Error("INVALID_CREDENTIALS")
    }

    const token = authService.createToken(record)
    return { user: toPublicUser(record), token }
  },

  createToken(record: UserRecord) {
    const payload: AuthPayload = {
      sub: record.id,
      email: record.email,
      name: record.name,
    }

    return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
      expiresIn: AUTH_CONFIG.jwtExpiresIn,
    })
  },

  verifyToken(token: string) {
    return jwt.verify(token, AUTH_CONFIG.jwtSecret) as AuthPayload
  },

  async getUserById(id: string) {
    const record = await userDal.findById(id)
    return record ? toPublicUser(record) : null
  },
}
