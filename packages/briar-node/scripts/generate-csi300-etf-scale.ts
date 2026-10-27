import { writeFile } from 'node:fs/promises'
import {
	CSI300_HISTORY_START,
	type Csi300EtfScaleSeed,
	assertDate,
	buildScaleData,
	latestCompletedMonth,
	monthBounds,
	monthKey,
} from '../src/services/market/csi300EtfScale'
import { fetchCompletedMonthSnapshots } from '../src/services/market/csi300EtfSources'

function option(name: string) {
	const index = process.argv.indexOf(name)
	if (index < 0) return undefined
	const value = process.argv[index + 1]
	if (!value || value.startsWith('--')) throw new Error(`${name} 需要 YYYY-MM-DD 参数`)
	return assertDate(value)
}

const unknown = process.argv.slice(2).filter((arg, index, args) => {
	if (arg === '--from' || arg === '--to') return false
	return args[index - 1] !== '--from' && args[index - 1] !== '--to'
})
if (unknown.length > 0) throw new Error(`未知参数: ${unknown.join(', ')}`)

const now = Date.now()
const from = option('--from') ?? CSI300_HISTORY_START
const to = option('--to') ?? monthBounds(latestCompletedMonth(now)).end
if (from > to) throw new Error('--from 不能晚于 --to')
const endMonth = monthKey(to)

const snapshots = []
for (let month = monthKey(from); month <= endMonth; ) {
	console.log(`[csi300-etf-scale] 获取 ${month} 官方数据…`)
	const monthSnapshots = await fetchCompletedMonthSnapshots(month)
	if (monthSnapshots.length === 0) throw new Error(`${month} 官方月报尚未发布`)
	snapshots.push(
		...monthSnapshots.filter((snapshot) => snapshot.date >= from && snapshot.date <= to),
	)
	month = monthKey(
		new Date(Date.parse(`${monthBounds(month).end}T00:00:00Z`) + 86_400_000)
			.toISOString()
			.slice(0, 10),
	)
}

const seed: Csi300EtfScaleSeed = { generatedAt: now, snapshots }
const result = buildScaleData(snapshots)
const target = new URL('../src/services/market/csi300EtfScale.seed.json', import.meta.url)
await writeFile(target, `${JSON.stringify(seed, null, '\t')}\n`)
console.log(
	JSON.stringify(
		{
			target: target.pathname,
			days: snapshots.length,
			from: snapshots[0]?.date,
			to: result.asOf,
			latestRatioPct: result.points.at(-1)?.ratioPct,
			latestTotalAssets: result.points.at(-1)?.totalAssets,
		},
		null,
		2,
	),
)
