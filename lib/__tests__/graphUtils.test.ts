import { describe, it, expect } from 'vitest'
import { computeGraphDisplay, computeBKT, removeSuggestion } from '../graphUtils'
import { GraphState, StudentProgress, SeedSuggestions, BKTParams } from '../types'

const emptyGraph: GraphState = { nodes: [], edges: [] }

const emptyProgress: StudentProgress = {
  studentId: 'test',
  studentName: 'Test',
  nodeProgress: {},
}

const emptySeeds: SeedSuggestions = { bridgeSuggestions: [], edgeSuggestions: [] }

const singleNodeGraph: GraphState = {
  nodes: [{ id: 'a', label: 'A', topic: 'Math', position: { x: 0, y: 0 } }],
  edges: [],
}

const twoNodeGraph: GraphState = {
  nodes: [
    { id: 'a', label: 'A', topic: 'Math', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', topic: 'Math', position: { x: 0, y: 140 } },
  ],
  edges: [{ id: 'a->b', source: 'a', target: 'b' }],
}

// ─── computeBKT ─────────────────────────────────────────────────────────────

describe('computeBKT', () => {
  it('returns pL0 with no responses', () => {
    const params: BKTParams = { pL0: 0.3, pT: 0.1, pG: 0.2, pS: 0.1 }
    expect(computeBKT([], params)).toBeCloseTo(0.3)
  })
})

// ─── computeGraphDisplay — node grade bands ──────────────────────────────────

describe('computeGraphDisplay node grade bands', () => {
  it('not_started when no NodeProgress entry', () => {
    const r = computeGraphDisplay(singleNodeGraph, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('not_started')
    expect(r.nodeDisplays['a'].fillPct).toBe(0)
  })

  it('not_started when NodeProgress exists but attempts === 0', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 0 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('not_started')
  })

  it('developing for pMastery 0.30, 1 attempt', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.30 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('developing')
    expect(r.nodeDisplays['a'].fillPct).toBe(22)
  })

  it('progressing for pMastery 0.60', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 2, pMastery: 0.60 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('progressing')
    expect(r.nodeDisplays['a'].fillPct).toBe(55)
  })

  it('proficient for pMastery 0.80', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 2, pMastery: 0.80 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('proficient')
    expect(r.nodeDisplays['a'].fillPct).toBe(82)
  })

  it('mastered for pMastery >= 0.90', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 3, pMastery: 0.92 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('mastered')
    expect(r.nodeDisplays['a'].fillPct).toBe(100)
  })

  it('struggling overrides band when attempts >= 3 and pMastery < 0.40', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 3, pMastery: 0.30 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('struggling')
    expect(r.nodeDisplays['a'].fillPct).toBe(22)
  })

  it('does NOT mark as struggling when attempts < 3 even if pMastery < 0.40', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 2, pMastery: 0.20 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).not.toBe('struggling')
  })

  it('boundary: pMastery exactly 0.45 → progressing (not developing)', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.45 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('progressing')
  })

  it('boundary: pMastery 0.44 → developing (just below progressing)', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.44 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('developing')
  })

  it('boundary: pMastery exactly 0.70 → proficient (not progressing)', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.70 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('proficient')
  })

  it('boundary: pMastery 0.69 → progressing (just below proficient)', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.69 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].gradeBand).toBe('progressing')
  })

  it('returns empty nodeDisplays and edgeDisplays for an empty graph', () => {
    const r = computeGraphDisplay(emptyGraph, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays).toEqual({})
    expect(r.edgeDisplays).toEqual({})
  })
})

// ─── computeGraphDisplay — node display derivations ─────────────────────────

