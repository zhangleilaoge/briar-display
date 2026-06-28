import { describe, expect, it } from 'bun:test'
import { PythonEnvError, enhancePythonError, findPythonPath } from './python-env.ts'

describe('python-env', () => {
	describe('findPythonPath', () => {
		it('优先使用 PYTHON_PATH 环境变量（存在时）', () => {
			const original = process.env.PYTHON_PATH
			// 复用当前 Bun 可执行文件路径作为“存在的可执行文件”
			process.env.PYTHON_PATH = process.execPath
			expect(findPythonPath()).toBe(process.execPath)
			process.env.PYTHON_PATH = original
		})

		it('PYTHON_PATH 不存在时回退到 venv 或 python3', () => {
			const original = process.env.PYTHON_PATH
			process.env.PYTHON_PATH = undefined
			const result = findPythonPath()
			expect(result.endsWith('python_encoder/.venv/bin/python') || result === 'python3').toBe(true)
			process.env.PYTHON_PATH = original
		})
	})

	describe('enhancePythonError', () => {
		it('识别 ModuleNotFoundError 并附加 setup 提示', () => {
			const err = enhancePythonError('ModuleNotFoundError: No module named torch')
			expect(err).toContain('ModuleNotFoundError')
			expect(err).toContain('bash setup.sh')
		})

		it('非依赖错误原样返回', () => {
			const err = enhancePythonError('some other error')
			expect(err).toBe('some other error')
		})
	})

	describe('PythonEnvError', () => {
		it('name 为 PythonEnvError', () => {
			const err = new PythonEnvError('test')
			expect(err.name).toBe('PythonEnvError')
		})
	})
})
