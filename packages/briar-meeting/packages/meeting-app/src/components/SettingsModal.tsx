import { Settings, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SettingsModalProps {
	open: boolean
	onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
	const [apiKey, setApiKey] = useState('')
	const [model, setModel] = useState('moonshot-v1-8k')
	const [hasAssetKey, setHasAssetKey] = useState(false)

	useEffect(() => {
		if (open) {
			window.electron?.getKimiConfig().then((assetConfig) => {
				setHasAssetKey(!!assetConfig.apiKey)
				setApiKey(localStorage.getItem('kimi-api-key') ?? '')
				setModel(localStorage.getItem('kimi-model') ?? assetConfig.model ?? 'moonshot-v1-8k')
			})
		}
	}, [open])

	const handleSave = () => {
		localStorage.setItem('kimi-api-key', apiKey)
		localStorage.setItem('kimi-model', model)
		onClose()
	}

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2 text-lg font-semibold">
						<Settings className="h-5 w-5" />
						设置
					</div>
					<button onClick={onClose} className="rounded p-1 hover:bg-secondary">
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="space-y-4">
					<div>
						<label className="mb-1.5 block text-sm font-medium">Kimi API Key</label>
						<input
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder={
								hasAssetKey ? '已配置 @briar/assets，留空则使用 assets 中的 Key' : 'sk-...'
							}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							{hasAssetKey
								? '已读取 @briar/assets/config/keys.json。上方留空时默认使用 assets 中的 Key。'
								: '你的 Key 仅保存在本地 localStorage 中。'}
						</p>
					</div>

					<div>
						<label className="mb-1.5 block text-sm font-medium">模型</label>
						<select
							value={model}
							onChange={(e) => setModel(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
						>
							<option value="moonshot-v1-8k">moonshot-v1-8k</option>
							<option value="moonshot-v1-32k">moonshot-v1-32k</option>
							<option value="moonshot-v1-128k">moonshot-v1-128k</option>
						</select>
					</div>
				</div>

				<div className="mt-6 flex justify-end gap-3">
					<button
						onClick={onClose}
						className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition"
					>
						取消
					</button>
					<button
						onClick={handleSave}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
					>
						保存
					</button>
				</div>
			</div>
		</div>
	)
}
