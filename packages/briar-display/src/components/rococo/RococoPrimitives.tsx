import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as SelectPrimitive from '@radix-ui/react-select'
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
} from 'date-fns'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
	type ButtonHTMLAttributes,
	type InputHTMLAttributes,
	type LabelHTMLAttributes,
	type ReactNode,
	type TextareaHTMLAttributes,
	useState,
} from 'react'

type PortalProps = {
	portalContainer?: HTMLElement | null
}

type RococoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'default' | 'primary' | 'quiet'
}

export function RococoButton({
	variant = 'default',
	className = '',
	type = 'button',
	...props
}: RococoButtonProps) {
	return (
		<button
			type={type}
			className={`rococo-button rococo-button--${variant} ${className}`}
			{...props}
		/>
	)
}

export function RococoSidebarTag({
	active = false,
	icon,
	children,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; icon: ReactNode }) {
	return (
		<button type="button" className="rococo-sidebar-tag" aria-pressed={active} {...props}>
			<span className="rococo-sidebar-tag__icon" aria-hidden="true">
				{icon}
			</span>
			<span>{children}</span>
			<span className="rococo-sidebar-tag__ribbon" aria-hidden="true" />
		</button>
	)
}

export function RococoBreadcrumb({
	items,
}: {
	items: { label: string; href?: string }[]
}) {
	return (
		<nav className="rococo-breadcrumb" aria-label="面包屑">
			<ol>
				{items.map((item, index) => (
					<li key={item.label}>
						{index > 0 && <span aria-hidden="true">/</span>}
						{item.href ? (
							<a href={item.href}>{item.label}</a>
						) : (
							<span aria-current="page">{item.label}</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	)
}

export function RococoLabel({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
	return <label className={`rococo-label ${className}`} {...props} />
}

export function RococoInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return <input className="rococo-input" {...props} />
}

export function RococoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea className="rococo-textarea" {...props} />
}

export function RococoSelect({ portalContainer, id }: PortalProps & { id?: string }) {
	const [paper, setPaper] = useState('bleu')
	return (
		<SelectPrimitive.Root value={paper} onValueChange={setPaper}>
			<SelectPrimitive.Trigger id={id} className="rococo-select-trigger" aria-label="信纸颜色">
				<SelectPrimitive.Value />
				<SelectPrimitive.Icon asChild>
					<span className="rococo-shell" aria-hidden="true" />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>
			<SelectPrimitive.Portal container={portalContainer}>
				<SelectPrimitive.Content className="rococo-select-content" position="popper" sideOffset={8}>
					<SelectPrimitive.Viewport className="rococo-select-viewport">
						{[
							['bleu', '雾蓝 · Bleu cendré'],
							['rose', '灰玫 · Rose poudré'],
							['creme', '奶油 · Crème'],
						].map(([value, label]) => (
							<SelectPrimitive.Item key={value} value={value} className="rococo-select-item">
								<span className="rococo-select-check">
									<SelectPrimitive.ItemIndicator>
										<Check size={14} strokeWidth={1.5} />
									</SelectPrimitive.ItemIndicator>
								</span>
								<SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
							</SelectPrimitive.Item>
						))}
					</SelectPrimitive.Viewport>
				</SelectPrimitive.Content>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	)
}

export function RococoDialog({ portalContainer }: PortalProps) {
	const [open, setOpen] = useState(false)
	return (
		<DialogPrimitive.Root open={open} onOpenChange={setOpen}>
			<DialogPrimitive.Trigger asChild>
				<RococoButton variant="primary">写一封信</RococoButton>
			</DialogPrimitive.Trigger>
			<DialogPrimitive.Portal container={portalContainer}>
				<DialogPrimitive.Overlay className="rococo-dialog-overlay" />
				<DialogPrimitive.Content className="rococo-dialog">
					<div className="rococo-flourish" aria-hidden="true">
						<svg viewBox="0 0 160 32" fill="none">
							<path d="M4 24c30 0 37-20 58-15 14 4 2 21-5 12-5-7 14-15 27-8 9 5 5 15-2 12m74 1c-30-2-32-18-53-17-15 1-10 19-1 14 8-4 1-18-13-16-10 1-11 13-5 14" />
							<path d="M80 3v20m-4-10 4 5 4-5" />
						</svg>
					</div>
					<p className="rococo-eyebrow">UNE PETITE NOTE</p>
					<DialogPrimitive.Title className="rococo-dialog__title">
						一封未寄出的信
					</DialogPrimitive.Title>
					<DialogPrimitive.Description className="rococo-dialog__description">
						留一点空白，让没说出口的话慢慢显影。
					</DialogPrimitive.Description>
					<div className="rococo-dialog__fields">
						<div className="rococo-field">
							<RococoLabel htmlFor="rococo-letter-to">收件人</RococoLabel>
							<RococoInput id="rococo-letter-to" placeholder="亲爱的…" />
						</div>
						<div className="rococo-field">
							<RococoLabel htmlFor="rococo-letter-body">信笺</RococoLabel>
							<RococoTextarea id="rococo-letter-body" placeholder="今天想与你分享…" rows={3} />
						</div>
					</div>
					<div className="rococo-dialog__actions">
						<DialogPrimitive.Close asChild>
							<RococoButton variant="quiet">稍后再写</RococoButton>
						</DialogPrimitive.Close>
						<RococoButton variant="primary" onClick={() => setOpen(false)}>
							妥善收好
						</RococoButton>
					</div>
					<DialogPrimitive.Close className="rococo-dialog__close" aria-label="关闭弹窗">
						<X size={17} strokeWidth={1.4} />
					</DialogPrimitive.Close>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

export function RococoCalendar() {
	const [selected, setSelected] = useState(() => new Date())
	const [month, setMonth] = useState(() => startOfMonth(new Date()))
	const days = eachDayOfInterval({
		start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
		end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
	})
	return (
		<div className="rococo-calendar">
			<div className="rococo-calendar__header">
				<RococoButton
					variant="quiet"
					aria-label="上个月"
					onClick={() => setMonth(addMonths(month, -1))}
				>
					<ChevronLeft size={17} strokeWidth={1.4} />
				</RococoButton>
				<div>
					<strong>{format(month, 'MMMM')}</strong>
					<span>{format(month, 'yyyy')}</span>
				</div>
				<RococoButton
					variant="quiet"
					aria-label="下个月"
					onClick={() => setMonth(addMonths(month, 1))}
				>
					<ChevronRight size={17} strokeWidth={1.4} />
				</RococoButton>
			</div>
			<div className="rococo-calendar__week" aria-hidden="true">
				{weekDays.map((day) => (
					<span key={day}>{day}</span>
				))}
			</div>
			<div className="rococo-calendar__days">
				{days.map((day) => (
					<button
						type="button"
						key={day.toISOString()}
						className="rococo-calendar__day"
						aria-label={format(day, 'yyyy年M月d日')}
						aria-pressed={isSameDay(day, selected)}
						disabled={!isSameMonth(day, month)}
						onClick={() => setSelected(day)}
					>
						{format(day, 'd')}
					</button>
				))}
			</div>
			<p className="rococo-calendar__caption" aria-live="polite">
				已选择 {format(selected, 'yyyy年M月d日')}
			</p>
		</div>
	)
}
