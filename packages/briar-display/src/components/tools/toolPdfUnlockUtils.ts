// PDF 解除限制：qpdf WASM 纯浏览器本地解密（去除打印/复制等权限密码限制）
// 打开密码为空的 PDF 无需任何密码即可解除；打开密码非空的需用户输入正确密码

import type { QpdfInstance } from '@neslinesli93/qpdf-wasm'

// 官方 d.ts 的 EmscriptenFS 未声明 writeFile/unlink，运行时实际存在
type QpdfFs = QpdfInstance['FS'] & {
	writeFile: (path: string, data: Uint8Array) => void
	unlink: (path: string) => void
}

let qpdfPromise: Promise<QpdfInstance> | null = null

/** 懒加载 qpdf wasm（glue + wasm 各一个 chunk，仅本工具页用到时才下载），全局复用单例 */
export function loadQpdf(): Promise<QpdfInstance> {
	if (!qpdfPromise) {
		qpdfPromise = (async () => {
			const [{ default: createModule }, { default: wasmUrl }] = await Promise.all([
				import('@neslinesli93/qpdf-wasm'),
				import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'),
			])
			return createModule({ locateFile: () => wasmUrl })
		})()
	}
	return qpdfPromise
}

export class PdfDecryptError extends Error {}

/**
 * 用 qpdf --decrypt 重写 PDF，输出无加密、无权限限制的新文件
 * @param password 打开密码（无则传空串）；权限密码无需提供
 * @throws PdfDecryptError 密码错误或文件损坏
 */
export async function decryptPdf(data: Uint8Array, password: string): Promise<Uint8Array> {
	const qpdf = await loadQpdf()
	const fs = qpdf.FS as QpdfFs
	const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
	const input = `/in-${id}.pdf`
	const output = `/out-${id}.pdf`

	fs.writeFile(input, data)
	try {
		// 该构建的 callMain 不抛异常，以退出码表示失败（2=密码错误/文件损坏）；防御性保留 catch
		let code = 0
		try {
			code = qpdf.callMain([`--password=${password}`, '--decrypt', input, output])
		} catch {
			code = 1
		}
		if (code !== 0) {
			throw new PdfDecryptError(
				password ? '密码错误或文件已损坏' : '该 PDF 需要打开密码，或文件已损坏',
			)
		}
		return fs.readFile(output)
	} finally {
		for (const p of [input, output]) {
			try {
				fs.unlink(p)
			} catch {}
		}
	}
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
