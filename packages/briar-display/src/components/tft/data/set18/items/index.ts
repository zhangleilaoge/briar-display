// 由 packages/briar-scripts/src/tft-set18/fetch.ts 生成，勿手改
import type { SetItem } from '../types'
import { ITEM_COMPONENTS } from './components'
import { CORRUPTED_ITEMS } from './corrupted'
import { CRAFTABLE_ITEMS } from './craftable'

export { ITEM_COMPONENTS }
export const ITEMS: SetItem[] = [...CRAFTABLE_ITEMS, ...CORRUPTED_ITEMS]
