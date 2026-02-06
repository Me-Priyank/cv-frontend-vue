<template>
    <div
        id="fsmEditorPanel"
        class="noSelect defaultCursor draggable-panel draggable-panel-css fsm-editor-panel"
    >
        <PanelHeader header-title="FSM Editor" />

        <!-- Toolbar -->
        <div class="panel-body">
            <div class="layout-body">
                <div class="fsm-toolbar">
                    <button
                        class="largeButton btn btn-xs"
                        :class="{ 'custom-btn--primary': tool === 'state' }"
                        @click="tool = 'state'"
                    >
                        <i class="fas fa-circle"></i> Add State
                    </button>
                    <button
                        class="largeButton btn btn-xs"
                        :class="{ 'custom-btn--primary': tool === 'transition' }"
                        @click="tool = 'transition'"
                    >
                        <i class="fas fa-arrow-right"></i> Add Transition
                    </button>
                    <button
                        class="largeButton btn btn-xs"
                        :class="{ 'custom-btn--primary': tool === 'select' }"
                        @click="tool = 'select'"
                    >
                        <i class="fas fa-mouse-pointer"></i> Select
                    </button>
                    <button
                        class="largeButton btn btn-xs custom-btn--tertiary"
                        @click="clearCanvas"
                    >
                        <i class="fas fa-trash"></i> Clear
                    </button>
                    <div class="fsm-btn-group">
                        <button
                            class="largeButton btn btn-xs"
                            @click="performUndo"
                            :disabled="!fsmStore.canUndo"
                            title="Undo (Ctrl+Z)"
                        >
                            <i class="fas fa-undo"></i>
                        </button>
                        <button
                            class="largeButton btn btn-xs"
                            @click="performRedo"
                            :disabled="!fsmStore.canRedo"
                            title="Redo (Ctrl+Y)"
                        >
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>

                <div class="fsm-controls">
                    <label>Template:</label>
                    <select v-model="selectedTemplate" class="fsm-select" @change="loadSelectedTemplate">
                        <option value="">-- Select --</option>
                        <option v-for="t in fsmStore.getAvailableTemplates()" :key="t.id" :value="t.id">
                            {{ t.name }}
                        </option>
                    </select>

                    <label>FSM Type:</label>
                    <select v-model="fsmType" class="fsm-select">
                        <option value="MOORE">Moore</option>
                        <option value="MEALY">Mealy</option>
                        <option value="DFA">DFA</option>
                    </select>

                    <label>Encoding:</label>
                    <select v-model="encoding" class="fsm-select" @change="onEncodingChange">
                        <option value="BINARY">Binary</option>
                        <option value="GRAY">Gray Code</option>
                        <option value="ONE_HOT">One-Hot</option>
                    </select>

                    <div class="fsm-btn-group">
                        <button
                            class="largeButton btn btn-xs"
                            @click="downloadFSM"
                            :disabled="!fsmStore.currentFSM"
                            title="Save FSM to file"
                        >
                            <i class="fas fa-download"></i>
                        </button>
                        <button
                            class="largeButton btn btn-xs"
                            @click="triggerFileUpload"
                            title="Load FSM from file"
                        >
                            <i class="fas fa-upload"></i>
                        </button>
                    </div>
                    <input
                        ref="fileInput"
                        type="file"
                        accept=".json"
                        style="display: none"
                        @change="uploadFSM"
                    />
                </div>
            </div>
        </div>

        <!-- Canvas Area -->
        <div class="panel-body">
            <div class="fsm-canvas-container">
                <canvas
                    ref="fsmCanvas"
                    class="fsm-canvas"
                    @mousedown="onMouseDown"
                    @mousemove="onMouseMove"
                    @mouseup="onMouseUp"
                    @dblclick="onDoubleClick"
                ></canvas>
            </div>
        </div>

        <!-- Synthesis Actions -->
        <div class="panel-body">
            <div class="layout-body">
                <button
                    class="largeButton btn btn-xs custom-btn--primary"
                    @click="synthesizeCircuit"
                    :disabled="!canSynthesize"
                >
                    <i class="fas fa-microchip"></i> Synthesize Circuit
                </button>
                <button
                    class="largeButton btn btn-xs custom-btn--tertiary"
                    @click="exportVerilog"
                >
                    <i class="fas fa-file-code"></i> Export Verilog
                </button>
            </div>
        </div>

        <!-- Optimization Tools -->
        <div class="panel-body">
            <div class="fsm-controls">
                <button
                    class="largeButton btn btn-xs"
                    @click="minimizeStates"
                    :disabled="!canSynthesize"
                    title="Reduce equivalent states using Hopcroft's algorithm"
                >
                    <i class="fas fa-compress-arrows-alt"></i> Minimize
                </button>
                <button
                    class="largeButton btn btn-xs"
                    @click="triggerVerilogImport"
                    title="Import FSM from Verilog code"
                >
                    <i class="fas fa-file-import"></i> Import Verilog
                </button>
                <button
                    class="largeButton btn btn-xs"
                    @click="showMetrics = !showMetrics"
                    :disabled="!canSynthesize"
                >
                    <i class="fas fa-chart-bar"></i> Metrics
                </button>
                <input
                    ref="verilogInput"
                    type="file"
                    accept=".v,.sv"
                    style="display: none"
                    @change="importVerilogFSM"
                />
            </div>
        </div>

        <!-- Optimization Metrics Panel -->
        <div v-if="showMetrics && optimizationMetrics" class="panel-body metrics-panel">
            <div class="metrics-title">Synthesis Metrics</div>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Flip-Flops:</span>
                    <span class="metric-value">{{ optimizationMetrics.flipFlops }}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Est. Gates:</span>
                    <span class="metric-value">{{ optimizationMetrics.gateEstimate }}</span>
                </div>
                <div class="metric-item" v-if="optimizationMetrics.statesAfterMin < optimizationMetrics.statesBeforeMin">
                    <span class="metric-label">States Reduced:</span>
                    <span class="metric-value">{{ optimizationMetrics.statesBeforeMin }} → {{ optimizationMetrics.statesAfterMin }}</span>
                </div>
            </div>
        </div>

        <!-- Status Bar -->
        <div class="panel-body fsm-status">
            <div class="status-item">
                States: {{ fsmStore.currentFSM?.states.length || 0 }}
            </div>
            <div class="status-item">
                Transitions: {{ fsmStore.currentFSM?.transitions.length || 0 }}
            </div>
            <div v-if="validationMessage" class="status-message" :class="validationClass">
                {{ validationMessage }}
            </div>
        </div>
    </div>

    <!-- Properties Dialog -->
    <StatePropertiesDialog
        v-if="showStateDialog"
        :state="selectedStateData"
        @close="showStateDialog = false"
        @save="saveStateProperties"
    />

    <TransitionPropertiesDialog
        v-if="showTransitionDialog"
        :transition="selectedTransitionData"
        @close="showTransitionDialog = false"
        @save="saveTransitionProperties"
    />
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import PanelHeader from '../Shared/PanelHeader.vue'
import StatePropertiesDialog from './StatePropertiesDialog.vue'
import TransitionPropertiesDialog from './TransitionPropertiesDialog.vue'
import { useFSMStore } from '../../../store/fsmStore'
import type { FSMState, FSMTransition, FSMType, StateEncoding, FSMDefinition } from '../../../types/fsm'
import { validateFSM, FSMSynthesizer, generateVerilogFromFSM, getSynthesisSummary, generateCircuitVerseJSON, minimizeFSM, parseVerilogFSM } from '../../../simulator/src/fsm'
import { newCircuit } from '../../../simulator/src/circuit'
import { loadScope } from '../../../simulator/src/data/load'

