'use client'

import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'

type Artwork = {
	id: string
	title: string
	titleEn: string
	year: string
	medium: string
	collection: string
	statement: string
	image: string
	w: number
	h: number
}

const ARTWORKS: Artwork[] = [
	{
		id: 'ink-tide',
		title: '墨潮',
		titleEn: 'Ink Tide',
		year: '2026',
		medium: '数字流体 · 实时捕捉',
		collection: '夜潮',
		statement: '松烟在静水里慢慢打开。没有笔锋，只有一次足够慢的相遇。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/01-墨潮-Ink-Tide-1788967284613.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'chromatic-bloom',
		title: '虹核',
		titleEn: 'Chromatic Bloom',
		year: '2026',
		medium: '数字流体 · 高速色素',
		collection: '虹裂',
		statement: '两种不肯和解的颜色在同一粘度里相撞。边界比中心更诚实。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/02-虹核-Chromatic-Bloom-1788967302401.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'abyssal-pearl',
		title: '深渊之眼',
		titleEn: 'Abyssal Pearl',
		year: '2026',
		medium: '数字流体 · 树脂光泽',
		collection: '夜潮',
		statement: '珍珠色绕着一个不肯发光的核。观看本身成为漩涡。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/03-深渊之眼-Abyssal-Pearl-1788967304161.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'vermillion-rift',
		title: '朱裂',
		titleEn: 'Vermillion Rift',
		year: '2026',
		medium: '数字流体 · 水墨爆发',
		collection: '虹裂',
		statement: '朱砂不是装饰，是一次被允许的决裂。纸还没来得及吸干。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/04-朱裂-Vermillion-Rift-1788967305774.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'jade-silk',
		title: '翠绸',
		titleEn: 'Jade Silk',
		year: '2026',
		medium: '数字流体 · 油性褶皱',
		collection: '矿物',
		statement: '矿物学里的绿，在这里被当成可以折叠的布。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/05-翠绸-Jade-Silk-1788967307433.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'milk-bloom',
		title: '乳雾',
		titleEn: 'Milk Bloom',
		year: '2026',
		medium: '数字流体 · 层流扩散',
		collection: '呼吸',
		statement: '白色记得所有被它覆盖过的暗。安静，几乎没有声音。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/06-乳雾-Milk-Bloom-1788967309459.jpg',
		w: 1600,
		h: 1200,
	},
	{
		id: 'copper-resin',
		title: '铜河',
		titleEn: 'Copper River',
		year: '2026',
		medium: '数字流体 · 金属树脂',
		collection: '矿物',
		statement: '熔化之后仍选择流动。河床是黑的，河本身不肯冷却。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/07-铜河-Copper-River-1788967310877.jpg',
		w: 1200,
		h: 1600,
	},
	{
		id: 'celadon-breath',
		title: '青息',
		titleEn: 'Celadon Breath',
		year: '2026',
		medium: '数字流体 · 釉色扩散',
		collection: '呼吸',
		statement: '像一口还没散尽的青烟。轻，但不肯消失。',
		image:
			'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/images/08-青息-Celadon-Breath-1788967312744.jpg',
		w: 1200,
		h: 1600,
	},
]

const FILTERS = ['全部', '夜潮', '虹裂', '矿物', '呼吸'] as const

export default function AetherPage() {
	const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部')
	const [active, setActive] = useState<Artwork | null>(null)

	const list = useMemo(
		() => (filter === '全部' ? ARTWORKS : ARTWORKS.filter((a) => a.collection === filter)),
		[filter],
	)

	return (
		<div className="relative min-h-screen bg-zinc-950 text-zinc-100">
			<div className="pointer-events-none fixed inset-0 -z-10">
				<div className="absolute -left-[15%] top-[-10%] h-[45%] w-[45%] rounded-full bg-indigo-500/20 blur-[120px]" />
				<div className="absolute right-[-10%] top-[20%] h-[40%] w-[40%] rounded-full bg-fuchsia-500/15 blur-[110px]" />
				<div className="absolute bottom-[-5%] left-[25%] h-[35%] w-[35%] rounded-full bg-teal-500/10 blur-[100px]" />
			</div>

			<header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/70 backdrop-blur-md">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
					<a
						href="/briar/"
						className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
					>
						<ArrowLeft className="h-4 w-4" />
						门户
					</a>
					<div className="text-center">
						<p className="text-sm font-semibold tracking-[0.2em]">AETHER</p>
						<p className="text-[11px] text-zinc-500">流境 · 数字流体艺术馆</p>
					</div>
					<span className="w-14" />
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
				<section className="mb-10 max-w-2xl">
					<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">馆藏</h1>
					<p className="mt-3 text-sm leading-relaxed text-zinc-400">
						把颜色当作可以走进去的房间。手指是唯一的笔。以下八件是从实时流体里留下来的静帧。
					</p>
				</section>

				<div className="mb-8 flex flex-wrap gap-2">
					{FILTERS.map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => setFilter(item)}
							className={
								filter === item
									? 'rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-900'
									: 'rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10'
							}
						>
							{item}
						</button>
					))}
				</div>

				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{list.map((art) => (
						<button
							key={art.id}
							type="button"
							onClick={() => setActive(art)}
							className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
						>
							<div className="aspect-[3/4] overflow-hidden bg-zinc-900">
								<img
									src={art.image}
									alt={`${art.title} / ${art.titleEn}`}
									width={art.w}
									height={art.h}
									loading="lazy"
									className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
								/>
							</div>
							<div className="flex items-start justify-between gap-3 p-4">
								<div>
									<p className="text-base font-medium tracking-tight">{art.title}</p>
									<p className="mt-1 text-xs tracking-wide text-zinc-500">{art.titleEn}</p>
								</div>
								<p className="text-xs tabular-nums text-zinc-500">{art.year}</p>
							</div>
						</button>
					))}
				</div>
			</main>

			{active && (
				<dialog
					open
					className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/80 p-4 backdrop-blur-sm"
					onClick={() => setActive(null)}
					onCancel={(e) => {
						e.preventDefault()
						setActive(null)
					}}
				>
					<div
						className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl md:grid-cols-[1.2fr_0.8fr]"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="bg-black">
							<img
								src={active.image}
								alt={`${active.title} / ${active.titleEn}`}
								className="max-h-[50vh] w-full object-contain md:max-h-[90vh]"
							/>
						</div>
						<div className="flex flex-col justify-between gap-6 p-6">
							<div>
								<p className="text-xs tracking-[0.18em] text-zinc-500">{active.collection}</p>
								<h2 className="mt-2 text-2xl font-semibold tracking-tight">{active.title}</h2>
								<p className="mt-1 text-sm text-zinc-500">{active.titleEn}</p>
								<dl className="mt-6 space-y-2 text-sm text-zinc-400">
									<div className="flex gap-3">
										<dt className="w-10 shrink-0 text-zinc-600">年份</dt>
										<dd>{active.year}</dd>
									</div>
									<div className="flex gap-3">
										<dt className="w-10 shrink-0 text-zinc-600">媒介</dt>
										<dd>{active.medium}</dd>
									</div>
								</dl>
								<p className="mt-6 text-sm leading-relaxed text-zinc-300">{active.statement}</p>
							</div>
							<button
								type="button"
								onClick={() => setActive(null)}
								className="rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
							>
								关闭
							</button>
						</div>
					</div>
				</dialog>
			)}
		</div>
	)
}
