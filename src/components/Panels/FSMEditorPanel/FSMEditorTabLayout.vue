<template>
    <div id="fsm-editor-tab" class="fsm-editor-tab" style="display: none;">
        <!-- Left Sidebar -->
        <div class="fsm-sidebar">
            <div class="fsm-sidebar-header">
                <h3>FSM Editor</h3>
                <button class="btn-close-fsm" @click="exitFSMEditor" title="Exit FSM Editor">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Tools Section -->
            <div class="fsm-section">
                <h4>Tools</h4>
                <div class="fsm-tool-group">
                    <button 
                        :class="['fsm-tool-btn', { active: tool === 'select' }]" 
                        @click="setTool('select')"
                        title="Select (S)"
                    >
                        <i class="fas fa-mouse-pointer"></i> Select
                    </button>
                    <button 
                        :class="['fsm-tool-btn', { active: tool === 'state' }]" 
                        @click="setTool('state')"
                        title="Add State (A)"
                    >
                        <i class="fas fa-circle"></i> Add State
                    </button>
                    <button 
                        :class="['fsm-tool-btn', { active: tool === 'transition' }]" 
                        @click="setTool('transition')"
                        title="Add Transition (T)"
                    >
                        <i class="fas fa-long-arrow-alt-right"></i> Add Transition
                    </button>
                </div>
            </div>

            <!-- Edit Section -->
            <div class="fsm-section">
                <h4>Edit</h4>
                <div class="fsm-btn-row">
                    <button class="fsm-action-btn" @click="clearCanvas" title="Clear All">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                    <button 
                        class="fsm-action-btn" 
                        @click="performUndo" 
                        :disabled="!fsmStore.canUndo"
                        title="Undo (Ctrl+Z)"
                    >
                        <i class="fas fa-undo"></i> Undo
                    </button>
                    <button 
                        class="fsm-action-btn" 
                        @click="performRedo" 
                        :disabled="!fsmStore.canRedo"
                        title="Redo (Ctrl+Y)"
                    >
                        <i class="fas fa-redo"></i> Redo
                    </button>
                </div>
            </div>

            <!-- Configuration Section -->
            <div class="fsm-section">
                <h4>Configuration</h4>
                <div class="fsm-field">
                    <label>Type:</label>
                    <select v-model="fsmType" class="fsm-select">
                        <option value="MOORE">Moore</option>
                        <option value="MEALY">Mealy</option>
                    </select>
                </div>
                <div class="fsm-field">
                    <label>Encoding:</label>
                    <select v-model="encoding" class="fsm-select">
                        <option value="BINARY">Binary</option>
                        <option value="GRAY">Gray Code</option>
                        <option value="ONE_HOT">One-Hot</option>
                    </select>
                </div>
                <div class="fsm-field">
                    <label>Template:</label>
                    <select v-model="selectedTemplate" @change="loadTemplateHandler" class="fsm-select">
                        <option value="">-- Select --</option>
                        <option value="sequence_detector">Sequence Detector (101)</option>
                        <option value="traffic_light">Traffic Light Controller</option>
                        <option value="counter_2bit">2-Bit Counter</option>
                    </select>
                </div>
            </div>

            <!-- Actions Section -->
            <div class="fsm-section">
                <h4>Actions</h4>
                <div class="fsm-action-group">
                    <button 
                        class="fsm-primary-btn" 
                        @click="synthesizeCircuit"
                        :disabled="!canSynthesize"
                    >
                        <i class="fas fa-microchip"></i> Synthesize Circuit
                    </button>
                    <button class="fsm-secondary-btn" @click="exportVerilog">
                        <i class="fas fa-code"></i> Export Verilog
                    </button>
                </div>
            </div>

            <!-- Optimization Section -->
            <div class="fsm-section">
                <h4>Optimization</h4>
                <div class="fsm-action-group">
                    <button class="fsm-action-btn" @click="minimizeStates">
                        <i class="fas fa-compress-arrows-alt"></i> Minimize
                    </button>
                    <button class="fsm-action-btn" @click="toggleMetrics">
                        <i class="fas fa-chart-bar"></i> Metrics
                    </button>
                </div>
            </div>

            <!-- Import/Export Section -->
            <div class="fsm-section">
                <h4>Import / Export</h4>
                <div class="fsm-action-group">
                    <button class="fsm-action-btn" @click="triggerVerilogImport">
                        <i class="fas fa-file-import"></i> Import Verilog
                    </button>
                    <button class="fsm-action-btn" @click="saveFSM">
                        <i class="fas fa-save"></i> Save FSM
                    </button>
                    <button class="fsm-action-btn" @click="triggerLoadFSM">
                        <i class="fas fa-folder-open"></i> Load FSM
                    </button>
                </div>
                <input 
                    ref="fileInput" 
                    type="file" 
                    accept=".json" 
                    style="display: none" 
                    @change="loadFSM"
                />
                <input 
                    ref="verilogInput" 
                    type="file" 
                    accept=".v,.sv" 
                    style="display: none" 
                    @change="importVerilogFSM"
                />
            </div>

            <!-- Metrics Panel -->
            <div v-if="showMetrics && optimizationMetrics" class="fsm-metrics-panel">
                <h4>Metrics</h4>
                <div class="fsm-metric">
                    <span>Flip-Flops:</span>
                    <strong>{{ optimizationMetrics.flipFlops }}</strong>
                </div>
                <div class="fsm-metric">
                    <span>Est. Gates:</span>
                    <strong>{{ optimizationMetrics.gateEstimate }}</strong>
                </div>
                <div v-if="optimizationMetrics.statesBeforeMin > optimizationMetrics.statesAfterMin" class="fsm-metric">
                    <span>States Reduced:</span>
                    <strong>{{ optimizationMetrics.statesBeforeMin }} → {{ optimizationMetrics.statesAfterMin }}</strong>
                </div>
            </div>

            <!-- K-Map Visualization Section -->
            <div class="fsm-section">
                <h4>K-MAP VISUALIZATION</h4>
                <button 
                    class="fsm-action-btn"
                    @click="generateKMaps"
                    :disabled="!fsmStore.currentFSM || fsmStore.currentFSM.states.length === 0"
                >
                    <span>📊</span> Generate K-Maps
                </button>
                
                <div v-if="showKMaps && kmapData.length > 0" class="kmap-container">
                    <div v-for="(kmap, idx) in kmapData" :key="idx" class="kmap-card">
                        <div class="kmap-title">{{ kmap.variable }}</div>
                        <div class="kmap-grid" :style="getKmapGridStyle(kmap.variables)">
                            <!-- K-map header row -->
                            <div class="kmap-header-cell"></div>
                            <div 
                                v-for="(col, colIdx) in kmap.colHeaders" 
                                :key="'col-'+colIdx" 
                                class="kmap-header-cell"
                            >{{ col }}</div>
                            
                            <!-- K-map data rows -->
                            <template v-for="(row, rowIdx) in kmap.rows" :key="'row-'+rowIdx">
                                <div class="kmap-header-cell">{{ kmap.rowHeaders[rowIdx] }}</div>
                                <div 
                                    v-for="(cell, cellIdx) in row" 
                                    :key="'cell-'+rowIdx+'-'+cellIdx"
                                    :class="['kmap-cell', cell.grouped ? 'kmap-grouped' : '']"
                                >{{ cell.value }}</div>
                            </template>
                        </div>
                        <div class="kmap-expression">
                            <strong>{{ kmap.variable }} = </strong>{{ kmap.minimizedExpr || '0' }}
                        </div>
                    </div>
                </div>
                <div v-else-if="showKMaps && kmapData.length === 0" class="kmap-empty">
                    No outputs to visualize
                </div>
            </div>

            <!-- Status Bar -->
            <div class="fsm-status">
                <div :class="['fsm-status-msg', validationClass]">{{ validationMessage }}</div>
                <div class="fsm-status-info">
                    States: {{ fsmStore.currentFSM?.states?.length || 0 }} | 
                    Transitions: {{ fsmStore.currentFSM?.transitions?.length || 0 }}
                </div>
            </div>
        </div>

        <!-- Canvas Area -->
        <div class="fsm-canvas-container">
            <canvas 
                ref="fsmCanvas" 
                class="fsm-canvas"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @dblclick="handleDoubleClick"
            ></canvas>
        </div>

        <!-- State Properties Dialog -->
        <StatePropertiesDialog
            v-if="showStateDialog && selectedStateData"
            :state="selectedStateData"
            :fsm-type="fsmType"
            :outputs="fsmStore.currentFSM?.outputs || []"
            @save="saveStateProperties"
            @delete="deleteState"
            @close="showStateDialog = false"
        />

        <!-- Transition Properties Dialog -->
        <TransitionPropertiesDialog
            v-if="showTransitionDialog && selectedTransitionData"
            :transition="selectedTransitionData"
            :fsm-type="fsmType"
            :inputs="fsmStore.currentFSM?.inputs || []"
            :outputs="fsmStore.currentFSM?.outputs || []"
            :states="fsmStore.currentFSM?.states || []"
            @save="saveTransitionProperties"
            @delete="deleteTransition"
            @close="showTransitionDialog = false"
        />
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import StatePropertiesDialog from './StatePropertiesDialog.vue'
import TransitionPropertiesDialog from './TransitionPropertiesDialog.vue'
import { useFSMStore } from '../../../store/fsmStore'
import type { FSMState, FSMTransition, FSMType, StateEncoding } from '../../../types/fsm'
import { validateFSM, FSMSynthesizer, generateVerilogFromFSM, generateCircuitVerseJSON, minimizeFSM, parseVerilogFSM } from '../../../simulator/src/fsm'
import { newCircuit } from '../../../simulator/src/circuit'
import { loadScope } from '../../../simulator/src/data/load'
import { fsmModeSet, exitFSMMode, storeFSMScopeId } from '../../../simulator/src/fsmMode'
import { useSimulatorMobileStore } from '../../../store/simulatorMobileStore'

