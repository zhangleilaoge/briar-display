export function thoughtVisibilityCondition(viewerId?: string | null, alias = 't') {
	return viewerId
		? { sql: ` AND (${alias}.is_private = 0 OR ${alias}.user_id = ?)`, params: [viewerId] }
		: { sql: ` AND ${alias}.is_private = 0`, params: [] }
}
