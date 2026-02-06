/**
 * FSM Validator Utility
 * Validates FSM definitions and checks for completeness
 */

import type { FSMDefinition, FSMState, FSMTransition, FSMValidationResult } from '../../../types/fsm'

/**
 * Validates an FSM definition and returns validation result
 */
export function validateFSM(fsm: FSMDefinition): FSMValidationResult {
    const result: FSMValidationResult = {
        isValid: true,
        completenessIssues: [],
        unreachableStates: [],
        deadStates: [],
        conflicts: []
    }

    if (fsm.states.length === 0) {
        result.isValid = false
        result.completenessIssues.push('FSM has no states')
        return result
    }

    // Check for initial state
    if (!fsm.initialState) {
        result.isValid = false
        result.completenessIssues.push('No initial state defined')
    }

    // Check for unreachable states
    const reachable = findReachableStates(fsm)
    for (const state of fsm.states) {
        if (!reachable.has(state.id) && state.id !== fsm.initialState) {
            result.unreachableStates.push(state.id)
        }
    }
    if (result.unreachableStates.length > 0) {
        result.isValid = false
    }

    // Check for dead states (no outgoing transitions)
    for (const state of fsm.states) {
        const outgoing = fsm.transitions.filter(t => t.from === state.id)
        if (outgoing.length === 0 && !state.isFinal) {
            result.deadStates.push(state.id)
        }
    }

    // Check for transition conflicts (same input from same state)
    const transitionMap = new Map<string, FSMTransition[]>()
    for (const transition of fsm.transitions) {
        const key = `${transition.from}-${JSON.stringify(transition.inputs)}`
        if (!transitionMap.has(key)) {
            transitionMap.set(key, [])
        }
        transitionMap.get(key)!.push(transition)
    }
    for (const [key, transitions] of transitionMap) {
        if (transitions.length > 1) {
            result.conflicts.push(`Duplicate transitions: ${key}`)
            result.isValid = false
        }
    }

    return result
}

/**
 * Find all states reachable from initial state using BFS
 */
function findReachableStates(fsm: FSMDefinition): Set<string> {
    const reachable = new Set<string>()
    const queue = [fsm.initialState]

    while (queue.length > 0) {
        const current = queue.shift()!
        if (reachable.has(current)) continue
        reachable.add(current)

        const outgoing = fsm.transitions.filter(t => t.from === current)
        for (const t of outgoing) {
            if (!reachable.has(t.to)) {
                queue.push(t.to)
            }
        }
    }

    return reachable
}

/**
 * Check if FSM is complete (all states have transitions for all inputs)
 */
export function isComplete(fsm: FSMDefinition): boolean {
    const inputCombinations = getInputCombinations(fsm.inputs)

    for (const state of fsm.states) {
        const stateTransitions = fsm.transitions.filter(t => t.from === state.id)
        const coveredInputs = new Set(stateTransitions.map(t => JSON.stringify(t.inputs)))

        for (const combo of inputCombinations) {
            if (!coveredInputs.has(JSON.stringify(combo))) {
                return false
            }
        }
    }

    return true
}

/**
 * Generate all possible input combinations
 */
function getInputCombinations(inputs: string[]): Record<string, number>[] {
    const n = inputs.length
    const combinations: Record<string, number>[] = []

    for (let i = 0; i < Math.pow(2, n); i++) {
        const combo: Record<string, number> = {}
        for (let j = 0; j < n; j++) {
            combo[inputs[j]] = (i >> j) & 1
        }
        combinations.push(combo)
    }

    return combinations
}
