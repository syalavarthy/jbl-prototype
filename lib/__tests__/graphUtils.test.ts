import { describe, it, expect } from 'vitest'
import { computeBKT } from '../graphUtils'
import { BKTParams } from '../types'

describe('computeBKT', () => {
  it('returns pL0 with no responses', () => {
    const params: BKTParams = { pL0: 0.3, pT: 0.1, pG: 0.2, pS: 0.1 }
    expect(computeBKT([], params)).toBeCloseTo(0.3)
  })
})
