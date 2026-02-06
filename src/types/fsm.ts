/**
 * FSM (Finite State Machine) Type Definitions
 * Used for FSM to Circuit Synthesizer
 */

export type FSMType = 'MOORE' | 'MEALY' | 'DFA' | 'NFA'

export type StateEncoding = 'BINARY' | 'GRAY' | 'ONE_HOT' | 'CUSTOM'

export interface FSMState {
    id: string
    label: string
    isInitial: boolean
    isFinal: boolean
    position: { x: number; y: number }
    outputs?: Record<string, number> // For Moore machines (outputs per state)
}

export interface FSMTransition {
    id: string
    from: string // state id
    to: string // state id
    inputs: Record<string, number | string> // Input conditions (e.g., {X: 1, Y: 0})
    outputs?: Record<string, number> // For Mealy machines (outputs per transition)
    label?: string // Display label
}

export interface FSMDefinition {
    name: string
    type: FSMType
    states: FSMState[]
    transitions: FSMTransition[]
    inputs: string[] // Input signal names (e.g., ['X', 'Y'])
    outputs: string[] // Output signal names (e.g., ['Z'])
    initialState: string // state id
    encoding: StateEncoding
    customEncoding?: Record<string, string> // state id -> binary code
}

export interface FSMValidationResult {
    isValid: boolean
    completenessIssues: string[]
    unreachableStates: string[]
    deadStates: string[]
    conflicts: string[]
}

export interface OptimizationMetrics {
    encoding: StateEncoding
    numStates: number
    numFlipFlops: number
    estimatedGateCount: number
    logicDepth: number
    avgTransitionsPerClock: number
}

export interface FSMCircuitData {
    truthTable: TruthTableRow[]
    nextStateLogic: Record<string, string> // state bit -> boolean expression
    outputLogic: Record<string, string> // output signal -> boolean expression
    stateRegister: string[] // flip-flop names
}

export interface TruthTableRow {
    currentState: string // binary encoded
    inputs: Record<string, number>
    nextState: string // binary encoded
    outputs: Record<string, number>
}
