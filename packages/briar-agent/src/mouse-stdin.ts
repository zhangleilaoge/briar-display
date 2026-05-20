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
				const button = Number.parseInt(match[1], 10)
				if (button === 64) mouseEmitter.emit('wheel', 'up')
				else if (button === 65) mouseEmitter.emit('wheel', 'down')
				lastIndex = MOUSE_REGEX.lastIndex
			}

			const output = this.buffer.slice(0, lastIndex).replace(MOUSE_REGEX, '')
			const remaining = this.buffer.slice(lastIndex)
			this.buffer = remaining

			// 只有以 \x1b[< 开头的残留才可能是不完整的鼠标序列，
			// 其他 escape 序列（如 \x1b[C 右箭头）应立刻 push，避免键盘事件被卡住。
			if (this.buffer && !this.buffer.startsWith('\x1b[<')) {
				this.push(output + this.buffer)
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