const fsmStore = useFSMStore()

// Canvas setup
const fsmCanvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

// Tool state
const tool = ref<'state' | 'transition' | 'select'>('select')
const fsmType = ref<FSMType>('MOORE')
const encoding = ref<StateEncoding>('BINARY')

// Drawing state
const draggedState = ref<string | null>(null)
const transitionStart = ref<string | null>(null)
const mousePos = ref({ x: 0, y: 0 })

// Dialog state
const showStateDialog = ref(false)
const showTransitionDialog = ref(false)
const selectedStateData = ref<FSMState | null>(null)
const selectedTransitionData = ref<FSMTransition | null>(null)

// Validation
const validationMessage = ref('')
const validationClass = ref('')

// Template and file handling
const selectedTemplate = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const verilogInput = ref<HTMLInputElement | null>(null)

// Optimization metrics
const showMetrics = ref(false)
const optimizationMetrics = ref<{
    flipFlops: number
    gateEstimate: number
    statesBeforeMin: number
    statesAfterMin: number
} | null>(null)

const canSynthesize = computed(() => {
    return fsmStore.currentFSM && fsmStore.currentFSM.states.length > 0
})

onMounted(() => {
    if (fsmCanvas.value) {
        // Set canvas size - use full container width
        const container = fsmCanvas.value.parentElement
        if (container) {
            fsmCanvas.value.width = Math.max(500, container.clientWidth)
            fsmCanvas.value.height = 280
        }
        
        ctx = fsmCanvas.value.getContext('2d')
        
        // Initialize FSM if not exists
        if (!fsmStore.currentFSM) {
            fsmStore.createNewFSM('New FSM', fsmType.value)
        }
        
        // Initial draw
        drawCanvas()
    }
    
    // Add keyboard shortcuts for undo/redo
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle if FSM panel is visible
        const fsmPanel = document.getElementById('fsmEditorPanel')
        if (!fsmPanel || fsmPanel.style.display === 'none') return
        
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault()
            performUndo()
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault()
            performRedo()
        }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    // Cleanup on unmount
    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeyDown)
    })
})