const fsmStore = useFSMStore()
const simulatorMobileStore = useSimulatorMobileStore()

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
const validationMessage = ref('Ready')
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

// K-map visualization state
interface KMapCell {
    value: number | string
    grouped: boolean
}
interface KMapData {
    variable: string
    variables: number
    colHeaders: string[]
    rowHeaders: string[]
    rows: KMapCell[][]
    minimizedExpr: string
}
const showKMaps = ref(false)
const kmapData = ref<KMapData[]>([])

const canSynthesize = computed(() => {
    return fsmStore.currentFSM && fsmStore.currentFSM.states.length > 0
})

onMounted(() => {
    // Initial setup - may be hidden, so we defer canvas init
    initializeIfVisible()
    
    // Watch for the tab becoming visible using MutationObserver
    const fsmTab = document.getElementById('fsm-editor-tab')
    if (fsmTab) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const display = (mutation.target as HTMLElement).style.display
                    if (display !== 'none') {
                        // Tab became visible - reinitialize canvas
                        setTimeout(() => {
                            initializeIfVisible()
                        }, 100)
                    }
                }
            }
        })
        observer.observe(fsmTab, { attributes: true, attributeFilter: ['style'] })
        
        onUnmounted(() => {
            observer.disconnect()
        })
    }
    
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        const tab = document.getElementById('fsm-editor-tab')
        if (!tab || tab.style.display === 'none') return
        
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault()
            performUndo()
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault()
            performRedo()
        } else if (e.key === 's' && !e.ctrlKey) {
            setTool('select')
        } else if (e.key === 'a' && !e.ctrlKey) {
            setTool('state')
        } else if (e.key === 't' && !e.ctrlKey) {
            setTool('transition')
        }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeyDown)
    })
    
    // Handle resize
    const handleResize = () => {
        initializeIfVisible()
    }
    
    window.addEventListener('resize', handleResize)
    onUnmounted(() => {
        window.removeEventListener('resize', handleResize)
    })
})

