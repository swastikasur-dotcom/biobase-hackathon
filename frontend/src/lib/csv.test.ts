import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('joins rows with CRLF and a trailing newline', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d\r\n')
  })

  it('quotes cells with commas, quotes and newlines', () => {
    expect(toCsv([['x, y', 'say "hi"', 'l1\nl2']])).toBe('"x, y","say ""hi""","l1\nl2"\r\n')
  })

  it('renders null and undefined as empty cells', () => {
    expect(toCsv([[null, undefined, 0]])).toBe(',,0\r\n')
  })
})
