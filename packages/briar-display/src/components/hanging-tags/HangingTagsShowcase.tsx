import { Move, RotateCcw, Wind } from 'lucide-react'
import { useState } from 'react'
import HangingTagsScene from './HangingTagsScene'

export default function HangingTagsShowcase() {
	const [dragging, setDragging] = useState(false)
	const [resetKey, setResetKey] = useState(0)
	const [nudgeKey, setNudgeKey] = useState(0)

	return (
		<main className={`hanging-tags${dragging ? ' is-dragging' : ''}`}>
			<div className="hanging-tags__scene" aria-label="可拖动的三维绳子与吊牌场景">
				<HangingTagsScene resetKey={resetKey} nudgeKey={nudgeKey} onDraggingChange={setDragging} />
			</div>
			<div className="hanging-tags__grain" aria-hidden="true" />
			<header className="hanging-tags__header">
				<a href="/briar/" className="hanging-tags__brand" aria-label="返回 Briar 首页">
					BRIAR<span>OBJECT STUDIES</span>
				</a>
				<p className="hanging-tags__eyebrow">NO. 004 / SOFT MECHANICS</p>
				<h1>
					Gravity,
					<br />
					<em>held softly.</em>
				</h1>
				<p className="hanging-tags__intro">一根绳子，三枚吊牌。牵动一点，余下交给重力。</p>
			</header>
			<aside className="hanging-tags__specs" aria-label="模拟参数">
				<span>REAL-TIME SIMULATION</span>
				<dl>
					<div>
						<dt>GRAVITY</dt>
						<dd>9.81 m/s²</dd>
					</div>
					<div>
						<dt>OBJECTS</dt>
						<dd>03</dd>
					</div>
				</dl>
			</aside>
			<div className="hanging-tags__hint">
				<span className="hanging-tags__hint-icon" aria-hidden="true">
					<Move size={17} strokeWidth={1.5} />
				</span>
				<div>
					<strong>{dragging ? '慢慢来，然后松手' : '拖动顶部金属绳结'}</strong>
					<span>
						{dragging ? '释放后，惯性会接管余下的动作' : '左右或上下轻拉，看看吊牌如何回应'}
					</span>
				</div>
			</div>
			<div className="hanging-tags__controls">
				<button type="button" onClick={() => setNudgeKey((key) => key + 1)}>
					<Wind size={16} strokeWidth={1.5} />
					轻推一下
				</button>
				<button
					type="button"
					onClick={() => {
						setResetKey((key) => key + 1)
						setDragging(false)
					}}
				>
					<RotateCcw size={15} strokeWidth={1.5} />
					复位
				</button>
			</div>
			<footer className="hanging-tags__footer">
				<span>VERLET ROPE / DAMPED PENDULUM</span>
				<output className="hanging-tags__status">
					<span className="hanging-tags__status-dot" aria-hidden="true" />
					{dragging ? 'INPUT ACTIVE' : 'PHYSICS LIVE'}
				</output>
			</footer>
		</main>
	)
}