// Initialize canvas and FSM when tab is visible (with retry)
function initializeIfVisible(retryCount = 0) {
    console.log(`initializeIfVisible called (retry: ${retryCount})`)
    
    if (!fsmCanvas.value) {
        console.log('No canvas ref yet')
        return
    }
    
    const container = fsmCanvas.value.parentElement
    if (!container) {
        console.log('No container')
        return
    }
    
    // Get computed dimensions
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    console.log(`Container dimensions: ${width}x${height}`)
    
    if (width <= 0 || height <= 0) {
        // Retry with increasing delay
        if (retryCount < 10) {
            const delay = 100 + retryCount * 100
            console.log(`FSM Canvas container has no dimensions, retrying in ${delay}ms...`)
            setTimeout(() => initializeIfVisible(retryCount + 1), delay)
        } else {
            console.error('FSM Canvas container never got dimensions after 10 retries')
        }
        return
    }
    
    // Set canvas dimensions
    fsmCanvas.value.width = Math.floor(width)
    fsmCanvas.value.height = Math.floor(height)
    ctx = fsmCanvas.value.getContext('2d')
    
    console.log(`FSM Canvas initialized: ${fsmCanvas.value.width}x${fsmCanvas.value.height}`)
    
    // Create new FSM if not exist
    if (!fsmStore.currentFSM) {
        fsmStore.createNewFSM('New FSM', fsmType.value)
        console.log('Created new FSM:', fsmStore.currentFSM)
    }
    
    drawCanvas()
}

watch(() => fsmStore.currentFSM, () => {
    drawCanvas()
}, { deep: true })

watch(fsmType, (newType) => {
    if (fsmStore.currentFSM) {
        fsmStore.currentFSM.type = newType
    }
})

watch(encoding, (newEncoding) => {
    if (fsmStore.currentFSM) {
        fsmStore.currentFSM.encoding = newEncoding
    }
})

function setTool(newTool: 'state' | 'transition' | 'select') {
    tool.value = newTool
    transitionStart.value = null
}

function exitFSMEditor() {
    exitFSMMode()
    simulatorMobileStore.isFSM = false
}

