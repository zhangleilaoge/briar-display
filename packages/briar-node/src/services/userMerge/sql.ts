import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Param = string | number | null

export const exec = async (conn: PoolConnection, sql: string, params: Param[] = []) => {
	const [res] = await conn.execute<ResultSetHeader>(sql, params)
	return res.affectedRows
}

export const rows = async <T = RowDataPacket>(
	conn: PoolConnection,
	sql: string,
	params: Param[] = [],
) => {
	const [res] = await conn.execute<RowDataPacket[]>(sql, params)
	return res as unknown as T[]
}

export const count = async (conn: PoolConnection, sql: string, params: Param[] = []) => {
	const [res] = await conn.execute<RowDataPacket[]>(sql, params)
	return Number(res[0]?.n ?? 0)
}
