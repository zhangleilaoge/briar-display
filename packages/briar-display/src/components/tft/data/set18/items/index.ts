// 由 packages/briar-scripts/src/tft-set18/fetch.ts 生成，勿手改
import type { SetItem } from '../types'
import { ARTIFACT_ITEMS } from './artifacts'
import { ITEM_COMPONENTS } from './components'
import { CORRUPTED_ITEMS } from './corrupted'
import { CRAFTABLE_ITEMS } from './craftable'
import { RADIANT_ITEMS } from './radiant'

export { ARTIFACT_ITEMS, ITEM_COMPONENTS, RADIANT_ITEMS }
export const ITEMS: SetItem[] = [
	...CRAFTABLE_ITEMS,
	...CORRUPTED_ITEMS,
	...ARTIFACT_ITEMS,
	...RADIANT_ITEMS,
]