function drawCanvas() {
    console.log('drawCanvas called, ctx exists:', !!ctx, 'canvas:', !!fsmCanvas.value)
    
    if (!ctx || !fsmCanvas.value) {
        console.log('Cannot draw - ctx or canvas missing')
        return
    }
    
    const canvas = fsmCanvas.value
    console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`)
    
    if (canvas.width <= 0 || canvas.height <= 0) {
        console.log('Canvas has no dimensions, reinitializing...')
        initializeIfVisible()
        return
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
    }
    
    if (!fsmStore.currentFSM) {
        console.log('No FSM to draw')
        return
    }
    
    console.log(`Drawing FSM: ${fsmStore.currentFSM.states.length} states, ${fsmStore.currentFSM.transitions.length} transitions`)
    
    // Draw transitions
    for (const transition of fsmStore.currentFSM.transitions) {
        drawTransition(transition)
    }
    
    // Draw states
    for (const state of fsmStore.currentFSM.states) {
        console.log(`Drawing state ${state.id} at (${state.position.x}, ${state.position.y})`)
        drawState(state)
    }
    
    // Draw in-progress transition
    if (transitionStart.value && tool.value === 'transition') {
        const startState = fsmStore.currentFSM.states.find(s => s.id === transitionStart.value)
        if (startState) {
            ctx.strokeStyle = '#2196F3'
            ctx.lineWidth = 2
            ctx.setLineDash([5, 5])
            ctx.beginPath()
            ctx.moveTo(startState.position.x, startState.position.y)
            ctx.lineTo(mousePos.value.x, mousePos.value.y)
            ctx.stroke()
            ctx.setLineDash([])
        }
    }
}

// Color palette for different state types
interface StateColorScheme {
    fill: string
    highlight: string
    border: string
    text: string
}

// Get state color based on outputs - supports traffic light visualization
function getStateColor(state: FSMState): StateColorScheme {
    const outputs = state.outputs || {}
    
    // Traffic Light: Check for G (Green), Y (Yellow), R (Red) outputs
    const isGreen = outputs['G'] === 1 || outputs['g'] === 1
    const isYellow = outputs['Y'] === 1 || outputs['y'] === 1
    const isRed = outputs['R'] === 1 || outputs['r'] === 1
    
    // Priority: Red > Yellow > Green (safety first!)
    if (isRed && isYellow) {
        // Red + Yellow = Amber/Orange transition state
        return {
            fill: '#FF6F00',
            highlight: '#FFB300',
            border: '#E65100',
            text: '#FFFFFF'
        }
    }
    if (isRed) {
        return {
            fill: '#D32F2F',      // Material Red 700
            highlight: '#EF5350', // Material Red 400
            border: '#B71C1C',    // Material Red 900
            text: '#FFFFFF'
        }
    }
    if (isYellow) {
        return {
            fill: '#FBC02D',      // Material Yellow 700
            highlight: '#FFEE58', // Material Yellow 400
            border: '#F57F17',    // Material Yellow 900
            text: '#212121'       // Dark text for contrast
        }
    }
    if (isGreen) {
        return {
            fill: '#388E3C',      // Material Green 700
            highlight: '#66BB6A', // Material Green 400
            border: '#1B5E20',    // Material Green 900
            text: '#FFFFFF'
        }
    }
    
    // Default: Initial state is green accent, others are blue
    if (state.isInitial) {
        return {
            fill: '#4CAF50',      // Material Green 500
            highlight: '#81C784', // Material Green 300
            border: '#2E7D32',    // Material Green 800
            text: '#FFFFFF'
        }
    }
    
    // Standard state color (blue)
    return {
        fill: '#1976D2',          // Material Blue 700
        highlight: '#42A5F5',     // Material Blue 400
        border: '#0D47A1',        // Material Blue 900
        text: '#FFFFFF'
    }
}

function drawState(state: FSMState) {
    if (!ctx) return
    
    const { x, y } = state.position
    const radius = 30
    
    // Determine state color based on outputs (for traffic light visualization)
    const stateColor = getStateColor(state)
    const borderColor = fsmStore.selectedStateId === state.id ? '#FF9800' : stateColor.border
    
    // Draw circle with gradient for polished look
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    
    // Create radial gradient for 3D effect
    const gradient = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, radius)
    gradient.addColorStop(0, stateColor.highlight)
    gradient.addColorStop(1, stateColor.fill)
    ctx.fillStyle = gradient
    ctx.fill()
    
    // Draw border
    ctx.strokeStyle = borderColor
    ctx.lineWidth = fsmStore.selectedStateId === state.id ? 3 : 2
    ctx.stroke()
    
    // Draw label with shadow for visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 2
    ctx.fillStyle = stateColor.text
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state.label || state.id, x, y)
    ctx.shadowBlur = 0
    
    // Draw initial arrow
    if (state.isInitial) {
        ctx.strokeStyle = '#4CAF50'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - radius - 30, y)
        ctx.lineTo(x - radius - 5, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - radius - 5, y)
        ctx.lineTo(x - radius - 12, y - 5)
        ctx.lineTo(x - radius - 12, y + 5)
        ctx.closePath()
        ctx.fillStyle = '#4CAF50'
        ctx.fill()
    }
}

function drawTransition(transition: FSMTransition) {
    if (!ctx || !fsmStore.currentFSM) return
    
    const fromState = fsmStore.currentFSM.states.find(s => s.id === transition.from)
    const toState = fsmStore.currentFSM.states.find(s => s.id === transition.to)
    
    if (!fromState || !toState) return
    
    const isSelected = fsmStore.selectedTransitionId === transition.id
    ctx.strokeStyle = isSelected ? '#FF9800' : '#333'
    ctx.lineWidth = isSelected ? 3 : 2
    
    if (transition.from === transition.to) {
        // Self-loop
        const x = fromState.position.x
        const y = fromState.position.y - 30
        ctx.beginPath()
        ctx.arc(x, y - 20, 20, 0.5 * Math.PI, 2.5 * Math.PI)
        ctx.stroke()
        
        // Label
        ctx.fillStyle = '#333'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(transition.label || `${Object.keys(transition.inputs).join(',')}`, x, y - 45)
    } else {
        // Normal transition
        const dx = toState.position.x - fromState.position.x
        const dy = toState.position.y - fromState.position.y
        const angle = Math.atan2(dy, dx)
        const radius = 30
        
        const startX = fromState.position.x + radius * Math.cos(angle)
        const startY = fromState.position.y + radius * Math.sin(angle)
        const endX = toState.position.x - radius * Math.cos(angle)
        const endY = toState.position.y - radius * Math.sin(angle)
        
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
        
        // Arrow head
        const arrowSize = 10
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 6),
            endY - arrowSize * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 6),
            endY - arrowSize * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = isSelected ? '#FF9800' : '#333'
        ctx.fill()
        
        // Label
        const midX = (startX + endX) / 2
        const midY = (startY + endY) / 2
        ctx.fillStyle = '#333'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(transition.label || Object.keys(transition.inputs).join(','), midX, midY - 10)
    }
}

function handleMouseDown(e: MouseEvent) {
    console.log('handleMouseDown called, tool:', tool.value)
    
    if (!fsmCanvas.value) {
        console.log('No canvas reference')
        return
    }
    
    // Ensure FSM exists
    if (!fsmStore.currentFSM) {
        console.log('Creating FSM on first click')
        fsmStore.createNewFSM('New FSM', fsmType.value)
    }
    
    if (!fsmStore.currentFSM) {
        console.error('Failed to create FSM')
        return
    }
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    console.log(`Click at: ${x}, ${y}`)
    mousePos.value = { x, y }
    
    // Find clicked state
    const clickedState = findStateAt(x, y)
    
    if (tool.value === 'select') {
        if (clickedState) {
            fsmStore.selectState(clickedState.id)
            draggedState.value = clickedState.id
        } else {
            fsmStore.selectState('')
        }
    } else if (tool.value === 'state') {
        // Add new state
        const stateId = `S${fsmStore.currentFSM.states.length}`
        console.log(`Adding state ${stateId} at (${x}, ${y})`)
        fsmStore.addState({
            id: stateId,
            label: stateId,
            isInitial: fsmStore.currentFSM.states.length === 0,
            position: { x, y },
            outputs: {}
        })
        console.log(`States after add: ${fsmStore.currentFSM.states.length}`, fsmStore.currentFSM.states)
    } else if (tool.value === 'transition') {
        if (clickedState) {
            if (!transitionStart.value) {
                transitionStart.value = clickedState.id
                console.log('Started transition from:', clickedState.id)
            } else {
                // Create transition with auto-incrementing input value
                const transitionId = `T${fsmStore.currentFSM.transitions.length}`
                const inputValue = fsmStore.currentFSM.transitions.length
                console.log(`Creating transition ${transitionId}`)
                fsmStore.addTransition({
                    id: transitionId,
                    from: transitionStart.value,
                    to: clickedState.id,
                    inputs: { X: inputValue },
                    outputs: {},
                    label: `X=${inputValue}`
                })
                transitionStart.value = null
            }
        }
    }
    
    console.log('Calling drawCanvas after click')
    drawCanvas()
}

function handleMouseMove(e: MouseEvent) {
    if (!fsmCanvas.value) return
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    mousePos.value = { x, y }
    
    if (draggedState.value && fsmStore.currentFSM) {
        const state = fsmStore.currentFSM.states.find(s => s.id === draggedState.value)
        if (state) {
            fsmStore.updateState(draggedState.value, { position: { x, y } })
        }
    }
    
    if (transitionStart.value) {
        drawCanvas()
    }
}

function handleMouseUp() {
    draggedState.value = null
}

function handleDoubleClick(e: MouseEvent) {
    if (!fsmCanvas.value || !fsmStore.currentFSM) return
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const clickedState = findStateAt(x, y)
    if (clickedState) {
        selectedStateData.value = { ...clickedState }
        showStateDialog.value = true
        return
    }
    
    const clickedTransition = findTransitionAt(x, y)
    if (clickedTransition) {
        selectedTransitionData.value = { ...clickedTransition }
        showTransitionDialog.value = true
    }
}

function findStateAt(x: number, y: number): FSMState | null {
    if (!fsmStore.currentFSM) return null
    
    for (const state of fsmStore.currentFSM.states) {
        const dx = x - state.position.x
        const dy = y - state.position.y
        if (Math.sqrt(dx * dx + dy * dy) <= 30) {
            return state
        }
    }
    return null
}

function findTransitionAt(x: number, y: number): FSMTransition | null {
    if (!fsmStore.currentFSM) return null
    
    for (const transition of fsmStore.currentFSM.transitions) {
        const fromState = fsmStore.currentFSM.states.find(s => s.id === transition.from)
        const toState = fsmStore.currentFSM.states.find(s => s.id === transition.to)
        
        if (fromState && toState) {
            const midX = (fromState.position.x + toState.position.x) / 2
            const midY = (fromState.position.y + toState.position.y) / 2
            const dx = x - midX
            const dy = y - midY
            if (Math.sqrt(dx * dx + dy * dy) <= 20) {
                return transition
            }
        }
    }
    return null
}

function clearCanvas() {
    if (confirm('Clear all states and transitions?')) {
        fsmStore.createNewFSM('New FSM', fsmType.value)
        fsmStore.clearHistory()
        drawCanvas()
    }
}

function performUndo() {
    if (fsmStore.undo()) {
        drawCanvas()
    }
}

function performRedo() {
    if (fsmStore.redo()) {
        drawCanvas()
    }
}

function saveStateProperties(updates: Partial<FSMState>) {
    if (selectedStateData.value) {
        fsmStore.updateState(selectedStateData.value.id, updates)
        showStateDialog.value = false
        drawCanvas()
    }
}

function deleteState() {
    if (selectedStateData.value) {
        fsmStore.removeState(selectedStateData.value.id)
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

function deleteTransition() {
    if (selectedTransitionData.value) {
        fsmStore.removeTransition(selectedTransitionData.value.id)
        showTransitionDialog.value = false
        drawCanvas()
    }
}

function loadTemplateHandler() {
    console.log('loadTemplateHandler called, selectedTemplate:', selectedTemplate.value)
    if (!selectedTemplate.value) return
    
    fsmStore.loadTemplate(selectedTemplate.value)
    console.log('Template loaded, FSM:', fsmStore.currentFSM)
    drawCanvas()
    selectedTemplate.value = ''
}

function synthesizeCircuit() {
    console.log('synthesizeCircuit called')
    console.log('Current FSM:', fsmStore.currentFSM)
    
    if (!fsmStore.currentFSM) {
        console.error('No FSM to synthesize')
        validationMessage.value = 'No FSM to synthesize'
        validationClass.value = 'error'
        return
    }
    
    console.log('FSM states:', fsmStore.currentFSM.states.length)
    console.log('FSM transitions:', fsmStore.currentFSM.transitions.length)
    
    try {
        console.log('Validating FSM...')
        const validation = validateFSM(fsmStore.currentFSM)
        console.log('Validation result:', validation)
        
        if (!validation.isValid) {
            console.warn('Validation failed:', validation.completenessIssues)
            validationMessage.value = `Validation: ${validation.completenessIssues.join(', ')}`
            validationClass.value = 'error'
            return
        }
        
        console.log('Generating circuit JSON...')
        const projectData = generateCircuitVerseJSON(fsmStore.currentFSM) as any
        console.log('Generated project data:', projectData)
        
        if (!projectData || !projectData.scopes || projectData.scopes.length === 0) {
            throw new Error('Failed to generate circuit data')
        }

        const scopeName = projectData.scopes[0].name
        console.log('Creating new circuit scope:', scopeName)
        const scope = newCircuit(scopeName, undefined, false, false)
        console.log('New scope created:', scope)
        
        if (!scope) {
            throw new Error('Failed to create new circuit scope')
        }

        console.log('Loading scope data...')
        loadScope(scope, projectData.scopes[0])

        console.log('Running FSM synthesizer...')
        const synthesizer = new FSMSynthesizer(fsmStore.currentFSM)
        synthesizer.synthesize()
        const ffCount = synthesizer.getFlipFlopCount()
        console.log('Synthesis complete, flip-flops:', ffCount)

        validationMessage.value = `✅ Circuit created in "${scopeName}"! (${ffCount} FFs)`
        validationClass.value = 'success'
        
        // Store FSM scope ID and exit FSM mode to show circuit
        console.log('Storing FSM scope and exiting FSM mode...')
        storeFSMScopeId()
        exitFSMMode()
        simulatorMobileStore.isFSM = false
        console.log('Synthesis workflow complete')
            
    } catch (error) {
        console.error('Synthesis error:', error)
        validationMessage.value = `Error: ${error}`
        validationClass.value = 'error'
    }
}

// K-map visualization functions
function generateKMaps() {
    console.log('Generating K-maps...')
    if (!fsmStore.currentFSM || fsmStore.currentFSM.states.length === 0) {
        validationMessage.value = 'No FSM states to generate K-maps'
        validationClass.value = 'error'
        return
    }
    
    const fsm = fsmStore.currentFSM
    const numStates = fsm.states.length
    const numFFs = Math.ceil(Math.log2(numStates)) || 1
    
    // Generate K-maps for next-state logic
    const maps: KMapData[] = []
    
    for (let ff = 0; ff < numFFs; ff++) {
        const varName = numFFs === 1 ? 'Q+' : `Q${ff}+`
        const kmap = generateSingleKMap(fsm, ff, numFFs, varName)
        maps.push(kmap)
    }
    
    // Generate K-map for output if Moore FSM
    if (fsm.type === 'MOORE' && fsm.outputs && fsm.outputs.length > 0) {
        for (const output of fsm.outputs) {
            const outKmap = generateOutputKMap(fsm, output, numFFs)
            maps.push(outKmap)
        }
    }
    
    kmapData.value = maps
    showKMaps.value = true
    validationMessage.value = `Generated ${maps.length} K-map(s)`
    validationClass.value = 'success'
    console.log('K-maps generated:', maps)
}

function generateSingleKMap(fsm: any, ffIndex: number, numFFs: number, varName: string): KMapData {
    // For small FSMs, create 2-variable or 4-variable K-map
    const numVars = numFFs + (fsm.inputs?.length || 1)
    const inputVars = fsm.inputs?.length || 1
    
    // Determine K-map size based on total variables
    let rows = 2
    let cols = 2
    let rowVars = 1
    let colVars = 1
    
    if (numVars >= 4) {
        rows = 4
        cols = 4
        rowVars = 2
        colVars = 2
    } else if (numVars === 3) {
        rows = 2
        cols = 4
        rowVars = 1
        colVars = 2
    } else if (numVars === 2) {
        rows = 2
        cols = 2
        rowVars = 1
        colVars = 1
    }
    
    // Gray code ordering
    const grayCode2 = ['0', '1']
    const grayCode4 = ['00', '01', '11', '10']
    
    const rowHeaders = rowVars === 2 ? grayCode4.slice(0, rows) : grayCode2.slice(0, rows)
    const colHeaders = colVars === 2 ? grayCode4.slice(0, cols) : grayCode2.slice(0, cols)
    
    // Fill K-map with values based on state transitions
    const kmapRows: KMapCell[][] = []
    for (let r = 0; r < rows; r++) {
        const row: KMapCell[] = []
        for (let c = 0; c < cols; c++) {
            // Compute next state value for this combination
            const stateCode = rowHeaders[r]
            const inputCode = colHeaders[c]
            const nextVal = computeNextFFValue(fsm, stateCode, inputCode, ffIndex, numFFs)
            row.push({ value: nextVal, grouped: nextVal === 1 })
        }
        kmapRows.push(row)
    }
    
    // Generate minimized expression
    const expr = minimizeFromKmap(kmapRows, rowHeaders, colHeaders, numFFs, inputVars)
    
    return {
        variable: varName,
        variables: numVars,
        colHeaders: colHeaders.map(h => 'X=' + h),
        rowHeaders: rowHeaders.map(h => 'Q=' + h),
        rows: kmapRows,
        minimizedExpr: expr
    }
}

function generateOutputKMap(fsm: any, outputName: string, numFFs: number): KMapData {
    const rows = numFFs >= 2 ? 4 : 2
    const cols = 2
    
    const grayCode2 = ['0', '1']
    const grayCode4 = ['00', '01', '11', '10']
    
    const rowHeaders = numFFs >= 2 ? grayCode4.slice(0, rows) : grayCode2.slice(0, rows)
    const colHeaders = grayCode2
    
    const kmapRows: KMapCell[][] = []
    for (let r = 0; r < rows; r++) {
        const row: KMapCell[] = []
        for (let c = 0; c < cols; c++) {
            const stateIdx = parseInt(rowHeaders[r], 2)
            const state = fsm.states[stateIdx]
            const val = state?.outputs?.[outputName] || 0
            row.push({ value: val, grouped: val === 1 })
        }
        kmapRows.push(row)
    }
    
    return {
        variable: outputName,
        variables: numFFs,
        colHeaders: colHeaders.map(h => h),
        rowHeaders: rowHeaders,
        rows: kmapRows,
        minimizedExpr: ''
    }
}

function computeNextFFValue(fsm: any, stateCode: string, inputCode: string, ffIndex: number, numFFs: number): number {
    // Find current state based on encoding
    const stateIdx = parseInt(stateCode.padStart(numFFs, '0'), 2)
    const state = fsm.states[stateIdx]
    if (!state) return 0
    
    // Find transition for this input
    const inputVal = parseInt(inputCode[0] || '0', 2)
    const transition = fsm.transitions.find((t: any) => {
        if (t.from !== state.id) return false
        const transInput = Object.values(t.inputs)[0]
        return transInput === inputVal || transInput === inputCode[0]
    })
    
    if (!transition) return 0
    
    // Get next state index
    const nextState = fsm.states.find((s: any) => s.id === transition.to)
    if (!nextState) return 0
    
    const nextIdx = fsm.states.indexOf(nextState)
    const nextBinary = nextIdx.toString(2).padStart(numFFs, '0')
    
    return parseInt(nextBinary[numFFs - ffIndex - 1] || '0', 2)
}

function minimizeFromKmap(rows: KMapCell[][], rowHeaders: string[], colHeaders: string[], numFFs: number, inputVars: number): string {
    // Simple minimization - find product terms for 1s
    const terms: string[] = []
    
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            if (rows[r][c].value === 1) {
                let term = ''
                if (numFFs >= 1) {
                    term += rowHeaders[r][0] === '1' ? 'Q' : "Q'"
                }
                if (numFFs >= 2 && rowHeaders[r].length > 1) {
                    term += rowHeaders[r][1] === '1' ? 'Q0' : "Q0'"
                }
                term += colHeaders[c][0] === '1' ? 'X' : "X'"
                terms.push(term)
            }
        }
    }
    
    return terms.length > 0 ? terms.join(' + ') : '0'
}

function getKmapGridStyle(numVars: number): Record<string, string> {
    const cols = numVars >= 3 ? 5 : 3  // +1 for header column
    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '1px'
    }
}

function exportVerilog() {
    if (!fsmStore.currentFSM) return
    
    try {
        const verilogCode = generateVerilogFromFSM(fsmStore.currentFSM)
        const blob = new Blob([verilogCode], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fsmStore.currentFSM.name || 'fsm'}.v`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        validationMessage.value = '✅ Verilog exported!'
        validationClass.value = 'success'
    } catch (error) {
        validationMessage.value = `Export error: ${error}`
        validationClass.value = 'error'
    }
}