// Watch for changes
watch(() => fsmStore.currentFSM, () => {
    drawCanvas()
}, { deep: true })

watch(fsmType, (newType) => {
    if (fsmStore.currentFSM) {
        fsmStore.currentFSM.type = newType
    }
})

function drawCanvas() {
    if (!ctx || !fsmCanvas.value) return
    
    const canvas = fsmCanvas.value
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid
    drawGrid()
    
    // Draw transitions first (so they appear behind states)
    if (fsmStore.currentFSM) {
        fsmStore.currentFSM.transitions.forEach(drawTransition)
        fsmStore.currentFSM.states.forEach(drawState)
    }
    
    // Draw temporary transition line
    if (transitionStart.value && tool.value === 'transition') {
        drawTemporaryTransition()
    }
}

function drawGrid() {
    if (!ctx || !fsmCanvas.value) return
    
    const canvas = fsmCanvas.value
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5
    
    const gridSize = 20
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
    }
}

function drawState(state: FSMState) {
    if (!ctx) return
    
    const x = state.position.x
    const y = state.position.y
    const radius = 30
    
    // Highlight if selected
    const isSelected = fsmStore.selectedStateId === state.id
    
    // Draw outer circle for initial state
    if (state.isInitial) {
        ctx.strokeStyle = '#4CAF50'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, radius + 5, 0, 2 * Math.PI)
        ctx.stroke()
    }
    
    // Draw main circle
    ctx.strokeStyle = isSelected ? '#2196F3' : '#333'
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.fillStyle = state.isFinal ? '#FFF3E0' : '#fff'
    
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    
    // Draw double circle for final state
    if (state.isFinal) {
        ctx.beginPath()
        ctx.arc(x, y, radius - 5, 0, 2 * Math.PI)
        ctx.stroke()
    }
    
    // Draw label
    ctx.fillStyle = '#333'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state.label, x, y)
    
    // Draw outputs for Moore machine
    if (fsmType.value === 'MOORE' && state.outputs) {
        const outputText = Object.entries(state.outputs)
            .map(([key, val]) => `${key}=${val}`)
            .join(',')
        if (outputText) {
            ctx.font = '10px Arial'
            ctx.fillText(outputText, x, y + radius + 15)
        }
    }
}

