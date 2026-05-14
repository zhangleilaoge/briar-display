import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'

export const mouseEmitter = new EventEmitter()

const MOUSE_REGEX = /\x1b\[<(\d+);(\d+);(\d+)[Mm]/g

class FilteredStdin extends Readable {
	private buffer = ''

	constructor() {
		super()
		process.stdin.on('data', (data: Buffer) => {
			this.buffer += data.toString()

			let match
			let lastIndex = 0
			while ((match = MOUSE_REGEX.exec(this.buffer)) !== null) {
				const button = parseInt(match[1], 10)
				if (button === 64) mouseEmitter.emit('wheel', 'up')
				else if (button === 65) mouseEmitter.emit('wheel', 'down')
				lastIndex = MOUSE_REGEX.lastIndex
			}

			// 保留可能不完整的 escape sequence
			const output = this.buffer.slice(0, lastIndex).replace(MOUSE_REGEX, '')
			const remaining = this.buffer.slice(lastIndex)
			this.buffer = remaining

			// 如果缓冲区没有 escape，说明不可能是不完整的鼠标序列
			if (this.buffer && !this.buffer.includes('\x1b')) {
				if (output) {
					this.push(output + this.buffer)
				} else {
					this.push(this.buffer)
				}
				this.buffer = ''
				return
			}

			// 防止缓冲区无限增长
			if (this.buffer.length > 200) {
				this.push(output + this.buffer)
				this.buffer = ''
				return
			}

			if (output) this.push(output)
		})
	}

	_read() {}

	get isTTY() {
		return process.stdin.isTTY
	}

	setRawMode(mode: boolean) {
		return (process.stdin as any).setRawMode?.(mode)
	}

	ref() {
		return (process.stdin as any).ref?.()
	}

	unref() {
		return (process.stdin as any).unref?.()
	}

	setEncoding(encoding: BufferEncoding) {
		super.setEncoding(encoding)
		process.stdin.setEncoding(encoding)
		return this
	}
}

export function createFilteredStdin() {
	return new FilteredStdin()
}