function minimizeStates() {
    if (!fsmStore.currentFSM) return
    
    try {
        const result = minimizeFSM(fsmStore.currentFSM)
        
        if (result.statesReduced > 0) {
            fsmStore.currentFSM.states = result.minimizedFSM.states
            fsmStore.currentFSM.transitions = result.minimizedFSM.transitions
            fsmStore.currentFSM.initialState = result.minimizedFSM.initialState
            
            validationMessage.value = `✅ Minimized: ${result.originalStates} → ${result.minimizedStates} states`
            validationClass.value = 'success'
            
            calculateMetrics()
            drawCanvas()
        } else {
            validationMessage.value = 'FSM is already minimal'
            validationClass.value = 'info'
        }
    } catch (error) {
        validationMessage.value = `Minimize error: ${error}`
        validationClass.value = 'error'
    }
}

function toggleMetrics() {
    showMetrics.value = !showMetrics.value
    if (showMetrics.value) {
        calculateMetrics()
    }
}

function calculateMetrics() {
    if (!fsmStore.currentFSM) return
    
    const numStates = fsmStore.currentFSM.states.length
    let flipFlops: number
    let gateEstimate: number
    
    switch (encoding.value) {
        case 'ONE_HOT':
            flipFlops = numStates
            gateEstimate = numStates * 2
            break
        case 'GRAY':
        case 'BINARY':
        default:
            flipFlops = Math.ceil(Math.log2(numStates || 1))
            gateEstimate = flipFlops * 4 + fsmStore.currentFSM.transitions.length
            break
    }
    
    optimizationMetrics.value = {
        flipFlops,
        gateEstimate,
        statesBeforeMin: numStates,
        statesAfterMin: numStates
    }
}