function drawTransition(transition: FSMTransition) {
    if (!ctx || !fsmStore.currentFSM) return
    
    const fromState = fsmStore.currentFSM.states.find(s => s.id === transition.from)
    const toState = fsmStore.currentFSM.states.find(s => s.id === transition.to)
    
    if (!fromState || !toState) return
    
    const x1 = fromState.position.x
    const y1 = fromState.position.y
    const x2 = toState.position.x
    const y2 = toState.position.y
    
    // Self-loop
    if (fromState.id === toState.id) {
        drawSelfLoop(fromState, transition)
        return
    }
    
    // Calculate arrow position
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const radius = 30
    const startX = x1 + radius * Math.cos(angle)
    const startY = y1 + radius * Math.sin(angle)
    const endX = x2 - radius * Math.cos(angle)
    const endY = y2 - radius * Math.sin(angle)
    
    // Draw arrow
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    
    // Draw arrowhead
    const headlen = 10
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(
        endX - headlen * Math.cos(angle - Math.PI / 6),
        endY - headlen * Math.sin(angle - Math.PI / 6)
    )
    ctx.moveTo(endX, endY)
    ctx.lineTo(
        endX - headlen * Math.cos(angle + Math.PI / 6),
        endY - headlen * Math.sin(angle + Math.PI / 6)
    )
    ctx.stroke()
    
    // Draw label
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const label = getTransitionLabel(transition)
    
    ctx.fillStyle = '#fff'
    ctx.fillRect(midX - 20, midY - 10, 40, 20)
    ctx.fillStyle = '#333'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, midX, midY)
}

function drawSelfLoop(state: FSMState, transition: FSMTransition) {
    if (!ctx) return
    
    const x = state.position.x
    const y = state.position.y
    const radius = 30
    const loopRadius = 25
    
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y - radius - loopRadius, loopRadius, 0, 2 * Math.PI)
    ctx.stroke()
    
    // Arrow
    ctx.beginPath()
    ctx.moveTo(x + 5, y - radius)
    ctx.lineTo(x + 10, y - radius - 5)
    ctx.lineTo(x, y - radius - 5)
    ctx.stroke()
    
    // Label
    const label = getTransitionLabel(transition)
    ctx.fillStyle = '#333'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y - radius - 2 * loopRadius - 5)
}

function drawTemporaryTransition() {
    if (!ctx || !fsmStore.currentFSM || !transitionStart.value) return
    
    const fromState = fsmStore.currentFSM.states.find(s => s.id === transitionStart.value)
    if (!fromState) return
    
    ctx.strokeStyle = '#999'
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(fromState.position.x, fromState.position.y)
    ctx.lineTo(mousePos.value.x, mousePos.value.y)
    ctx.stroke()
    ctx.setLineDash([])
}

function getTransitionLabel(transition: FSMTransition): string {
    const inputs = Object.entries(transition.inputs)
        .map(([key, val]) => `${key}=${val}`)
        .join(',')
    
    if (fsmType.value === 'MEALY' && transition.outputs) {
        const outputs = Object.entries(transition.outputs)
            .map(([key, val]) => `${key}=${val}`)
            .join(',')
        return `${inputs}/${outputs}`
    }
    
    return inputs
}

