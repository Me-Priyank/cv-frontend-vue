/**
 * FSM Circuit Generator
 * Generates CircuitVerse circuit components from synthesized FSM logic
 * 
 * This version creates complete circuits with:
 * - Input/Output components
 * - Clock and DFlipFlops for state register
 * - Logic gates (AND, OR, NOT) for next-state and output logic
 * - Proper wiring via allNodes connections
 */

import type { FSMDefinition } from '../../../types/fsm'
import { FSMSynthesizer } from './fsmSynthesizer'
import { parseExpression, getProductTerms, type ProductTerm } from './expressionParser'

/**
 * Node data structure for allNodes array
 */
interface NodeData {
    x: number
    y: number
    type: number // 0=INPUT, 1=OUTPUT, 2=INTERMEDIATE
    bitWidth: number
    label: string
    connections: number[] // indices into allNodes
}

/**
 * Tracks nodes for wiring
 */
interface NodeTracker {
    allNodes: NodeData[]
    nodeIndex: number
    // Maps signal names to their source node indices
    signalSources: Map<string, number>      // e.g., "X" -> node index of Input X output
    invertedSignals: Map<string, number>    // e.g., "X'" -> node index of NOT gate output
    // Track intermediate nodes for wire routing (type=2)
    intermediateNodeIndices: number[]
    // Track absolute positions of nodes: nodeIndex -> {x, y}
    nodePositions: Map<number, { x: number, y: number }>
    // Counter for wire offset to prevent overlapping intermediate nodes
    wireOffset: number
}

/**
 * Add a node to the tracker
 * @param componentX - X position of the parent component (for absolute positioning)
 * @param componentY - Y position of the parent component (for absolute positioning)
 */
function addNode(
    tracker: NodeTracker,
    nodeRelX: number,
    nodeRelY: number,
    type: number,
    bitWidth: number = 1,
    label: string = '',
    componentX: number = 0,
    componentY: number = 0
): number {
    tracker.allNodes.push({ x: nodeRelX, y: nodeRelY, type, bitWidth, label, connections: [] })
    const idx = tracker.nodeIndex++
    // Store absolute position for orthogonal routing
    tracker.nodePositions.set(idx, {
        x: componentX + nodeRelX,
        y: componentY + nodeRelY
    })
    return idx
}

/**
 * Connect two nodes bidirectionally (direct connection - may create diagonal wire)
 */
function connectNodes(tracker: NodeTracker, nodeA: number, nodeB: number): void {
    if (!tracker.allNodes[nodeA].connections.includes(nodeB)) {
        tracker.allNodes[nodeA].connections.push(nodeB)
    }
    if (!tracker.allNodes[nodeB].connections.includes(nodeA)) {
        tracker.allNodes[nodeB].connections.push(nodeA)
    }
}

/**
 * Connect two nodes with orthogonal (L-shaped) routing using an intermediate node.
 * Uses stored node positions from nodePositions map.
 * Creates: source -> intermediate -> target
 * The intermediate node is placed for horizontal-first routing.
 */
function connectOrthogonal(tracker: NodeTracker, sourceNodeIdx: number, targetNodeIdx: number): void {
    const srcPos = tracker.nodePositions.get(sourceNodeIdx)
    const tgtPos = tracker.nodePositions.get(targetNodeIdx)

    if (!srcPos || !tgtPos) {
        // Fallback to direct connection if positions not available
        connectNodes(tracker, sourceNodeIdx, targetNodeIdx)
        return
    }

    // If already aligned (same row or column), connect directly
    if (srcPos.x === tgtPos.x || srcPos.y === tgtPos.y) {
        connectNodes(tracker, sourceNodeIdx, targetNodeIdx)
        return
    }

    // Create intermediate node at the turning point
    // Use horizontal-first routing: go horizontal to target X, then vertical to target Y
    const intermediateX = tgtPos.x
    const intermediateY = srcPos.y

    // Type 2 = intermediate node, with absolute coordinates
    tracker.allNodes.push({ x: intermediateX, y: intermediateY, type: 2, bitWidth: 1, label: '', connections: [] })
    const intermediateIdx = tracker.nodeIndex++
    tracker.intermediateNodeIndices.push(intermediateIdx)
    tracker.nodePositions.set(intermediateIdx, { x: intermediateX, y: intermediateY })

    // Connect: source -> intermediate -> target
    connectNodes(tracker, sourceNodeIdx, intermediateIdx)
    connectNodes(tracker, intermediateIdx, targetNodeIdx)
}

