/**
 * FSM to Circuit Synthesizer
 * Core synthesis engine that converts FSM definitions to CircuitVerse circuits
 */

import type {
    FSMDefinition,
    FSMState,
    FSMTransition,
    StateEncoding,
    TruthTableRow,
    FSMCircuitData
} from '../../../types/fsm'
import { simplifyExpression } from './kmapSimplifier'

/**
 * Main synthesis class that converts FSM to Circuit
 */
export class FSMSynthesizer {
    private fsm: FSMDefinition
    private stateEncoding: Map<string, string> = new Map()
    private numFlipFlops: number = 0

    constructor(fsm: FSMDefinition) {
        this.fsm = fsm
    }

    /**
     * Main synthesis method - generates circuit data from FSM
     */
    synthesize(): FSMCircuitData {
        // Step 1: Encode states
        this.encodeStates()

        // Step 2: Generate truth table
        const truthTable = this.generateTruthTable()

        // Step 3: Extract logic expressions using simplified K-Map
        const nextStateLogic = this.extractNextStateLogic(truthTable)
        const outputLogic = this.extractOutputLogic(truthTable)

        return {
            truthTable,
            nextStateLogic,
            outputLogic,
            stateRegister: this.getFlipFlopNames()
        }
    }

    /**
     * Encode states based on selected encoding method
     */
    private encodeStates(): void {
        const n = this.fsm.states.length

        switch (this.fsm.encoding) {
            case 'BINARY':
                this.numFlipFlops = Math.ceil(Math.log2(n))
                this.fsm.states.forEach((state, i) => {
                    this.stateEncoding.set(state.id, i.toString(2).padStart(this.numFlipFlops, '0'))
                })
                break

            case 'GRAY':
                this.numFlipFlops = Math.ceil(Math.log2(n))
                this.fsm.states.forEach((state, i) => {
                    const gray = (i ^ (i >> 1)).toString(2).padStart(this.numFlipFlops, '0')
                    this.stateEncoding.set(state.id, gray)
                })
                break

            case 'ONE_HOT':
                this.numFlipFlops = n
                this.fsm.states.forEach((state, i) => {
                    const oneHot = '0'.repeat(i) + '1' + '0'.repeat(n - i - 1)
                    this.stateEncoding.set(state.id, oneHot)
                })
                break

            default:
                // Default to binary
                this.numFlipFlops = Math.ceil(Math.log2(n)) || 1
                this.fsm.states.forEach((state, i) => {
                    this.stateEncoding.set(state.id, i.toString(2).padStart(this.numFlipFlops, '0'))
                })
        }
    }

    /**
     * Generate truth table for FSM
     */
    private generateTruthTable(): TruthTableRow[] {
        const truthTable: TruthTableRow[] = []
        const inputCombinations = this.getInputCombinations()

        for (const state of this.fsm.states) {
            const currentStateCode = this.stateEncoding.get(state.id)!

            for (const inputs of inputCombinations) {
                // Find matching transition
                const transition = this.findTransition(state.id, inputs)

                if (transition) {
                    const nextStateCode = this.stateEncoding.get(transition.to)!
                    const outputs = this.getOutputs(state, transition)

                    truthTable.push({
                        currentState: currentStateCode,
                        inputs,
                        nextState: nextStateCode,
                        outputs
                    })
                } else {
                    // No transition defined - stay in current state
                    truthTable.push({
                        currentState: currentStateCode,
                        inputs,
                        nextState: currentStateCode, // Stay in current state
                        outputs: this.getDefaultOutputs()
                    })
                }
            }
        }

        return truthTable
    }

    /**
     * Find transition for given state and input combination
     */
    private findTransition(stateId: string, inputs: Record<string, number>): FSMTransition | null {
        for (const transition of this.fsm.transitions) {
            if (transition.from !== stateId) continue

            // Check if inputs match
            let match = true
            for (const [key, value] of Object.entries(transition.inputs)) {
                if (inputs[key] !== undefined && inputs[key] !== value) {
                    match = false
                    break
                }
            }
            if (match) return transition
        }
        return null
    }

    /**
     * Get outputs for Moore or Mealy machine
     */
    private getOutputs(state: FSMState, transition: FSMTransition): Record<string, number> {
        if (this.fsm.type === 'MEALY' && transition.outputs) {
            return transition.outputs
        }
        return state.outputs || this.getDefaultOutputs()
    }

    /**
     * Get default outputs (all zeros)
     */
    private getDefaultOutputs(): Record<string, number> {
        const defaults: Record<string, number> = {}
        for (const output of this.fsm.outputs) {
            defaults[output] = 0
        }
        return defaults
    }

