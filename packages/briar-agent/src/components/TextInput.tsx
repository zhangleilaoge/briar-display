import chalk from 'chalk'
import { Text, useInput } from 'ink'
import React, { useEffect, useState } from 'react'

interface TextInputProps {
	value: string
	onChange: (value: string) => void
	onSubmit?: (value: string) => void
	focus?: boolean
}

export function TextInput({ value, onChange, onSubmit, focus = true }: TextInputProps) {
	const [cursorOffset, setCursorOffset] = useState(value.length)

	// 外部 value 变化时，光标自动移到末尾
	useEffect(() => {
		setCursorOffset(value.length)
	}, [value])

	useInput(
		(input, key) => {
			// 忽略鼠标滚轮序列残留（SGR 1006 格式）
			if (input && /^<6[45];\d+;\d+[Mm]$/.test(input)) return

			if (key.upArrow || key.downArrow || (key.ctrl && input === 'c') || key.tab) {
				return
			}

			if (key.return) {
				onSubmit?.(value)
				return
			}

			if (key.leftArrow) {
				if (key.meta) {
					setCursorOffset(0)
				} else {
					setCursorOffset((p) => Math.max(0, p - 1))
				}
				return
			}

			if (key.rightArrow) {
				if (key.meta) {
					setCursorOffset(value.length)
				} else {
					setCursorOffset((p) => Math.min(value.length, p + 1))
				}
				return
			}

			if (key.backspace || key.delete) {
				if (cursorOffset > 0) {
					const next = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset)
					onChange(next)
					setCursorOffset(cursorOffset - 1)
				}
				return
			}

			if (input) {
				const next = value.slice(0, cursorOffset) + input + value.slice(cursorOffset)
				onChange(next)
				setCursorOffset(cursorOffset + input.length)
			}
		},
		{ isActive: focus },
	)

	// 不在焦点时不渲染任何可见内容，避免残留光标
	if (!focus) {
		return <Text />
	}

	const chars = [...value]
	if (chars.length === 0) {
		return <Text>{chalk.inverse(' ')}</Text>
	}

	const rendered = chars
		.map((char, i) => (i === cursorOffset ? chalk.inverse(char) : char))
		.join('')

	if (cursorOffset === chars.length) {
		return <Text>{rendered + chalk.inverse(' ')}</Text>
	}

	return <Text>{rendered}</Text>
}