/**
 * Layout constants for circuit placement
 * 
 * Layout Strategy:
 * - Column 1: Inputs (CLK, X, etc.) on far left
 * - Column 2: NOT gates (inversions)
 * - Column 3: AND gates (product terms)  
 * - Column 4: OR gate (combining terms)
 * - Column 5: DFlipFlops (state register)
 * - Column 6: Outputs on far right
 * 
 * This creates a left-to-right data flow with feedback from DFF to logic gates
 */
const LAYOUT = {
    // Inputs - far left column
    INPUT_X: 100,
    INPUT_START_Y: 200,
    INPUT_SPACING_Y: 100,
    CLOCK_X: 100,
    CLOCK_Y: 100,

    // NOT gates - second column
    NOT_X: 250,
    NOT_START_Y: 150,
    NOT_SPACING_Y: 80,

    // AND gates - third column
    AND_X: 420,
    AND_START_Y: 120,
    AND_SPACING_Y: 80,

    // OR gate - fourth column
    OR_X: 580,
    OR_START_Y: 200,
    OR_SPACING_Y: 100,

    // DFlipFlops - fifth column (receives OR output)
    DFF_X: 750,
    DFF_Y: 200,
    DFF_SPACING_X: 150,

    // Outputs - far right
    OUTPUT_X: 950,
    OUTPUT_START_Y: 200,
    OUTPUT_SPACING_Y: 80,

    // Text labels - below circuit
    TEXT_X: 100,
    TEXT_START_Y: 450
}

/**
 * Generate CircuitVerse JSON with complete wiring
 */