function onMouseDown(e: MouseEvent) {
    if (!fsmCanvas.value) return
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    mousePos.value = { x, y }
    
    const clickedState = findStateAt(x, y)
    
    if (tool.value === 'state') {
        // Add new state
        const id = fsmStore.addState({
            position: { x, y },
            label: `S${fsmStore.currentFSM?.states.length || 0}`
        })
        drawCanvas()
    } else if (tool.value === 'transition') {
        if (clickedState) {
            if (!transitionStart.value) {
                transitionStart.value = clickedState.id
            } else {
                // Complete transition
                fsmStore.addTransition({
                    from: transitionStart.value,
                    to: clickedState.id,
                    inputs: { X: 0 }
                })
                transitionStart.value = null
                drawCanvas()
            }
        }
    } else if (tool.value === 'select') {
        if (clickedState) {
            fsmStore.selectState(clickedState.id)
            draggedState.value = clickedState.id
        }
    }
}

function onMouseMove(e: MouseEvent) {
    if (!fsmCanvas.value) return
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    mousePos.value = { x, y }
    
    if (draggedState.value && tool.value === 'select') {
        fsmStore.updateState(draggedState.value, { position: { x, y } })
        drawCanvas()
    } else if (transitionStart.value) {
        drawCanvas()
    }
}

function onMouseUp() {
    draggedState.value = null
}

function onDoubleClick(e: MouseEvent) {
    if (!fsmCanvas.value) return
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const clickedState = findStateAt(x, y)
    
    if (clickedState) {
        selectedStateData.value = clickedState
        showStateDialog.value = true
    }
}

function findStateAt(x: number, y: number): FSMState | null {
    if (!fsmStore.currentFSM) return null
    
    for (const state of fsmStore.currentFSM.states) {
        const dx = x - state.position.x
        const dy = y - state.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist <= 30) {
            return state
        }
    }
    
    return null
}

function clearCanvas() {
    if (confirm('Clear all states and transitions?')) {
        fsmStore.clearFSM()
        fsmStore.createNewFSM('New FSM', fsmType.value)
        fsmStore.clearHistory()
        drawCanvas()
    }
}

// Undo/Redo handlers
function performUndo() {
    if (fsmStore.undo()) {
        validationMessage.value = '↩ Undo'
        validationClass.value = 'info'
        drawCanvas()
    }
}

function performRedo() {
    if (fsmStore.redo()) {
        validationMessage.value = '↪ Redo'
        validationClass.value = 'info'
        drawCanvas()
    }
}

function onEncodingChange() {
    fsmStore.setEncoding(encoding.value)
}

function loadSelectedTemplate() {
    if (!selectedTemplate.value) return
    fsmStore.loadTemplate(selectedTemplate.value)
    // Update local state to match loaded template
    if (fsmStore.currentFSM) {
        fsmType.value = fsmStore.currentFSM.type
        encoding.value = fsmStore.currentFSM.encoding
    }
    validationMessage.value = `✅ Loaded template: ${selectedTemplate.value}`
    validationClass.value = 'success'
    selectedTemplate.value = ''
    drawCanvas()
}

function downloadFSM() {
    const json = fsmStore.saveFSMToJSON()
    if (!json) return
    
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fsmStore.currentFSM?.name || 'fsm'}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    validationMessage.value = '✅ FSM saved to file'
    validationClass.value = 'success'
}

function triggerFileUpload() {
    fileInput.value?.click()
}

function uploadFSM(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
        const json = e.target?.result as string
        if (fsmStore.loadFSMFromJSON(json)) {
            if (fsmStore.currentFSM) {
                fsmType.value = fsmStore.currentFSM.type
                encoding.value = fsmStore.currentFSM.encoding
            }
            validationMessage.value = '✅ FSM loaded from file'
            validationClass.value = 'success'
            drawCanvas()
        } else {
            validationMessage.value = '❌ Failed to load FSM - invalid format'
            validationClass.value = 'error'
        }
    }
    reader.readAsText(file)
    input.value = ''  // Reset file input
}

