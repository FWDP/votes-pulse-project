import assert from 'node:assert/strict'
import test from 'node:test'

import { parseBearerToken } from '../src/middleware/auth'

test('parses a bounded bearer token without a regular expression', () => {
  assert.equal(parseBearerToken('Bearer session-token'), 'session-token')
  assert.equal(parseBearerToken('bearer abc.123'), 'abc.123')
})

test('rejects malformed and whitespace-heavy bearer headers', () => {
  assert.equal(parseBearerToken('Basic session-token'), undefined)
  assert.equal(parseBearerToken('Bearer  session-token'), undefined)
  assert.equal(parseBearerToken(`Bearer ${' '.repeat(20_000)}`), undefined)
  assert.equal(parseBearerToken(`Bearer ${'a'.repeat(4_097)}`), undefined)
})