function saveFSM() {
    if (!fsmStore.currentFSM) return
    
    const data = JSON.stringify(fsmStore.currentFSM, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fsmStore.currentFSM.name || 'fsm'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

function triggerLoadFSM() {
    fileInput.value?.click()
}

function loadFSM(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const fsm = JSON.parse(e.target?.result as string)
            fsmStore.loadFSMFromJSON(JSON.stringify(fsm))
            fsmType.value = fsm.type || 'MOORE'
            encoding.value = fsm.encoding || 'BINARY'
            validationMessage.value = '✅ FSM loaded!'
            validationClass.value = 'success'
            drawCanvas()
        } catch (error) {
            validationMessage.value = `Load error: ${error}`
            validationClass.value = 'error'
        }
    }
    reader.readAsText(file)
    input.value = ''
}

function triggerVerilogImport() {
    verilogInput.value?.click()
}

function importVerilogFSM(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const verilogCode = e.target?.result as string
            const result = parseVerilogFSM(verilogCode)
            
            if (result.success && result.fsm) {
                fsmStore.loadFSMFromJSON(JSON.stringify(result.fsm))
                fsmType.value = result.fsm.type
                encoding.value = result.fsm.encoding
                validationMessage.value = '✅ Verilog FSM imported!'
                validationClass.value = 'success'
                
                if (result.warnings.length > 0) {
                    console.warn('Import warnings:', result.warnings)
                }
                
                drawCanvas()
            } else {
                validationMessage.value = `Import failed: ${result.error}`
                validationClass.value = 'error'
            }
        } catch (error) {
            validationMessage.value = `Import error: ${error}`
            validationClass.value = 'error'
        }
    }
    reader.readAsText(file)
    input.value = ''
}
</script>

