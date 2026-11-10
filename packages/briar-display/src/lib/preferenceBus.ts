/**
 * 同页多处订阅同一用户偏好时的内存广播：侧栏和个人中心「设置」各自持有 hook 实例，
 * 任一处提交（或保存失败回滚）后通知其它实例同步，避免要刷新才生效。
 */
type Listener = (value: unknown, source: symbol) => void

const listeners = new Map<string, Set<Listener>>()

export function publishPreference(key: string, value: unknown, source: symbol): void {
	const set = listeners.get(key)
	if (!set) return
	for (const listener of [...set]) listener(value, source)
}

export function subscribePreference(key: string, listener: Listener): () => void {
	let set = listeners.get(key)
	if (!set) {
		set = new Set()
		listeners.set(key, set)
	}
	set.add(listener)
	return () => {
		set?.delete(listener)
	}
}
