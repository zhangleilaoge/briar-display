import { describe, expect, it } from 'bun:test'
import { splitLinkify } from './linkify'

describe('splitLinkify', () => {
	it('returns empty for empty string', () => {
		expect(splitLinkify('')).toEqual([])
	})

	it('keeps plain text as a single text part', () => {
		expect(splitLinkify('hello 想法 😊')).toEqual([{ type: 'text', value: 'hello 想法 😊' }])
	})

	it('linkifies a lone https URL', () => {
		expect(splitLinkify('https://wow.aethus.pl/')).toEqual([
			{ type: 'link', href: 'https://wow.aethus.pl/', value: 'https://wow.aethus.pl/' },
		])
	})

	it('linkifies http and https mixed with text', () => {
		expect(splitLinkify('看这个 http://example.com 和 https://a.b/c')).toEqual([
			{ type: 'text', value: '看这个 ' },
			{ type: 'link', href: 'http://example.com', value: 'http://example.com' },
			{ type: 'text', value: ' 和 ' },
			{ type: 'link', href: 'https://a.b/c', value: 'https://a.b/c' },
		])
	})

	it('peels trailing punctuation from URLs', () => {
		expect(splitLinkify('见 https://x.test。')).toEqual([
			{ type: 'text', value: '见 ' },
			{ type: 'link', href: 'https://x.test', value: 'https://x.test' },
			{ type: 'text', value: '。' },
		])
	})

	it('does not treat javascript: as a link', () => {
		expect(splitLinkify('javascript:alert(1)')).toEqual([
			{ type: 'text', value: 'javascript:alert(1)' },
		])
	})

	it('preserves newlines around links', () => {
		expect(splitLinkify('a\nhttps://x.test\nb')).toEqual([
			{ type: 'text', value: 'a\n' },
			{ type: 'link', href: 'https://x.test', value: 'https://x.test' },
			{ type: 'text', value: '\nb' },
		])
	})

	it('stops before comma + CJK (exact user bug)', () => {
		expect(splitLinkify('https://wow.aethus.pl/, 艾泽拉斯幸存者')).toEqual([
			{ type: 'link', href: 'https://wow.aethus.pl/', value: 'https://wow.aethus.pl/' },
			{ type: 'text', value: ', 艾泽拉斯幸存者' },
		])
	})

	it('stops before comma glued to CJK (no space)', () => {
		expect(splitLinkify('https://wow.aethus.pl/,艾泽拉斯幸存者')).toEqual([
			{ type: 'link', href: 'https://wow.aethus.pl/', value: 'https://wow.aethus.pl/' },
			{ type: 'text', value: ',艾泽拉斯幸存者' },
		])
	})

	it('never includes CJK glued to the URL path', () => {
		expect(splitLinkify('https://example.com/路径')).toEqual([
			{ type: 'link', href: 'https://example.com/', value: 'https://example.com/' },
			{ type: 'text', value: '路径' },
		])
	})

	it('keeps path slash, peels comma after slash', () => {
		expect(splitLinkify('https://wow.aethus.pl/,')).toEqual([
			{ type: 'link', href: 'https://wow.aethus.pl/', value: 'https://wow.aethus.pl/' },
			{ type: 'text', value: ',' },
		])
	})

	it('handles URL mid-sentence with spaces', () => {
		expect(splitLinkify('看这个 https://example.com/ 好吧')).toEqual([
			{ type: 'text', value: '看这个 ' },
			{ type: 'link', href: 'https://example.com/', value: 'https://example.com/' },
			{ type: 'text', value: ' 好吧' },
		])
	})

	it('peels closing paren and ASCII punctuation after URL', () => {
		expect(splitLinkify('（见 https://x.test）然后')).toEqual([
			{ type: 'text', value: '（见 ' },
			{ type: 'link', href: 'https://x.test', value: 'https://x.test' },
			{ type: 'text', value: '）然后' },
		])
		expect(splitLinkify('见 https://x.test), ok')).toEqual([
			{ type: 'text', value: '见 ' },
			{ type: 'link', href: 'https://x.test', value: 'https://x.test' },
			{ type: 'text', value: '), ok' },
		])
	})

	it('keeps query and hash in the link', () => {
		expect(splitLinkify('https://x.test/a?b=1&c=2#frag')).toEqual([
			{
				type: 'link',
				href: 'https://x.test/a?b=1&c=2#frag',
				value: 'https://x.test/a?b=1&c=2#frag',
			},
		])
	})
})