describe('computeGraphDisplay node display derivations', () => {
  it('labelOpacity = max(0.35, pMastery * 0.7 + 0.28) for pMastery=0.5', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0.5 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].labelOpacity).toBeCloseTo(0.63)
  })

  it('labelOpacity clamps to 0.35 when formula yields < 0.35', () => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts: 1, pMastery: 0 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].labelOpacity).toBeCloseTo(0.35)
  })

  it('labelOpacity defaults to 0.35 for not_started node', () => {
    const r = computeGraphDisplay(singleNodeGraph, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].labelOpacity).toBe(0.35)
  })

  it.each([
    [0, 1],
    [1, 1],
    [2, 1.5],
    [3, 1.5],
    [4, 2],
    [5, 2],
    [6, 2.5],
    [10, 2.5],
  ])('attempts=%i → borderThicknessPx=%f', (attempts, expectedPx) => {
    const progress = { ...emptyProgress, nodeProgress: { a: { nodeId: 'a', attempts, pMastery: 0.5 } } }
    const r = computeGraphDisplay(singleNodeGraph, progress, 'bkt', false, emptySeeds)
    expect(r.nodeDisplays['a'].borderThicknessPx).toBe(expectedPx)
  })

})

// ─── computeGraphDisplay — edge display ─────────────────────────────────────

describe('computeGraphDisplay edge display', () => {
  it('defaults confidence to 0.5 when not set', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.edgeDisplays['a->b'].confidence).toBe(0.5)
    expect(r.edgeDisplays['a->b'].isDashed).toBe(false)
    expect(r.edgeDisplays['a->b'].confidenceLabel).toBe('0.5')
  })

  it('marks edge dashed when confidence < 0.5', () => {
    const g = { ...twoNodeGraph, edges: [{ id: 'a->b', source: 'a', target: 'b', confidence: 0.3 }] }
    const r = computeGraphDisplay(g, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.edgeDisplays['a->b'].isDashed).toBe(true)
    expect(r.edgeDisplays['a->b'].confidenceLabel).toBe('0.3')
  })

  it('edge is solid when confidence === 0.5', () => {
    const g = { ...twoNodeGraph, edges: [{ id: 'a->b', source: 'a', target: 'b', confidence: 0.5 }] }
    const r = computeGraphDisplay(g, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.edgeDisplays['a->b'].isDashed).toBe(false)
  })

  it('edge is solid when confidence > 0.5', () => {
    const g = { ...twoNodeGraph, edges: [{ id: 'a->b', source: 'a', target: 'b', confidence: 0.8 }] }
    const r = computeGraphDisplay(g, emptyProgress, 'bkt', false, emptySeeds)
    expect(r.edgeDisplays['a->b'].isDashed).toBe(false)
  })
})

// ─── computeGraphDisplay — suggestion injection ──────────────────────────────

const seedsWithSuggestions: SeedSuggestions = {
  bridgeSuggestions: [
    { id: 'bridge-1', type: 'bridge_node', label: 'Unit Rates', targetNodeId: 'b', sourceNodeId: 'a', reason: 'stalling at b' },
  ],
  edgeSuggestions: [
    { id: 'edge-1', type: 'missing_edge', sourceNodeId: 'a', targetNodeId: 'b', reason: 'correlation detected' },
  ],
}