    /**
     * Generate all input combinations
     */
    private getInputCombinations(): Record<string, number>[] {
        const inputs = this.fsm.inputs
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

    /**
     * Extract next state logic using Quine-McCluskey simplification
     * This reduces gate count by combining minterms
     */
    private extractNextStateLogic(truthTable: TruthTableRow[]): Record<string, string> {
        const logic: Record<string, string> = {}
        const numInputs = this.fsm.inputs.length
        const numVars = this.numFlipFlops + numInputs

        // Build variable names: Q0, Q1, ..., then input names
        const varNames: string[] = []
        for (let i = 0; i < this.numFlipFlops; i++) {
            varNames.push(`Q${i}`)
        }
        varNames.push(...this.fsm.inputs)

        for (let bit = 0; bit < this.numFlipFlops; bit++) {
            const bitName = `Q${bit}`
            const mintermIndices: number[] = []

            // Collect minterm indices where this output bit is 1
            for (let rowIdx = 0; rowIdx < truthTable.length; rowIdx++) {
                const row = truthTable[rowIdx]
                if (row.nextState[bit] === '1') {
                    // Calculate minterm index from current state bits + input bits
                    let mintermIndex = 0

                    // State bits (most significant)
                    for (let i = 0; i < this.numFlipFlops; i++) {
                        if (row.currentState[i] === '1') {
                            mintermIndex |= (1 << (numVars - 1 - i))
                        }
                    }

                    // Input bits (least significant)
                    let inputIdx = this.numFlipFlops
                    for (const input of this.fsm.inputs) {
                        if (row.inputs[input] === 1) {
                            mintermIndex |= (1 << (numVars - 1 - inputIdx))
                        }
                        inputIdx++
                    }

                    mintermIndices.push(mintermIndex)
                }
            }

            // Use Quine-McCluskey to simplify
            if (mintermIndices.length === 0) {
                logic[bitName] = '0'
            } else if (mintermIndices.length === truthTable.length) {
                logic[bitName] = '1'
            } else {
                logic[bitName] = simplifyExpression(mintermIndices, numVars, varNames)
            }
        }

        return logic
    }

    /**
     * Extract output logic using Quine-McCluskey simplification
     */
    private extractOutputLogic(truthTable: TruthTableRow[]): Record<string, string> {
        const logic: Record<string, string> = {}
        const numInputs = this.fsm.type === 'MEALY' ? this.fsm.inputs.length : 0
        const numVars = this.numFlipFlops + numInputs

        // Build variable names based on FSM type
        const varNames: string[] = []
        for (let i = 0; i < this.numFlipFlops; i++) {
            varNames.push(`Q${i}`)
        }
        if (this.fsm.type === 'MEALY') {
            varNames.push(...this.fsm.inputs)
        }

        for (const output of this.fsm.outputs) {
            const mintermIndices: number[] = []
            const seenMinterms = new Set<number>()

            for (let rowIdx = 0; rowIdx < truthTable.length; rowIdx++) {
                const row = truthTable[rowIdx]
                if (row.outputs[output] === 1) {
                    // Calculate minterm index
                    let mintermIndex = 0

                    // State bits
                    for (let i = 0; i < this.numFlipFlops; i++) {
                        if (row.currentState[i] === '1') {
                            mintermIndex |= (1 << (numVars - 1 - i))
                        }
                    }

                    // Input bits for Mealy
                    if (this.fsm.type === 'MEALY') {
                        let inputIdx = this.numFlipFlops
                        for (const input of this.fsm.inputs) {
                            if (row.inputs[input] === 1) {
                                mintermIndex |= (1 << (numVars - 1 - inputIdx))
                            }
                            inputIdx++
                        }
                    }

                    if (!seenMinterms.has(mintermIndex)) {
                        seenMinterms.add(mintermIndex)
                        mintermIndices.push(mintermIndex)
                    }
                }
            }

            // Use Quine-McCluskey to simplify
            if (mintermIndices.length === 0) {
                logic[output] = '0'
            } else if (numVars > 0 && mintermIndices.length === Math.pow(2, numVars)) {
                logic[output] = '1'
            } else if (numVars === 0) {
                // Edge case: no variables (constant output)
                logic[output] = mintermIndices.length > 0 ? '1' : '0'
            } else {
                logic[output] = simplifyExpression(mintermIndices, numVars, varNames)
            }
        }

        return logic
    }

    /**
     * Get flip-flop names for state register
     */
    private getFlipFlopNames(): string[] {
        const names: string[] = []
        for (let i = 0; i < this.numFlipFlops; i++) {
            names.push(`Q${i}`)
        }
        return names
    }

    /**
     * Get state encoding map for display
     */
    getStateEncoding(): Map<string, string> {
        return this.stateEncoding
    }

    /**
     * Get number of flip-flops needed
     */
    getFlipFlopCount(): number {
        return this.numFlipFlops
    }
}

/**
 * Generate Verilog code from FSM
 */
export function generateVerilogFromFSM(fsm: FSMDefinition): string {
    const moduleName = fsm.name.replace(/\s+/g, '_').toLowerCase()
    const synthesizer = new FSMSynthesizer(fsm)

    // MUST synthesize first to encode states!
    synthesizer.synthesize()

    const encoding = synthesizer.getStateEncoding()
    const numBits = synthesizer.getFlipFlopCount() || 1 // At least 1 bit

    let verilog = `// FSM Module: ${fsm.name}\n`
    verilog += `// Type: ${fsm.type}\n`
    verilog += `// Encoding: ${fsm.encoding}\n`
    verilog += `// Generated by CircuitVerse FSM Synthesizer\n\n`

    verilog += `module ${moduleName}(\n`
    verilog += `    input wire clk,\n`
    verilog += `    input wire rst,\n`

    // Inputs
    for (const input of fsm.inputs) {
        verilog += `    input wire ${input},\n`
    }

    // Outputs
    for (let i = 0; i < fsm.outputs.length; i++) {
        const comma = i < fsm.outputs.length - 1 ? ',' : ''
        verilog += `    output reg ${fsm.outputs[i]}${comma}\n`
    }
    verilog += `);\n\n`

    // State encoding
    verilog += `// State encoding\n`
    for (const state of fsm.states) {
        const code = encoding.get(state.id) || '0'.repeat(numBits)
        verilog += `localparam ${state.label} = ${numBits}'b${code};\n`
    }
    verilog += `\n`

    // State register
    verilog += `reg [${numBits - 1}:0] state, next_state;\n\n`

    // State transition - sequential logic
    verilog += `// Sequential logic\n`
    verilog += `always @(posedge clk or posedge rst) begin\n`
    verilog += `    if (rst)\n`
    verilog += `        state <= ${fsm.states.find(s => s.id === fsm.initialState)?.label || 'S0'};\n`
    verilog += `    else\n`
    verilog += `        state <= next_state;\n`
    verilog += `end\n\n`

    // Next state logic - combinational logic
    verilog += `// Next state logic\n`
    verilog += `always @(*) begin\n`
    verilog += `    case (state)\n`

    for (const state of fsm.states) {
        verilog += `        ${state.label}: begin\n`

        const transitions = fsm.transitions.filter(t => t.from === state.id)
        if (transitions.length > 0) {
            for (let i = 0; i < transitions.length; i++) {
                const t = transitions[i]
                const toState = fsm.states.find(s => s.id === t.to)
                const inputCondition = Object.entries(t.inputs)
                    .map(([k, v]) => v === 1 ? k : `!${k}`)
                    .join(' && ')

                if (i === 0) {
                    verilog += `            if (${inputCondition})\n`
                } else {
                    verilog += `            else if (${inputCondition})\n`
                }
                verilog += `                next_state = ${toState?.label || 'S0'};\n`
            }
            verilog += `            else\n`
            verilog += `                next_state = ${state.label};\n`
        } else {
            verilog += `            next_state = ${state.label};\n`
        }
        verilog += `        end\n`
    }

    verilog += `        default: next_state = ${fsm.states[0]?.label || 'S0'};\n`
    verilog += `    endcase\n`
    verilog += `end\n\n`

    // Output logic
    if (fsm.type === 'MOORE') {
        verilog += `// Output logic (Moore)\n`
        verilog += `always @(*) begin\n`
        verilog += `    case (state)\n`

        for (const state of fsm.states) {
            verilog += `        ${state.label}: begin\n`
            for (const output of fsm.outputs) {
                const value = state.outputs?.[output] ?? 0
                verilog += `            ${output} = ${value};\n`
            }
            verilog += `        end\n`
        }

        verilog += `        default: begin\n`
        for (const output of fsm.outputs) {
            verilog += `            ${output} = 0;\n`
        }
        verilog += `        end\n`
        verilog += `    endcase\n`
        verilog += `end\n`
    }

    verilog += `\nendmodule\n`

    return verilog
}
