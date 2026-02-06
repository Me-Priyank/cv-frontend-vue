/**
 * Verilog FSM Import Parser
 * Parses Verilog code to extract FSM structure from `always @(posedge clk)` blocks
 * 
 * This is a unique feature that differentiates CircuitVerse from other simulators
 */

import type { FSMDefinition, FSMState, FSMTransition } from '../../../types/fsm'

/**
 * Parse result from Verilog FSM extraction
 */
export interface VerilogFSMParseResult {
    success: boolean
    fsm?: FSMDefinition
    error?: string
    warnings: string[]
}

/**
 * Verilog FSM Parser class
 */
export class VerilogFSMParser {
    private verilogCode: string
    private warnings: string[] = []

    constructor(verilogCode: string) {
        this.verilogCode = verilogCode
    }

    /**
     * Main parsing method - extracts FSM from Verilog code
     */
    parse(): VerilogFSMParseResult {
        try {
            this.warnings = []

            // Step 1: Find state register declarations
            const stateInfo = this.findStateRegister()
            if (!stateInfo) {
                return {
                    success: false,
                    error: 'Could not find state register (reg) declaration',
                    warnings: this.warnings
                }
            }

            // Step 2: Find state parameter/localparam definitions
            const stateDefinitions = this.findStateDefinitions(stateInfo.name)

            // Step 3: Find always block with case statement
            const alwaysBlock = this.findAlwaysBlock()
            if (!alwaysBlock) {
                return {
                    success: false,
                    error: 'Could not find always @(posedge clk) block with case statement',
                    warnings: this.warnings
                }
            }

            // Step 4: Parse case statement to extract transitions
            const caseBlock = this.extractCaseBlock(alwaysBlock)
            if (!caseBlock) {
                return {
                    success: false,
                    error: 'Could not find case statement in always block',
                    warnings: this.warnings
                }
            }

            // Step 5: Build FSM from parsed information
            const fsm = this.buildFSM(stateInfo, stateDefinitions, caseBlock)

            return {
                success: true,
                fsm,
                warnings: this.warnings
            }
        } catch (error) {
            return {
                success: false,
                error: `Parse error: ${error}`,
                warnings: this.warnings
            }
        }
    }

    /**
     * Find state register declaration (e.g., "reg [1:0] state;")
     */
    private findStateRegister(): { name: string; bits: number } | null {
        // Match: reg [n:0] state; or reg state;
        const regPatterns = [
            /reg\s*\[(\d+):0\]\s*(\w+)\s*;/g,  // reg [n:0] name;
            /reg\s+(\w+)\s*;/g                   // reg name;
        ]

        // Common state register names
        const stateNames = ['state', 'current_state', 'curr_state', 'fsm_state', 'ps', 'present_state']

        for (const pattern of regPatterns) {
            let match
            while ((match = pattern.exec(this.verilogCode)) !== null) {
                const name = match.length === 3 ? match[2] : match[1]
                const bits = match.length === 3 ? parseInt(match[1]) + 1 : 1

                if (stateNames.some(sn => name.toLowerCase().includes(sn))) {
                    return { name, bits }
                }
            }
        }

        // Try to find any reg that's used in a case statement
        const caseMatch = /case\s*\((\w+)\)/i.exec(this.verilogCode)
        if (caseMatch) {
            const caseName = caseMatch[1]
            const regMatch = new RegExp(`reg\\s*(?:\\[(\\d+):0\\])?\\s*${caseName}\\s*;`).exec(this.verilogCode)
            if (regMatch) {
                const bits = regMatch[1] ? parseInt(regMatch[1]) + 1 : 1
                return { name: caseName, bits }
            }
            // Assume it's a state register even without explicit reg declaration
            return { name: caseName, bits: 2 }
        }

        return null
    }