export function generateCircuitVerseJSON(fsm: FSMDefinition): object {
    const synthesizer = new FSMSynthesizer(fsm)
    const circuitData = synthesizer.synthesize()
    const subcircuitName = `FSM_${fsm.name.replace(/\s+/g, '_')}`

    // Initialize tracker
    const tracker: NodeTracker = {
        allNodes: [],
        nodeIndex: 0,
        signalSources: new Map(),
        invertedSignals: new Map(),
        intermediateNodeIndices: [],
        nodePositions: new Map(),
        wireOffset: 0
    }

    // Component arrays
    const clockComponents: object[] = []
    const inputComponents: object[] = []
    const dffComponents: object[] = []
    const notGateComponents: object[] = []
    const andGateComponents: object[] = []
    const orGateComponents: object[] = []
    const outputComponents: object[] = []
    const textComponents: object[] = []
    const groundComponents: object[] = []  // For constant 0 outputs
    const powerComponents: object[] = []   // For constant 1 outputs

    // ================== STEP 1: CREATE CLOCK ==================
    const clockX = LAYOUT.CLOCK_X
    const clockY = LAYOUT.CLOCK_Y
    const clockOutputNode = addNode(tracker, 10, 0, 1, 1, '', clockX, clockY)
    clockComponents.push({
        x: clockX,
        y: clockY,
        objectType: "Clock",
        label: "CLK",
        labelDirection: "LEFT",
        customData: {
            constructorParamaters: ["RIGHT"],
            nodes: { output1: clockOutputNode }
        }
    })

    // ================== STEP 2: CREATE INPUTS ==================
    interface InputInfo { nodeIdx: number, x: number, y: number }
    const inputInfos: Map<string, InputInfo> = new Map()

    for (let i = 0; i < fsm.inputs.length; i++) {
        const inputName = fsm.inputs[i]
        const inputX = LAYOUT.INPUT_X
        const inputY = LAYOUT.INPUT_START_Y + i * LAYOUT.INPUT_SPACING_Y
        const outputNode = addNode(tracker, 10, 0, 1, 1, '', inputX, inputY)
        tracker.signalSources.set(inputName, outputNode)
        inputInfos.set(inputName, { nodeIdx: outputNode, x: inputX, y: inputY })

        inputComponents.push({
            x: inputX,
            y: inputY,
            objectType: "Input",
            label: inputName,
            labelDirection: "LEFT",
            customData: {
                constructorParamaters: ["RIGHT", 1],
                nodes: { output1: outputNode }
            }
        })
    }

    // ================== STEP 3: CREATE D FLIP-FLOPS ==================
    interface DFFNodeSet {
        clockInp: number
        dInp: number
        qOutput: number
        qInvOutput: number
        reset: number
        preset: number
        en: number
    }
    interface DFFInfo { nodes: DFFNodeSet, x: number, y: number }
    const dffInfos: DFFInfo[] = []

    for (let i = 0; i < circuitData.stateRegister.length; i++) {
        const regName = circuitData.stateRegister[i] // e.g., "Q0"
        const dffX = LAYOUT.DFF_X + i * LAYOUT.DFF_SPACING_X
        const dffY = LAYOUT.DFF_Y

        const nodes: DFFNodeSet = {
            clockInp: addNode(tracker, -20, 10, 0, 1, 'Clock', dffX, dffY),
            dInp: addNode(tracker, -20, -10, 0, 1, 'D', dffX, dffY),
            qOutput: addNode(tracker, 20, -10, 1, 1, 'Q', dffX, dffY),
            qInvOutput: addNode(tracker, 20, 10, 1, 1, 'Q Inverse', dffX, dffY),
            reset: addNode(tracker, 10, 20, 0, 1, 'Asynchronous Reset', dffX, dffY),
            preset: addNode(tracker, 0, 20, 0, 1, 'Preset', dffX, dffY),
            en: addNode(tracker, -10, 20, 0, 1, 'Enable', dffX, dffY)
        }
        dffInfos.push({ nodes, x: dffX, y: dffY })

        // Register Q output as signal source
        tracker.signalSources.set(regName, nodes.qOutput)

        // Connect clock to DFF using orthogonal routing
        connectOrthogonal(tracker, clockOutputNode, nodes.clockInp)

        dffComponents.push({
            x: dffX,
            y: dffY,
            objectType: "DflipFlop",
            label: regName,
            labelDirection: "UP",
            customData: {
                constructorParamaters: ["RIGHT", 1],
                nodes: nodes
            }
        })
    }

    // ================== STEP 4: IDENTIFY ALL INVERTED SIGNALS ==================
    const allInvertedVars = new Set<string>()

    // Collect from next-state logic
    for (const expr of Object.values(circuitData.nextStateLogic)) {
        const parsed = parseExpression(expr as string)
        parsed.invertedVars.forEach(v => allInvertedVars.add(v))
    }

    // Collect from output logic
    for (const expr of Object.values(circuitData.outputLogic)) {
        const parsed = parseExpression(expr as string)
        parsed.invertedVars.forEach(v => allInvertedVars.add(v))
    }

    // ================== STEP 5: CREATE NOT GATES FOR INVERTED SIGNALS ==================
    let notY = LAYOUT.NOT_START_Y

    for (const varName of allInvertedVars) {
        const sourceNode = tracker.signalSources.get(varName)
        if (sourceNode === undefined) continue

        const notX = LAYOUT.NOT_X
        const notInputNode = addNode(tracker, -10, 0, 0, 1, '', notX, notY)
        const notOutputNode = addNode(tracker, 20, 0, 1, 1, '', notX, notY)

        // Connect source to NOT input using orthogonal routing
        connectOrthogonal(tracker, sourceNode, notInputNode)

        // Store inverted signal
        tracker.invertedSignals.set(`${varName}'`, notOutputNode)

        notGateComponents.push({
            x: notX,
            y: notY,
            objectType: "NotGate",
            label: `${varName}'`,
            labelDirection: "UP",
            customData: {
                constructorParamaters: ["RIGHT", 1],
                nodes: {
                    inp1: notInputNode,
                    output1: notOutputNode
                }
            }
        })

        notY += LAYOUT.NOT_SPACING_Y
    }

    // ================== STEP 6: CREATE LOGIC FOR NEXT-STATE ==================
    let andY = LAYOUT.AND_START_Y
    let orY = LAYOUT.OR_START_Y

    for (let i = 0; i < circuitData.stateRegister.length; i++) {
        const bitName = circuitData.stateRegister[i] // e.g., "Q0"
        const expr = circuitData.nextStateLogic[bitName]

        if (expr === '0' || expr === '1') {
            // Constant - add text note
            textComponents.push({
                x: LAYOUT.TEXT_X,
                y: LAYOUT.TEXT_START_Y + i * 25,
                objectType: "Text",
                label: `${bitName} = ${expr}`,
                labelDirection: "RIGHT",
                customData: {}
            })
            continue
        }

        const parsed = parseExpression(expr as string)
        const terms = getProductTerms(parsed)

        if (terms.length === 0) continue

        // Create AND gates for each product term
        const andOutputNodes: number[] = []

        for (const term of terms) {
            if (term.variables.length === 0) continue

            if (term.variables.length === 1) {
                // Single variable - no AND gate needed, connect directly
                const v = term.variables[0]
                const signalKey = v.inverted ? `${v.name}'` : v.name
                const sourceNode = v.inverted
                    ? tracker.invertedSignals.get(signalKey)
                    : tracker.signalSources.get(signalKey)
                if (sourceNode !== undefined) {
                    andOutputNodes.push(sourceNode)
                }
            } else {
                // Create AND gate
                const andX = LAYOUT.AND_X
                const andInputNodes: number[] = []
                for (const v of term.variables) {
                    const signalKey = v.inverted ? `${v.name}'` : v.name
                    const sourceNode = v.inverted
                        ? tracker.invertedSignals.get(signalKey)
                        : tracker.signalSources.get(v.name)

                    if (sourceNode !== undefined) {
                        const andInpNode = addNode(tracker, -10, andInputNodes.length * 10 - (term.variables.length * 5), 0, 1, '', andX, andY)
                        connectOrthogonal(tracker, sourceNode, andInpNode)
                        andInputNodes.push(andInpNode)
                    }
                }

                const andOutputNode = addNode(tracker, 20, 0, 1, 1, '', andX, andY)
                andOutputNodes.push(andOutputNode)

                andGateComponents.push({
                    x: andX,
                    y: andY,
                    objectType: "AndGate",
                    label: "",
                    labelDirection: "UP",
                    customData: {
                        constructorParamaters: ["RIGHT", andInputNodes.length, 1],
                        nodes: {
                            inp: andInputNodes,
                            output1: andOutputNode
                        }
                    }
                })
                andY += LAYOUT.AND_SPACING_Y
            }
        }

        // Create OR gate or direct connection to DFF D input
        if (andOutputNodes.length === 0) {
            // No logic - skip
            continue
        } else if (andOutputNodes.length === 1) {
            // Single term - connect directly to DFF D input
            connectOrthogonal(tracker, andOutputNodes[0], dffInfos[i].nodes.dInp)
        } else {
            // Multiple terms - create OR gate
            const orX = LAYOUT.OR_X
            const orInputNodes: number[] = []
            for (let j = 0; j < andOutputNodes.length; j++) {
                const orInpNode = addNode(tracker, -10, j * 10 - (andOutputNodes.length * 5), 0, 1, '', orX, orY)
                connectOrthogonal(tracker, andOutputNodes[j], orInpNode)
                orInputNodes.push(orInpNode)
            }

            const orOutputNode = addNode(tracker, 20, 0, 1, 1, '', orX, orY)

            // Connect OR output to DFF D input
            connectOrthogonal(tracker, orOutputNode, dffInfos[i].nodes.dInp)

            orGateComponents.push({
                x: orX,
                y: orY,
                objectType: "OrGate",
                label: "",
                labelDirection: "UP",
                customData: {
                    constructorParamaters: ["RIGHT", orInputNodes.length, 1],
                    nodes: {
                        inp: orInputNodes,
                        output1: orOutputNode
                    }
                }
            })
            orY += LAYOUT.OR_SPACING_Y
        }

        // Add equation as text
        textComponents.push({
            x: LAYOUT.TEXT_X,
            y: LAYOUT.TEXT_START_Y + i * 25,
            objectType: "Text",
            label: `${bitName} = ${expr}`,
            labelDirection: "RIGHT",
            customData: {}
        })
    }

    // ================== STEP 7: CREATE OUTPUTS ==================
    let groundY = LAYOUT.OUTPUT_START_Y + fsm.outputs.length * LAYOUT.OUTPUT_SPACING_Y + 50

    for (let i = 0; i < fsm.outputs.length; i++) {
        const outputName = fsm.outputs[i]
        const outputX = LAYOUT.OUTPUT_X
        const outputY = LAYOUT.OUTPUT_START_Y + i * LAYOUT.OUTPUT_SPACING_Y
        const inputNode = addNode(tracker, 10, 0, 0, 1, '', outputX, outputY)

        let connected = false

        // Get output logic and connect
        const outputExpr = circuitData.outputLogic[outputName]

        if (!outputExpr || outputExpr === '0') {
            // Output is always 0 - connect to Ground
            const groundX = LAYOUT.OUTPUT_X - 60
            const groundOutputNode = addNode(tracker, 10, 0, 1, 1, '', groundX, groundY)

            connectOrthogonal(tracker, groundOutputNode, inputNode)

            groundComponents.push({
                x: groundX,
                y: groundY,
                objectType: "Ground",
                label: "",
                labelDirection: "LEFT",
                customData: {
                    constructorParamaters: ["RIGHT", 1],
                    nodes: { output1: groundOutputNode }
                }
            })
            groundY += 50
            connected = true
        } else if (outputExpr === '1') {
            // Output is always 1 - connect to Power
            const powerX = LAYOUT.OUTPUT_X - 60
            const powerOutputNode = addNode(tracker, 10, 0, 1, 1, '', powerX, groundY)

            connectOrthogonal(tracker, powerOutputNode, inputNode)

            powerComponents.push({
                x: powerX,
                y: groundY,
                objectType: "Power",
                label: "",
                labelDirection: "LEFT",
                customData: {
                    constructorParamaters: ["RIGHT", 1],
                    nodes: { output1: powerOutputNode }
                }
            })
            groundY += 50
            connected = true
        } else {
            const parsed = parseExpression(outputExpr as string)
            const terms = getProductTerms(parsed)

            // For Moore machines with simple state-based outputs, 
            // connect the appropriate state flip-flop output
            if (terms.length === 1 && terms[0].variables.length === 1) {
                const v = terms[0].variables[0]
                const signalKey = v.inverted ? `${v.name}'` : v.name
                const sourceNode = v.inverted
                    ? tracker.invertedSignals.get(signalKey)
                    : tracker.signalSources.get(v.name)
                if (sourceNode !== undefined) {
                    connectOrthogonal(tracker, sourceNode, inputNode)
                    connected = true
                }
            }
            // For more complex output logic, would need AND/OR gates (similar to next-state)
            // TODO: Implement full output logic gate generation for complex expressions
        }

        // If still not connected, connect to Ground to avoid undefined
        if (!connected) {
            const groundX = LAYOUT.OUTPUT_X - 60
            const groundOutputNode = addNode(tracker, 10, 0, 1, 1, '', groundX, groundY)

            connectOrthogonal(tracker, groundOutputNode, inputNode)

            groundComponents.push({
                x: groundX,
                y: groundY,
                objectType: "Ground",
                label: `${outputName}_default`,
                labelDirection: "LEFT",
                customData: {
                    constructorParamaters: ["RIGHT", 1],
                    nodes: { output1: groundOutputNode }
                }
            })
            groundY += 50
        }

        outputComponents.push({
            x: outputX,
            y: outputY,
            objectType: "Output",
            label: outputName,
            labelDirection: "RIGHT",
            customData: {
                constructorParamaters: ["LEFT", 1],
                nodes: { inp1: inputNode }
            }
        })
    }

    // ================== BUILD PROJECT JSON ==================
    const project = {
        name: fsm.name,
        timePeriod: 500,
        clockEnabled: true,
        projectId: `fsm_${Date.now()}`,
        focussedCircuit: 0,
        orderedTabs: [subcircuitName],
        scopes: [{
            layout: {
                width: 100,
                height: 80,
                title_x: 50,
                title_y: 13,
                titleEnabled: true
            },
            verilogMetadata: {
                isVerilogCircuit: false
            },
            allNodes: tracker.allNodes,
            id: Math.floor(Math.random() * 1000000),
            name: subcircuitName,
            restrictedCircuitElementsUsed: [],
            nodes: tracker.intermediateNodeIndices,  // Intermediate nodes for wire routing

            // Components
            Clock: clockComponents,
            Input: inputComponents,
            DflipFlop: dffComponents,
            NotGate: notGateComponents,
            AndGate: andGateComponents,
            OrGate: orGateComponents,
            Output: outputComponents,
            Text: textComponents,
            Ground: groundComponents,
            Power: powerComponents,

            // FSM Metadata
            fsmMetadata: {
                type: fsm.type,
                encoding: fsm.encoding,
                states: fsm.states.map(s => s.label),
                stateEncoding: Object.fromEntries(synthesizer.getStateEncoding()),
                nextStateLogic: circuitData.nextStateLogic,
                outputLogic: circuitData.outputLogic
            }
        }]
    }

    return project
}

