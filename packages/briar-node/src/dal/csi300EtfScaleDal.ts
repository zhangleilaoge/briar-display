import { execute, query } from '../lib/db'
import {
	type Csi300EtfFundSnapshot,
	type Csi300EtfSnapshot,
	createSnapshot,
} from '../services/market/csi300EtfScale'

interface Csi300EtfSnapshotRow {
	trade_date: string
	index_close: number | string
	float_market_cap: number | string
	funds: string | Csi300EtfFundSnapshot[]
}

function mapRow(row: Csi300EtfSnapshotRow): Csi300EtfSnapshot {
	const funds = typeof row.funds === 'string' ? JSON.parse(row.funds) : row.funds
	if (!Array.isArray(funds)) throw new Error(`${row.trade_date} ETF快照格式错误`)
	return createSnapshot(
		{
			date: row.trade_date,
			indexClose: Number(row.index_close),
			floatMarketCap: Number(row.float_market_cap),
		},
		Object.fromEntries(funds.map((fund) => [fund.code, fund.shares])),
		Object.fromEntries(
			funds.map((fund) => [fund.code, { date: row.trade_date, unitNav: fund.unitNav }]),
		),
	)
}

export const csi300EtfScaleDal = {
	async list(startDate: string): Promise<Csi300EtfSnapshot[]> {
		const rows = await query<Csi300EtfSnapshotRow>(
			`SELECT DATE_FORMAT(trade_date, '%Y-%m-%d') AS trade_date,
			 index_close, float_market_cap, funds
			 FROM market_csi300_etf_snapshots WHERE trade_date >= ? ORDER BY trade_date ASC`,
			[startDate],
		)
		return rows.map(mapRow)
	},

	async upsertMany(snapshots: readonly Csi300EtfSnapshot[]): Promise<void> {
		if (snapshots.length === 0) return
		const values = snapshots.flatMap((snapshot) => [
			snapshot.date,
			snapshot.indexClose,
			snapshot.floatMarketCap,
			JSON.stringify(snapshot.funds),
		])
		await execute(
			`INSERT INTO market_csi300_etf_snapshots
			 (trade_date, index_close, float_market_cap, funds)
			 VALUES ${snapshots.map(() => '(?, ?, ?, ?)').join(', ')}
			 ON DUPLICATE KEY UPDATE index_close = VALUES(index_close),
			 float_market_cap = VALUES(float_market_cap), funds = VALUES(funds)`,
			values,
		)
	},
}