// State minimization using Hopcroft's algorithm
function minimizeStates() {
    if (!fsmStore.currentFSM) return
    
    try {
        const result = minimizeFSM(fsmStore.currentFSM)
        
        if (result.statesReduced > 0) {
            // Update the FSM with minimized version
            fsmStore.currentFSM.states = result.minimizedFSM.states
            fsmStore.currentFSM.transitions = result.minimizedFSM.transitions
            fsmStore.currentFSM.initialState = result.minimizedFSM.initialState
            
            validationMessage.value = `✅ Reduced ${result.statesReduced} equivalent states (${result.originalStates} → ${result.minimizedStates})`
            validationClass.value = 'success'
            
            // Update metrics
            calculateMetrics()
            drawCanvas()
        } else {
            validationMessage.value = '✓ FSM is already minimal'
            validationClass.value = 'info'
        }
    } catch (error) {
        validationMessage.value = `❌ Minimization error: ${error}`
        validationClass.value = 'error'
    }
}

// Trigger Verilog file input
function triggerVerilogImport() {
    verilogInput.value?.click()
}

// Import FSM from Verilog file
function importVerilogFSM(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
        const verilogCode = e.target?.result as string
        const result = parseVerilogFSM(verilogCode)
        
        if (result.success && result.fsm) {
            // Load the imported FSM
            fsmStore.currentFSM = result.fsm
            fsmType.value = result.fsm.type
            encoding.value = result.fsm.encoding
            
            validationMessage.value = `✅ Imported FSM: ${result.fsm.states.length} states, ${result.fsm.transitions.length} transitions`
            validationClass.value = 'success'
            
            if (result.warnings.length > 0) {
                console.warn('Verilog import warnings:', result.warnings)
            }
            
            calculateMetrics()
            drawCanvas()
        } else {
            validationMessage.value = `❌ Import failed: ${result.error}`
            validationClass.value = 'error'
        }
    }
    reader.readAsText(file)
    input.value = ''  // Reset file input
}

// Calculate optimization metrics
function calculateMetrics() {
    if (!fsmStore.currentFSM) {
        optimizationMetrics.value = null
        return
    }
    
    const fsm = fsmStore.currentFSM
    const numStates = fsm.states.length
    const numBits = Math.ceil(Math.log2(Math.max(numStates, 2)))
    const numTransitions = fsm.transitions.length
    
    // Estimate gate count based on encoding
    let gateEstimate = 0
    if (fsm.encoding === 'ONE_HOT') {
        // One-hot: more flip-flops but simpler logic
        const flipFlops = numStates
        gateEstimate = numTransitions * 2  // Approximate gates per transition
        optimizationMetrics.value = {
            flipFlops,
            gateEstimate,
            statesBeforeMin: numStates,
            statesAfterMin: numStates
        }
    } else {
        // Binary/Gray: fewer flip-flops but more complex logic
        const flipFlops = numBits
        gateEstimate = numTransitions * numBits * 2  // Approximate gates
        optimizationMetrics.value = {
            flipFlops,
            gateEstimate,
            statesBeforeMin: numStates,
            statesAfterMin: numStates
        }
    }
}

function saveStateProperties(updates: Partial<FSMState>) {
    if (selectedStateData.value) {
        fsmStore.updateState(selectedStateData.value.id, updates)
        showStateDialog.value = false
        drawCanvas()
    }
}

function saveTransitionProperties(updates: Partial<FSMTransition>) {
    if (selectedTransitionData.value) {
        fsmStore.updateTransition(selectedTransitionData.value.id, updates)
        showTransitionDialog.value = false
        drawCanvas()
    }
}