    /**
     * Find state definitions (parameter/localparam)
     */
    private findStateDefinitions(stateRegName: string): Map<string, string> {
        const definitions = new Map<string, string>()

        // Match: parameter S0 = 2'b00; or localparam S1 = 1;
        const patterns = [
            /(?:parameter|localparam)\s+(\w+)\s*=\s*(\d+'[bd][\d_]+|\d+)\s*[;,]/g,
            /`define\s+(\w+)\s+(\d+'[bd][\d_]+|\d+)/g
        ]

        for (const pattern of patterns) {
            let match
            while ((match = pattern.exec(this.verilogCode)) !== null) {
                const name = match[1]
                const value = match[2]
                definitions.set(name, value)
            }
        }

        // If no explicit definitions, try to extract from case labels
        if (definitions.size === 0) {
            const casePattern = /(\w+)\s*:/g
            const caseMatch = this.verilogCode.match(/case\s*\([^)]+\)([\s\S]*?)endcase/i)
            if (caseMatch) {
                let labelMatch
                while ((labelMatch = casePattern.exec(caseMatch[1])) !== null) {
                    const label = labelMatch[1]
                    if (label !== 'default') {
                        definitions.set(label, label)
                    }
                }
            }
        }

        return definitions
    }

    /**
     * Find always block content
     */
    private findAlwaysBlock(): string | null {
        // Match: always @(posedge clk) begin ... end
        const patterns = [
            /always\s*@\s*\(\s*posedge\s+\w+\s*(?:or\s+\w+\s*)*\)\s*begin([\s\S]*?)end(?:\s*$|\s*(?:always|endmodule))/gi,
            /always\s*@\s*\(\s*posedge\s+\w+\s*\)\s*([\s\S]*?)(?=always|endmodule|$)/gi
        ]

        for (const pattern of patterns) {
            const match = pattern.exec(this.verilogCode)
            if (match) {
                return match[1] || match[0]
            }
        }

        // Try simpler pattern
        const simpleMatch = /always\s*@[^)]+\)([\s\S]*?)endcase/i.exec(this.verilogCode)
        if (simpleMatch) {
            return simpleMatch[1]
        }

        return null
    }

    /**
     * Extract case block from always block
     */
    private extractCaseBlock(alwaysBlock: string): { stateVar: string; cases: Map<string, string> } | null {
        // Match: case(state) ... endcase
        const caseMatch = /case\s*\((\w+)\)([\s\S]*?)endcase/i.exec(alwaysBlock)
        if (!caseMatch) {
            return null
        }

        const stateVar = caseMatch[1]
        const caseContent = caseMatch[2]
        const cases = new Map<string, string>()

        // Parse individual case branches
        // Match: STATE_NAME: statement(s)
        const casePattern = /(\w+)\s*:\s*((?:[^:]*?)(?=\n\s*\w+\s*:|$|endcase))/gs
        let match
        while ((match = casePattern.exec(caseContent)) !== null) {
            const stateName = match[1].trim()
            const stateBody = match[2].trim()
            if (stateName !== 'default') {
                cases.set(stateName, stateBody)
            }
        }

        // Alternative: split by case labels
        if (cases.size === 0) {
            const lines = caseContent.split('\n')
            let currentState = ''
            let currentBody = ''

            for (const line of lines) {
                const labelMatch = /^\s*(\w+)\s*:/.exec(line)
                if (labelMatch && labelMatch[1] !== 'default') {
                    if (currentState) {
                        cases.set(currentState, currentBody.trim())
                    }
                    currentState = labelMatch[1]
                    currentBody = line.replace(/^\s*\w+\s*:/, '')
                } else if (currentState) {
                    currentBody += '\n' + line
                }
            }
            if (currentState) {
                cases.set(currentState, currentBody.trim())
            }
        }

        return { stateVar, cases }
    }

    /**
     * Build FSM from parsed Verilog information
     */
    private buildFSM(
        stateInfo: { name: string; bits: number },
        stateDefinitions: Map<string, string>,
        caseBlock: { stateVar: string; cases: Map<string, string> }
    ): FSMDefinition {
        const states: FSMState[] = []
        const transitions: FSMTransition[] = []
        const inputs: string[] = []
        const outputs: string[] = []

        // Extract inputs from if conditions
        const inputSet = new Set<string>()
        const outputSet = new Set<string>()

        let stateIndex = 0
        let transitionId = 0

        // Create states from case labels
        for (const [stateName, caseBody] of caseBlock.cases) {
            const state: FSMState = {
                id: stateName,
                label: stateName,
                isInitial: stateIndex === 0 || stateName.includes('IDLE') || stateName.includes('S0'),
                isFinal: false,
                position: {
                    x: 100 + (stateIndex % 4) * 150,
                    y: 100 + Math.floor(stateIndex / 4) * 120
                },
                outputs: {}
            }
            states.push(state)
            stateIndex++

            // Parse transitions from case body
            const parsedTransitions = this.parseTransitions(stateName, caseBody, stateInfo.name)

            for (const trans of parsedTransitions) {
                trans.id = `T${transitionId++}`
                transitions.push(trans)

                // Collect inputs
                if (trans.inputs) {
                    for (const inputName of Object.keys(trans.inputs)) {
                        inputSet.add(inputName)
                    }
                }

                // Collect outputs
                if (trans.outputs) {
                    for (const outputName of Object.keys(trans.outputs)) {
                        outputSet.add(outputName)
                    }
                }
            }
        }

        // Determine FSM type
        const isMealy = transitions.some(t => t.outputs && Object.keys(t.outputs).length > 0)

        return {
            name: 'Imported_FSM',
            type: isMealy ? 'MEALY' : 'MOORE',
            states,
            transitions,
            inputs: Array.from(inputSet),
            outputs: Array.from(outputSet),
            initialState: states[0]?.id || '',
            encoding: 'BINARY'
        }
    }

    /**
     * Parse transitions from a case body
     */
    private parseTransitions(fromState: string, caseBody: string, stateVar: string): FSMTransition[] {
        const transitions: FSMTransition[] = []

        // Pattern 1: if (condition) state <= NEXT_STATE;
        const ifPattern = /if\s*\(([^)]+)\)\s*(?:begin\s*)?([\s\S]*?)(?:end|(?=else|$))/gi
        const elsePattern = /else\s*(?:begin\s*)?([\s\S]*?)(?:end|$)/gi

        let match
        let hasConditional = false

        while ((match = ifPattern.exec(caseBody)) !== null) {
            hasConditional = true
            const condition = match[1].trim()
            const body = match[2].trim()

            const transition = this.createTransitionFromBlock(fromState, condition, body, stateVar)
            if (transition) {
                transitions.push(transition)
            }
        }

        // Handle else clause
        const elseMatch = elsePattern.exec(caseBody)
        if (elseMatch && hasConditional) {
            const elseBody = elseMatch[1].trim()
            const transition = this.createTransitionFromBlock(fromState, null, elseBody, stateVar)
            if (transition) {
                // Mark as "else" condition (complement of previous)
                if (transitions.length > 0) {
                    const prevInputs = transitions[transitions.length - 1].inputs
                    for (const [key, value] of Object.entries(prevInputs)) {
                        transition.inputs[key] = value === 1 ? 0 : 1
                    }
                }
                transitions.push(transition)
            }
        }

        // Pattern 2: Direct assignment (no if)
        if (!hasConditional) {
            const directMatch = new RegExp(`${stateVar}\\s*<=?\\s*(\\w+)`, 'i').exec(caseBody)
            if (directMatch) {
                const nextState = directMatch[1]
                transitions.push({
                    id: '',
                    from: fromState,
                    to: nextState,
                    inputs: {},
                    outputs: {},
                    label: ''
                })
            }
        }

        // Generate labels
        for (const trans of transitions) {
            trans.label = this.generateTransitionLabel(trans)
        }

        return transitions
    }

    /**
     * Create a transition from a code block
     */
    private createTransitionFromBlock(
        fromState: string,
        condition: string | null,
        body: string,
        stateVar: string
    ): FSMTransition | null {
        // Find next state assignment
        const stateMatch = new RegExp(`${stateVar}\\s*<=?\\s*(\\w+)`, 'i').exec(body)
        if (!stateMatch) {
            return null
        }

        const nextState = stateMatch[1]
        const inputs: Record<string, number> = {}
        const outputs: Record<string, number> = {}

        // Parse condition to extract inputs
        if (condition) {
            // Single variable: if (x) or if (!x) or if (~x)
            const singleVarMatch = /^([!~])?(\w+)$/.exec(condition.trim())
            if (singleVarMatch) {
                const isNegated = singleVarMatch[1] === '!' || singleVarMatch[1] === '~'
                const varName = singleVarMatch[2]
                inputs[varName] = isNegated ? 0 : 1
            } else {
                // Comparison: if (x == 1) or if (x == 0)
                const compareMatch = /(\w+)\s*==\s*(\d+'?[bdh]?)?(\d+)/i.exec(condition)
                if (compareMatch) {
                    const varName = compareMatch[1]
                    const value = parseInt(compareMatch[3])
                    inputs[varName] = value
                }

                // Handle AND conditions: if (a && b) or if (a & b)
                const andMatch = /(\w+)\s*(?:&&?|and)\s*(\w+)/i.exec(condition)
                if (andMatch) {
                    inputs[andMatch[1]] = 1
                    inputs[andMatch[2]] = 1
                }
            }
        }

        // Parse body to extract outputs
        const outputPattern = /(\w+)\s*<=?\s*(\d+'?[bdh]?)?(\d+)\s*;/g
        let outputMatch
        while ((outputMatch = outputPattern.exec(body)) !== null) {
            const varName = outputMatch[1]
            const value = parseInt(outputMatch[3])
            if (varName !== stateVar) {
                outputs[varName] = value
            }
        }

        return {
            id: '',
            from: fromState,
            to: nextState,
            inputs,
            outputs,
            label: ''
        }
    }

    /**
     * Generate transition label
     */
    private generateTransitionLabel(transition: FSMTransition): string {
        const inputParts: string[] = []
        const outputParts: string[] = []

        for (const [name, value] of Object.entries(transition.inputs || {})) {
            inputParts.push(`${name}=${value}`)
        }

        for (const [name, value] of Object.entries(transition.outputs || {})) {
            outputParts.push(`${name}=${value}`)
        }

        if (inputParts.length === 0 && outputParts.length === 0) {
            return ''
        }

        if (outputParts.length === 0) {
            return inputParts.join(',')
        }

        return `${inputParts.join(',')}/${outputParts.join(',')}`
    }
}

/**
 * Convenience function to parse Verilog and extract FSM
 */
export function parseVerilogFSM(verilogCode: string): VerilogFSMParseResult {
    const parser = new VerilogFSMParser(verilogCode)
    return parser.parse()
}

/**
 * Check if Verilog code appears to contain an FSM
 */
export function detectFSMInVerilog(verilogCode: string): boolean {
    // Look for common FSM patterns
    const patterns = [
        /always\s*@\s*\(\s*posedge/i,
        /case\s*\(\s*\w*state\w*\s*\)/i,
        /parameter\s+\w+\s*=\s*\d+'b/i
    ]

    return patterns.some(pattern => pattern.test(verilogCode))
}
