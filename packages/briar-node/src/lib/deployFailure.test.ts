import { describe, expect, test } from 'bun:test'
import { extractErrorExcerpt, githubRunUrl, pickFailedJobStep } from './deployFailure'

describe('pickFailedJobStep', () => {
	test('picks the failed job and its failed step', () => {
		const info = pickFailedJobStep([
			{ id: 1, name: 'lint', status: 'completed', conclusion: 'success', steps: [] },
			{
				id: 2,
				name: 'deploy',
				status: 'completed',
				conclusion: 'failure',
				steps: [
					{ name: 'Checkout', number: 1, conclusion: 'success' },
					{ name: 'Run backend tests', number: 2, conclusion: 'failure' },
					{ name: 'Deploy', number: 3, conclusion: 'skipped' },
				],
			},
		])
		expect(info).toEqual({ jobId: 2, job: 'deploy', step: 'Run backend tests' })
	})

	test('falls back to cancelled / timed out', () => {
		const info = pickFailedJobStep([
			{ id: 3, name: 'deploy', status: 'completed', conclusion: 'cancelled', steps: [] },
		])
		expect(info).toEqual({ jobId: 3, job: 'deploy', step: null })
	})

	test('no failure → nulls', () => {
		expect(pickFailedJobStep([])).toEqual({ jobId: null, job: null, step: null })
	})
})

describe('extractErrorExcerpt', () => {
	test('anchors on the last ##[error] line and strips timestamps', () => {
		const log = [
			'2026-10-27T08:10:00.1234567Z ##[group]Run make test',
			'2026-10-27T08:10:01.0000000Z (fail) contract > route declared',
			'2026-10-27T08:10:01.5000000Z ##[endgroup]',
			'2026-10-27T08:10:02.0000000Z ##[error]Process completed with exit code 1.',
			'2026-10-27T08:10:03.0000000Z Post job cleanup.',
		].join('\n')
		const excerpt = extractErrorExcerpt(log)
		expect(excerpt).toContain('(fail) contract > route declared')
		expect(excerpt).toContain('ERROR: Process completed with exit code 1.')
		expect(excerpt).not.toContain('Post job cleanup')
		expect(excerpt).not.toMatch(/2026-10-27T/)
	})

	test('without anchor takes the tail', () => {
		const log = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n')
		const excerpt = extractErrorExcerpt(log) ?? ''
		expect(excerpt.split('\n')).toHaveLength(30)
		expect(excerpt.endsWith('line 99')).toBe(true)
	})

	test('empty log → null', () => {
		expect(extractErrorExcerpt('\n\n')).toBeNull()
	})

	test('run url', () => {
		expect(githubRunUrl('a/b', '42')).toBe('https://github.com/a/b/actions/runs/42')
	})
})
