import { describe, expect, it } from 'bun:test'
import {
	computeTags,
	isObjectLiteral,
	parseForPreview,
	quoteUnquotedKeys,
	tryParseJson,
} from './toolJsonUtils'

describe('quoteUnquotedKeys', () => {
	it('should quote unquoted keys', () => {
		expect(quoteUnquotedKeys('{a: 1}')).toBe('{"a": 1}')
	})

	it('should not double-quote already quoted keys', () => {
		expect(quoteUnquotedKeys('{"a": 1}')).toBe('{"a": 1}')
	})

	it('should handle mixed quoted and unquoted keys', () => {
		const input = '{ foo: 1, "bar": 2, baz: 3 }'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual({ foo: 1, bar: 2, baz: 3 })
	})

	it('should not modify content inside string values', () => {
		const input = '{ key: "value: with colon", foo: 1 }'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual({ key: 'value: with colon', foo: 1 })
	})

	it('should handle nested objects', () => {
		const input = '{ outer: { inner: 1 } }'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual({ outer: { inner: 1 } })
	})

	it('should handle the real-world case with quoted keys containing colons', () => {
		const input = `{
			affected_goods_map: {
				"Activity(umpTypeCode=108, activityId=0)": [2996416364]
			},
			ump_type: "CUSTOMER_POSTAGE_FREE"
		}`
		const result = quoteUnquotedKeys(input)
		const parsed = JSON.parse(result)
		expect(parsed.ump_type).toBe('CUSTOMER_POSTAGE_FREE')
		expect(parsed.affected_goods_map['Activity(umpTypeCode=108, activityId=0)']).toEqual([
			2996416364,
		])
	})

	it('should handle arrays', () => {
		const input = '[{ a: 1 }, { b: 2 }]'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('should handle single-quoted strings', () => {
		const input = "{ key: 'value' }"
		const result = quoteUnquotedKeys(input)
		// key gets double-quoted, single-quoted string value preserved, whitespace preserved
		expect(JSON.parse(result.replace(/'/g, '"'))).toEqual({ key: 'value' })
	})

	it('should handle escape sequences in strings', () => {
		const input = '{ key: "value \\"quoted\\"" }'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual({ key: 'value "quoted"' })
	})

	it('should handle empty input', () => {
		expect(quoteUnquotedKeys('')).toBe('')
	})

	it('should handle $ in key names', () => {
		const input = '{ $ref: "something" }'
		const result = quoteUnquotedKeys(input)
		expect(JSON.parse(result)).toEqual({ $ref: 'something' })
	})
})

describe('isObjectLiteral', () => {
	it('should return false for valid JSON', () => {
		expect(isObjectLiteral('{"a": 1}')).toBe(false)
	})

	it('should return false for JSON array', () => {
		expect(isObjectLiteral('[1, 2, 3]')).toBe(false)
	})

	it('should return true for JS object literal with unquoted keys', () => {
		expect(isObjectLiteral('{a: 1}')).toBe(true)
	})

	it('should return true for complex object literal', () => {
		const input = `{
			affected_goods_map: {
				"Activity(umpTypeCode=108)": [1]
			},
			ump_type: "FREE"
		}`
		expect(isObjectLiteral(input)).toBe(true)
	})

	it('should return false for single-quoted JSON (just quote style diff)', () => {
		expect(isObjectLiteral("{'a': 1}")).toBe(false)
	})

	it('should return false for empty input', () => {
		expect(isObjectLiteral('')).toBe(false)
	})

	it('should return false for invalid input that cannot be fixed', () => {
		expect(isObjectLiteral('not json at all')).toBe(false)
	})
})

describe('computeTags', () => {
	it('should tag valid JSON object as JSON', () => {
		const tags = computeTags('{"a": 1}')
		expect(tags).toEqual(['JSON'])
	})

	it('should tag compressed JSON as JSON+压缩', () => {
		const tags = computeTags('{"a":1}')
		expect(tags).toEqual(['JSON', '压缩'])
	})

	it('should tag JS object literal as 对象', () => {
		const tags = computeTags('{a: 1}')
		expect(tags).toEqual(['对象'])
	})

	it('should tag complex object literal as 对象', () => {
		const input = `{
			affected_goods_map: {
				"Activity(umpTypeCode=108)": [1]
			},
			ump_type: "FREE"
		}`
		const tags = computeTags(input)
		expect(tags).toEqual(['对象'])
	})

	it('should tag invalid input as 非法', () => {
		const tags = computeTags('not json')
		expect(tags).toEqual(['非法'])
	})

	it('should return empty for empty input', () => {
		expect(computeTags('')).toEqual([])
	})

	it('should not include 合法 tag', () => {
		const tags = computeTags('{"a": 1}')
		expect(tags).not.toContain('合法')
	})
})

describe('parseForPreview', () => {
	it('should return isObjectInput=true for standard JSON object', () => {
		const result = parseForPreview('{"a": 1}')
		expect(result.isObjectInput).toBe(true)
		expect(result.parsedValue).toEqual({ a: 1 })
	})

	it('should return isObjectInput=true for standard JSON array', () => {
		const result = parseForPreview('[1, 2, 3]')
		expect(result.isObjectInput).toBe(true)
	})

	it('should return isObjectInput=false for JS object literal (needs quote fix)', () => {
		const result = parseForPreview('{a: 1}')
		expect(result.isObjectInput).toBe(false)
		expect(result.parsedValue).toEqual({ a: 1 })
	})

	it('should return isObjectInput=false for complex object literal', () => {
		const input = `{
			affected_goods_map: {
				"Activity(umpTypeCode=108)": [1]
			},
			ump_type: "FREE"
		}`
		const result = parseForPreview(input)
		expect(result.isObjectInput).toBe(false)
		expect(result.parsedValue).toBeDefined()
	})

	it('should return isObjectInput=false for single-quoted JSON', () => {
		const result = parseForPreview("{'a': 1}")
		expect(result.isObjectInput).toBe(false)
	})

	it('should return isObjectInput=false for empty input', () => {
		const result = parseForPreview('')
		expect(result.isObjectInput).toBe(false)
		expect(result.parsedValue).toBeNull()
	})

	it('should return isObjectInput=false for invalid input', () => {
		const result = parseForPreview('not json')
		expect(result.isObjectInput).toBe(false)
		expect(result.parsedValue).toBeNull()
	})
})

describe('tryParseJson', () => {
	it('should parse valid JSON', () => {
		const result = tryParseJson('{"a": 1}')
		expect(result.valid).toBe(true)
		expect(result.value).toEqual({ a: 1 })
	})

	it('should parse single-quoted JSON', () => {
		const result = tryParseJson("{'a': 1}")
		expect(result.valid).toBe(true)
	})

	it('should parse JS object literal', () => {
		const result = tryParseJson('{a: 1}')
		expect(result.valid).toBe(true)
		expect(result.value).toEqual({ a: 1 })
	})

	it('should return error for invalid input', () => {
		const result = tryParseJson('not json')
		expect(result.valid).toBe(false)
		expect(result.error).toBeDefined()
	})
})