<style scoped>
.fsm-editor-tab {
    position: fixed;
    top: 40px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    background: #f5f5f5;
    z-index: 100;
}

.fsm-sidebar {
    width: 350px;
    min-width: 280px;
    background: #3c3c3c;
    color: white;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0;
    border-right: 1px solid #2a2a2a;
}

.fsm-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: #333333;
    border-bottom: 1px solid #4a4a4a;
}

.fsm-sidebar-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.btn-close-fsm {
    background: transparent;
    border: none;
    color: #e74c3c;
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
}

.btn-close-fsm:hover {
    background: rgba(231, 76, 60, 0.2);
}

.fsm-section {
    padding: 16px 18px;
}

.fsm-section h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 500;
    color: #888888;
}

.fsm-tool-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.fsm-tool-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #4a4a4a;
    border: 1px solid #5a5a5a;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.fsm-tool-btn:hover {
    background: #555555;
    border-color: #666666;
}

.fsm-tool-btn.active {
    background: #3498db;
    border-color: #3498db;
}

.fsm-btn-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.fsm-action-btn {
    flex: 1;
    min-width: 60px;
    padding: 8px 12px;
    background: #4a4a4a;
    border: 1px solid #5a5a5a;
    border-radius: 6px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.fsm-action-btn:hover:not(:disabled) {
    background: #555555;
    border-color: #666666;
}

.fsm-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.fsm-action-btn i {
    margin-right: 6px;
}

.fsm-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
}