/**
 * Legacy function for compatibility
 */
export function generateCircuitFromFSM(fsm: FSMDefinition) {
    return {
        components: [],
        wires: [],
        subcircuitName: `FSM_${fsm.name.replace(/\s+/g, '_')}`,
        inputs: fsm.inputs,
        outputs: fsm.outputs,
        flipFlops: []
    }
}

/**
 * Get synthesis summary for display
 */
export function getSynthesisSummary(fsm: FSMDefinition): string {
    const synthesizer = new FSMSynthesizer(fsm)
    const circuitData = synthesizer.synthesize()

    let summary = `## FSM Synthesis Summary\n\n`
    summary += `**Name:** ${fsm.name}\n`
    summary += `**Type:** ${fsm.type}\n`
    summary += `**Encoding:** ${fsm.encoding}\n`
    summary += `**States:** ${fsm.states.length}\n`
    summary += `**Transitions:** ${fsm.transitions.length}\n`
    summary += `**Flip-Flops Required:** ${synthesizer.getFlipFlopCount()}\n\n`

    summary += `### State Encoding\n`
    for (const [stateId, code] of synthesizer.getStateEncoding()) {
        const state = fsm.states.find(s => s.id === stateId)
        summary += `- ${state?.label || stateId}: ${code}\n`
    }

    summary += `\n### Next State Logic\n`
    for (const [bit, expr] of Object.entries(circuitData.nextStateLogic)) {
        summary += `- ${bit} = ${expr}\n`
    }

    if (Object.keys(circuitData.outputLogic).length > 0) {
        summary += `\n### Output Logic\n`
        for (const [output, expr] of Object.entries(circuitData.outputLogic)) {
            summary += `- ${output} = ${expr}\n`
        }
    }

    return summary
}
