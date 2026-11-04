import { ArrowUpRight, BookOpen, CalendarDays, Check, Feather, Mail, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
	RococoBreadcrumb,
	RococoButton,
	RococoCalendar,
	RococoDialog,
	RococoInput,
	RococoLabel,
	RococoSelect,
	RococoSidebarTag,
	RococoTextarea,
} from './RococoPrimitives'

const chapters = [
	{ id: 'rococo-salon', label: 'Le salon', icon: <BookOpen size={17} strokeWidth={1.4} /> },
	{
		id: 'rococo-correspondence',
		label: 'Correspondance',
		icon: <Mail size={17} strokeWidth={1.4} />,
	},
	{
		id: 'rococo-calendar',
		label: 'Le calendrier',
		icon: <CalendarDays size={17} strokeWidth={1.4} />,
	},
]

function jumpToChapter(id: string) {
	document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function RococoShowcase() {
	const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
	const [activeChapter, setActiveChapter] = useState(chapters[0].id)
	const [saved, setSaved] = useState(false)
	const [name, setName] = useState('')
	const [note, setNote] = useState('')
	const labRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		setPortalContainer(labRef.current)
	}, [])

	return (
		<div className="rococo-lab" ref={labRef}>
			<div className="rococo-frame">
				<header className="rococo-masthead">
					<a className="rococo-wordmark" href="#rococo-salon" aria-label="Rococo 实验页顶部">
						<span>R</span>
						<span>
							Petit salon<small>Objets de papeterie</small>
						</span>
					</a>
					<span className="rococo-masthead__edition">ÉTUDE D’INTERFACE · No. 01</span>
					<span className="rococo-masthead__note">Un peu de légèreté.</span>
				</header>
				<div className="rococo-layout">
					<aside className="rococo-sidebar" aria-label="实验章节">
						<p className="rococo-eyebrow">SOMMAIRE</p>
						<div className="rococo-sidebar__tags">
							{chapters.map((chapter, index) => (
								<RococoSidebarTag
									key={chapter.id}
									active={activeChapter === chapter.id}
									icon={chapter.icon}
									onClick={() => {
										setActiveChapter(chapter.id)
										jumpToChapter(chapter.id)
									}}
								>
									<span className="rococo-sidebar-tag__index">0{index + 1}</span>
									{chapter.label}
								</RococoSidebarTag>
							))}
						</div>
						<div className="rococo-sidebar__footnote">
							<span className="rococo-script">À la carte</span>
							<p>
								装饰不必喧哗，
								<br />
								它可以只是恰到好处。
							</p>
							<span className="rococo-sidebar__rule" aria-hidden="true" />
							<small>独立实验 · 不影响现有主题</small>
						</div>
					</aside>
					<main className="rococo-main">
						<section className="rococo-hero" id="rococo-salon">
							<div>
								<p className="rococo-eyebrow">LA NOUVELLE COLLECTION</p>
								<h1>
									Rococo<span className="rococo-script">en douceur</span>
								</h1>
								<p className="rococo-hero__description">
									把巴洛克的隆重放下，
									<br />
									留下一点曲线、光，与呼吸。
								</p>
							</div>
							<div className="rococo-hero__seal" aria-hidden="true">
								<span>R</span>
								<small>XVIII</small>
							</div>
						</section>

						<section className="rococo-section" aria-labelledby="rococo-navigation-title">
							<div className="rococo-section__heading">
								<span>01</span>
								<div>
									<p className="rococo-eyebrow">LES ESSENTIELS</p>
									<h2 id="rococo-navigation-title">轻巧的动作</h2>
								</div>
								<span className="rococo-section__line" aria-hidden="true" />
							</div>
							<RococoBreadcrumb
								items={[
									{ label: 'Le salon', href: '#rococo-salon' },
									{ label: 'Collection', href: '#rococo-correspondence' },
									{ label: 'Étude 01' },
								]}
							/>
							<div className="rococo-button-row">
								<RococoDialog portalContainer={portalContainer} />
								<RococoButton onClick={() => setSaved(!saved)} aria-pressed={saved}>
									{saved ? (
										<Check size={15} strokeWidth={1.5} />
									) : (
										<Feather size={15} strokeWidth={1.5} />
									)}
									{saved ? '已收藏' : '收进手册'}
								</RococoButton>
								<a className="rococo-text-link" href="#rococo-correspondence">
									看一封信 <ArrowUpRight size={15} strokeWidth={1.4} />
								</a>
							</div>
						</section>

						<section
							className="rococo-section"
							id="rococo-correspondence"
							aria-labelledby="rococo-letter-title"
						>
							<div className="rococo-section__heading">
								<span>02</span>
								<div>
									<p className="rococo-eyebrow">CORRESPONDANCE</p>
									<h2 id="rococo-letter-title">纸上的问候</h2>
								</div>
								<span className="rococo-section__line" aria-hidden="true" />
							</div>
							<form className="rococo-letter" onSubmit={(event) => event.preventDefault()}>
								<div className="rococo-letter__row">
									<div className="rococo-field">
										<RococoLabel htmlFor="rococo-name">
											你的名字 <span>VOTRE NOM</span>
										</RococoLabel>
										<RococoInput
											id="rococo-name"
											value={name}
											onChange={(event) => setName(event.target.value)}
											placeholder="如何称呼你？"
										/>
									</div>
									<div className="rococo-field">
										<RococoLabel htmlFor="rococo-paper">
											信纸颜色 <span>LE PAPIER</span>
										</RococoLabel>
										<RococoSelect id="rococo-paper" portalContainer={portalContainer} />
									</div>
								</div>
								<div className="rococo-field">
									<RococoLabel htmlFor="rococo-note">
										只言片语 <span>QUELQUES MOTS</span>
									</RococoLabel>
									<RococoTextarea
										id="rococo-note"
										value={note}
										onChange={(event) => setNote(event.target.value)}
										placeholder="从这里开始，写一点今天的见闻…"
										rows={3}
									/>
									<span className="rococo-field__hint">不必很长，真诚就好。</span>
								</div>
								<div className="rococo-letter__footer">
									<span>Écrit à la main, avec le cœur.</span>
									<RococoButton type="submit" variant="quiet">
										<Send size={14} strokeWidth={1.4} />
										封存草稿
									</RococoButton>
								</div>
							</form>
						</section>

						<section
							className="rococo-section rococo-section--calendar"
							id="rococo-calendar"
							aria-labelledby="rococo-calendar-title"
						>
							<div className="rococo-section__heading">
								<span>03</span>
								<div>
									<p className="rococo-eyebrow">LES JOURS HEUREUX</p>
									<h2 id="rococo-calendar-title">为今天留白</h2>
								</div>
								<span className="rococo-section__line" aria-hidden="true" />
							</div>
							<div className="rococo-calendar-layout">
								<RococoCalendar />
								<div className="rococo-calendar-note">
									<span className="rococo-script">Un jour à la fois</span>
									<p>
										日子是连续的，
										<br />
										但每一天都可以有自己的颜色。
									</p>
									<span>轻盈的蓝 · 温润的金 · 一点玫瑰</span>
								</div>
							</div>
						</section>
					</main>
				</div>
				<footer className="rococo-footer">
					<span>PETIT SALON — ROCOCO UI STUDY</span>
					<span>独立实验，不替代现有组件</span>
					<span>FIN · 01</span>
				</footer>
			</div>
		</div>
	)
}