describe('computeGraphDisplay suggestion injection', () => {
  it('returns empty arrays when showSuggestions=false', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', false, seedsWithSuggestions)
    expect(r.suggestionNodeDisplays).toHaveLength(0)
    expect(r.suggestionEdgeDisplays).toHaveLength(0)
    expect(r.suggestions).toHaveLength(0)
  })

  it('injects ghost node at midpoint of source and target positions', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', true, seedsWithSuggestions)
    expect(r.suggestionNodeDisplays).toHaveLength(1)
    expect(r.suggestionNodeDisplays[0].suggestionId).toBe('bridge-1')
    expect(r.suggestionNodeDisplays[0].label).toBe('Unit Rates')
    expect(r.suggestionNodeDisplays[0].position).toEqual({ x: 0, y: 70 })
  })

  it('injects two suggestion edges for a bridge suggestion', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', true, seedsWithSuggestions)
    const bridgeEdges = r.suggestionEdgeDisplays.filter(e => e.suggestionId === 'bridge-1')
    expect(bridgeEdges).toHaveLength(2)
    expect(bridgeEdges.some(e => e.sourceNodeId === 'a' && e.targetNodeId === 'bridge-1')).toBe(true)
    expect(bridgeEdges.some(e => e.sourceNodeId === 'bridge-1' && e.targetNodeId === 'b')).toBe(true)
  })

  it('injects one suggestion edge for a missing_edge suggestion', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', true, seedsWithSuggestions)
    const edgeSuggestions = r.suggestionEdgeDisplays.filter(e => e.suggestionId === 'edge-1')
    expect(edgeSuggestions).toHaveLength(1)
    expect(edgeSuggestions[0].sourceNodeId).toBe('a')
    expect(edgeSuggestions[0].targetNodeId).toBe('b')
  })

  it('total suggestion edge displays = 3 (2 bridge + 1 missing_edge)', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', true, seedsWithSuggestions)
    expect(r.suggestionEdgeDisplays).toHaveLength(3)
  })

  it('suggestions array contains all active suggestions', () => {
    const r = computeGraphDisplay(twoNodeGraph, emptyProgress, 'bkt', true, seedsWithSuggestions)
    expect(r.suggestions).toHaveLength(2)
    expect(r.suggestions.map(s => s.id)).toContain('bridge-1')
    expect(r.suggestions.map(s => s.id)).toContain('edge-1')
  })
})

// ─── removeSuggestion ────────────────────────────────────────────────────────

describe('removeSuggestion', () => {
  it('removes a bridge suggestion by id', () => {
    const seeds: SeedSuggestions = {
      bridgeSuggestions: [
        { id: 'b1', type: 'bridge_node', label: 'X', targetNodeId: 't', sourceNodeId: 's', reason: '' },
        { id: 'b2', type: 'bridge_node', label: 'Y', targetNodeId: 't', sourceNodeId: 's', reason: '' },
      ],
      edgeSuggestions: [],
    }
    const r = removeSuggestion(seeds, 'b1')
    expect(r.bridgeSuggestions).toHaveLength(1)
    expect(r.bridgeSuggestions[0].id).toBe('b2')
  })

  it('removes an edge suggestion by id', () => {
    const seeds: SeedSuggestions = {
      bridgeSuggestions: [],
      edgeSuggestions: [
        { id: 'e1', type: 'missing_edge', sourceNodeId: 's', targetNodeId: 't', reason: '' },
      ],
    }
    const r = removeSuggestion(seeds, 'e1')
    expect(r.edgeSuggestions).toHaveLength(0)
  })

  it('leaves other suggestions untouched', () => {
    const seeds: SeedSuggestions = {
      bridgeSuggestions: [
        { id: 'b1', type: 'bridge_node', label: 'X', targetNodeId: 't', sourceNodeId: 's', reason: '' },
      ],
      edgeSuggestions: [
        { id: 'e1', type: 'missing_edge', sourceNodeId: 's', targetNodeId: 't', reason: '' },
      ],
    }
    const r = removeSuggestion(seeds, 'e1')
    expect(r.bridgeSuggestions).toHaveLength(1)
    expect(r.edgeSuggestions).toHaveLength(0)
  })

  it('is a no-op when id does not exist in either list', () => {
    const seeds: SeedSuggestions = {
      bridgeSuggestions: [
        { id: 'b1', type: 'bridge_node', label: 'X', targetNodeId: 't', sourceNodeId: 's', reason: '' },
      ],
      edgeSuggestions: [
        { id: 'e1', type: 'missing_edge', sourceNodeId: 's', targetNodeId: 't', reason: '' },
      ],
    }
    const r = removeSuggestion(seeds, 'does-not-exist')
    expect(r.bridgeSuggestions).toHaveLength(1)
    expect(r.edgeSuggestions).toHaveLength(1)
  })
})