.fsm-field label {
    font-size: 13px;
    color: #cccccc;
}

.fsm-config-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.fsm-config-row label {
    font-size: 12px;
    min-width: 60px;
    color: rgba(255, 255, 255, 0.8);
}

.fsm-select {
    width: 100%;
    padding: 10px 12px;
    background: #2a2a2a;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    appearance: none; /* Remove default arrow */
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 20px;
    cursor: pointer;
}

.fsm-select option {
    background-color: #2a2a2a;
    color: white;
    padding: 10px;
}

.fsm-action-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.fsm-primary-btn {
    padding: 10px 12px;
    background: #27ae60;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.fsm-primary-btn:hover:not(:disabled) {
    background: #2ecc71;
}

.fsm-primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.fsm-secondary-btn {
    padding: 8px 12px;
    background: #3498db;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.fsm-secondary-btn:hover {
    background: #5dade2;
}

.fsm-metrics-panel {
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.fsm-metric {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 4px;
}

.fsm-metric span {
    color: rgba(255, 255, 255, 0.7);
}

.fsm-metric strong {
    color: #2ecc71;
}

.fsm-status {
    margin-top: auto;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
}

.fsm-status-msg {
    font-size: 12px;
    margin-bottom: 4px;
    word-wrap: break-word;
}

.fsm-status-msg.success {
    color: #2ecc71;
}

.fsm-status-msg.error {
    color: #e74c3c;
}

.fsm-status-msg.info {
    color: #3498db;
}

.fsm-status-info {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
}

.fsm-canvas-container {
    flex: 1;
    position: relative;
    background: white;
    overflow: hidden;
}

.fsm-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

/* K-Map Visualization Styles */
.kmap-container {
    margin-top: 10px;
    max-height: 300px;
    overflow-y: auto;
}

.kmap-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
}

.kmap-title {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 8px;
    color: #3498db;
    text-align: center;
}

.kmap-grid {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow: hidden;
}

.kmap-header-cell {
    background: rgba(52, 152, 219, 0.3);
    padding: 6px 4px;
    text-align: center;
    font-size: 10px;
    font-weight: bold;
    color: #fff;
}

.kmap-cell {
    background: rgba(255, 255, 255, 0.1);
    padding: 8px 4px;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #fff;
    transition: background 0.2s;
}

.kmap-cell.kmap-grouped {
    background: rgba(46, 204, 113, 0.4);
    color: #2ecc71;
}

.kmap-expression {
    margin-top: 8px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    word-break: break-all;
}

.kmap-expression strong {
    color: #3498db;
}

.kmap-empty {
    padding: 12px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
}
</style>
