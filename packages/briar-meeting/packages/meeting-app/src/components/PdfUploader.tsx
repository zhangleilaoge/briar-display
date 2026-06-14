import { FileText, Upload, X } from 'lucide-react'
import { useRef } from 'react'

interface PdfUploaderProps {
	pdfContext?: string
	onUpload: (text: string) => void
	onClear: () => void
}

export function PdfUploader({ pdfContext, onUpload, onClear }: PdfUploaderProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	const handleSelect = async () => {
		const filePath = await window.electron?.selectPdf()
		if (!filePath) return

		const result = await window.electron?.readPdf(filePath)
		if (!result) return

		const buffer = Uint8Array.from(atob(result.buffer), (c) => c.charCodeAt(0))
		const { NodePdfParser } = await import('@briar/meeting-sdk')
		const parser = new NodePdfParser()
		const text = await parser.parsePdf(buffer.buffer)
		onUpload(text.slice(0, 12000))
	}

	return (
		<div className="flex items-center gap-3">
			<input
				type="file"
				accept=".pdf"
				ref={inputRef}
				className="hidden"
				onChange={async (e) => {
					const file = e.target.files?.[0]
					if (!file) return
					const arrayBuffer = await file.arrayBuffer()
					const { NodePdfParser } = await import('@briar/meeting-sdk')
					const parser = new NodePdfParser()
					const text = await parser.parsePdf(arrayBuffer)
					onUpload(text.slice(0, 12000))
				}}
			/>
			{pdfContext ? (
				<div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm">
					<FileText className="h-4 w-4 text-primary" />
					<span className="text-secondary-foreground">PDF 已加载</span>
					<button onClick={onClear} className="ml-1 rounded p-0.5 hover:bg-accent">
						<X className="h-3.5 w-3.5" />
					</button>
				</div>
			) : (
				<button
					onClick={handleSelect}
					className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary transition"
				>
					<Upload className="h-4 w-4" />
					上传 PDF
				</button>
			)}
		</div>
	)
}