function synthesizeCircuit() {
    if (!fsmStore.currentFSM) return
    
    try {
        // Validate FSM first
        const validation = validateFSM(fsmStore.currentFSM)
        
        if (!validation.isValid) {
            validationMessage.value = `Validation issues found: ${validation.completenessIssues.join(', ')}`
            validationClass.value = 'error'
            return
        }
        
        // Generate Circuit Data
        const projectData = generateCircuitVerseJSON(fsmStore.currentFSM) as any
        
        if (!projectData || !projectData.scopes || projectData.scopes.length === 0) {
            throw new Error('Failed to generate circuit data')
        }

        // Create new circuit tab
        const scopeName = projectData.scopes[0].name
        const scope = newCircuit(scopeName, undefined, false, false)
        
        if (!scope) {
             throw new Error('Failed to create new circuit scope')
        }

        // Load data into scope
        // We use projectData.scopes[0] because generateCircuitVerseJSON creates a single scope project
        loadScope(scope, projectData.scopes[0])

        // Get info for user
        const synthesizer = new FSMSynthesizer(fsmStore.currentFSM)
        synthesizer.synthesize() // Must call this to calculate FF count
        const ffCount = synthesizer.getFlipFlopCount()

        // Show success message
        validationMessage.value = `✅ Circuit created in tab "${scopeName}"! (${ffCount} FFs)`
        validationClass.value = 'success'
        
        // Log debug info
        console.log('=== FSM Synthesis Complete ===')
        console.log('Generated Circuit Scope:', scope)
            
    } catch (error) {
        validationMessage.value = `Error: ${error}`
        validationClass.value = 'error'
        console.error('Synthesis error:', error)
    }
}

function exportVerilog() {
    if (!fsmStore.currentFSM) return
    
    try {
        const verilog = generateVerilogFromFSM(fsmStore.currentFSM)
        
        // Log to console first
        console.log('=== Generated FSM Verilog Code ===')
        console.log(verilog)
        
        // Show in alert so user can see the code
        const showInAlert = confirm('Verilog code generated! View in console.\n\nDo you want to download the .v file?')
        
        if (showInAlert) {
            // Create downloadable file with timestamp
            const timestamp = Date.now()
            const blob = new Blob([verilog], { type: 'text/plain;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `fsm_${fsmStore.currentFSM.name.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.v`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, 100)
        }
        
        validationMessage.value = '✅ Verilog generated! Check console.'
        validationClass.value = 'success'
        
    } catch (error) {
        validationMessage.value = `Export error: ${error}`
        validationClass.value = 'error'
        console.error('Verilog export error:', error)
    }
}
</script>

<style scoped>
.fsm-editor-panel {
    display: none; /* Hidden by default, toggled by Tools menu */
    max-width: 100%;
    max-height: 600px;
    overflow-y: auto;
}

.fsm-toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

/* Ensure all toolbar buttons are always visible */
.fsm-toolbar button,
.fsm-editor-panel .largeButton {
    display: flex !important;
    align-items: center;
    gap: 6px;
    opacity: 1 !important;
    visibility: visible !important;
}

.fsm-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
    padding: 8px 0;
}

.fsm-controls label {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
}

.fsm-select {
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 12px;
    min-width: 80px;
}

/* Icon buttons for save/load */
.fsm-controls .btn-xs {
    padding: 4px 8px;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Button group to keep buttons together */
.fsm-btn-group {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.fsm-canvas-container {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    background: #fafafa;
}

.fsm-canvas {
    cursor: crosshair;
    display: block;
}

.fsm-status {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #666;
    border-top: 1px solid #eee;
    padding-top: 8px !important;
}

.status-item {
    font-weight: 500;
}

.status-message {
    margin-left: auto;
    padding: 4px 8px;
    border-radius: 4px;
}

.status-message.info {
    background: #e3f2fd;
    color: #1976d2;
}

.status-message.error {
    background: #ffebee;
    color: #c62828;
}

.status-message.success {
    background: #e8f5e9;
    color: #2e7d32;
}

/* Metrics Panel Styles */
.metrics-panel {
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px !important;
}

.metrics-title {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 8px;
    color: #333;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
}

.metric-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
    border: 1px solid #eee;
}

.metric-label {
    font-size: 12px;
    color: #666;
}

.metric-value {
    font-size: 12px;
    font-weight: 600;
    color: #1976d2;
}
</style>
