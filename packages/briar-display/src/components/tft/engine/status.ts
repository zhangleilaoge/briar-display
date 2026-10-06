/** 战斗内状态效果框架：眩晕/昏睡/嘲讽/减速/重伤/破法/免控/不可选取 */

export type StatusKind =
	| 'stun'
	| 'sleep'
	| 'taunt'
	| 'slow'
	| 'wound'
	| 'manaReave'
	| 'ccImmune'
	| 'untargetable'
	| 'bleed'

export interface Status {
	kind: StatusKind
	/** 到期时间（战斗秒）；Infinity = 持续到战斗结束 */
	until: number
	/** 数值：slow=减速比例 wound=治疗削减 bleed=每秒伤害 taunt=无 */
	value: number
	/** 来源 uid（taunt 强制目标用） */
	source?: string
	/** sleep 专用：剩余可承受伤害，耗尽即醒来 */
	hpBudget?: number
}

export interface StatusHost {
	statuses: Status[]
}

export function addStatus(host: StatusHost, s: Status) {
	// 同类状态取更强/更晚到期，不无限叠加（bleed 除外，由调用方叠层）
	if (s.kind !== 'bleed') {
		const old = host.statuses.find((x) => x.kind === s.kind)
		if (old) {
			if (s.until >= old.until) Object.assign(old, s)
			return
		}
	}
	host.statuses.push(s)
}

export function hasStatus(host: StatusHost, kind: StatusKind, t: number): boolean {
	return host.statuses.some((s) => s.kind === kind && s.until > t)
}

export function getStatus(host: StatusHost, kind: StatusKind, t: number): Status | undefined {
	return host.statuses.find((s) => s.kind === kind && s.until > t)
}

/** 净化：移除所有限制类状态 */
export function cleanse(host: StatusHost) {
	host.statuses = host.statuses.filter(
		(s) => !(['stun', 'sleep', 'taunt', 'slow'] as StatusKind[]).includes(s.kind),
	)
}

/** 是否被硬控（不能行动） */
export function isDisabled(host: StatusHost, t: number): boolean {
	return hasStatus(host, 'stun', t) || hasStatus(host, 'sleep', t)
}

/** 攻速乘区（slow 叠加取最强） */
export function slowFactor(host: StatusHost, t: number): number {
	let f = 1
	for (const s of host.statuses) {
		if (s.kind === 'slow' && s.until > t) f = Math.min(f, 1 - s.value)
	}
	return f
}

/** 治疗乘区（重伤） */
export function healFactor(host: StatusHost, t: number): number {
	const s = getStatus(host, 'wound', t)
	return s ? 1 - s.value : 1
}

/** 尝试施加控制；目标免控时返回 false */
export function applyCc(host: StatusHost, s: Status, t: number): boolean {
	if (hasStatus(host, 'ccImmune', t)) return false
	addStatus(host, s)
	return true
}
