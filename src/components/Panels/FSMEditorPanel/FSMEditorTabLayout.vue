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

            <!-- Tools: Compact horizontal icon bar (always visible) -->
            <div class="fsm-section fsm-toolbar-section">
                <div class="fsm-icon-toolbar">
                    <div class="fsm-toolbar-group">
                        <button 
                            :class="['fsm-icon-btn', { active: tool === 'select' }]" 
                            @click="setTool('select')"
                            title="Select (S)"
                        >
                            <i class="fas fa-mouse-pointer"></i>
                        </button>
                        <button 
                            :class="['fsm-icon-btn', { active: tool === 'state' }]" 
                            @click="setTool('state')"
                            title="Add State (A)"
                        >
                            <i class="fas fa-circle"></i>
                        </button>
                        <button 
                            :class="['fsm-icon-btn', { active: tool === 'transition' }]" 
                            @click="setTool('transition')"
                            title="Add Transition (T)"
                        >
                            <i class="fas fa-long-arrow-alt-right"></i>
                        </button>
                    </div>

                    <div class="fsm-toolbar-separator"></div>

                    <div class="fsm-toolbar-group">
                        <button class="fsm-icon-btn" @click="performUndo" :disabled="!fsmStore.canUndo" title="Undo (Ctrl+Z)">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="fsm-icon-btn" @click="performRedo" :disabled="!fsmStore.canRedo" title="Redo (Ctrl+Y)">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="fsm-icon-btn fsm-icon-btn--danger" @click="clearCanvas" title="Clear All">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Primary Action: Synthesize (always visible, always clickable) -->
            <div class="fsm-section fsm-actions-section">
                <button 
                    class="fsm-primary-btn" 
                    @click="synthesizeCircuit"
                    title="Convert FSM to circuit"
                >
                    <i class="fas fa-microchip"></i> Synthesize Circuit
                </button>
            </div>

            <!-- Collapsible: Configuration -->
            <div class="fsm-section fsm-collapsible" :class="{ collapsed: sections.config }">
                <h4 class="fsm-section-toggle" @click="sections.config = !sections.config">
                    <span>Configuration</span>
                    <i :class="sections.config ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
                </h4>
                <div v-show="!sections.config" class="fsm-section-body">
                    <div class="fsm-config-row">
                        <label>Type:</label>
                        <select v-model="fsmType" class="fsm-select">
                            <option value="MOORE">Moore</option>
                            <option value="MEALY">Mealy</option>
                        </select>
                    </div>
                    <div class="fsm-config-row">
                        <label>Encoding:</label>
                        <select v-model="encoding" class="fsm-select">
                            <option value="BINARY">Binary</option>
                            <option value="GRAY">Gray Code</option>
                            <option value="ONE_HOT">One-Hot</option>
                        </select>
                    </div>
                    <div class="fsm-config-row">
                        <label>Template:</label>
                        <select v-model="selectedTemplate" @change="loadTemplateHandler" class="fsm-select">
                            <option value="">-- Select --</option>
                            <option value="sequence_detector">Sequence Detector (101)</option>
                            <option value="traffic_light">Traffic Light Controller</option>
                            <option value="counter_2bit">2-Bit Counter</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Collapsible: Advanced (Optimization + Export + K-Map) -->
            <div class="fsm-section fsm-collapsible" :class="{ collapsed: sections.advanced }">
                <h4 class="fsm-section-toggle" @click="sections.advanced = !sections.advanced">
                    <span>Advanced</span>
                    <i :class="sections.advanced ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
                </h4>
                <div v-show="!sections.advanced" class="fsm-section-body">
                    <div class="fsm-subsection">
                        <span class="fsm-sublabel">Optimization</span>
                         <div class="fsm-btn-row">
                            <button class="fsm-action-btn" @click="minimizeStates" title="Reduce equivalent states (Hopcroft)">
                                <i class="fas fa-compress-arrows-alt"></i> Minimize States
                            </button>
                        </div>
                    </div>

                    <div class="fsm-subsection">
                        <span class="fsm-sublabel">Metrics</span>
                        <button class="fsm-action-btn" @click="toggleMetrics" style="width: 100%">
                            <i class="fas fa-chart-bar"></i> {{ showMetrics ? 'Hide' : 'Show' }} Metrics
                        </button>
                        <div v-if="showMetrics && optimizationMetrics" class="fsm-metrics-inline">
                            <div class="fsm-metric">
                                <span>Flip-Flops:</span>
                                <strong>{{ optimizationMetrics.flipFlops }}</strong>
                            </div>
                            <div class="fsm-metric">
                                <span>Est. Gates:</span>
                                <strong>{{ optimizationMetrics.gateEstimate }}</strong>
                            </div>
                            <div v-if="optimizationMetrics.statesBeforeMin > optimizationMetrics.statesAfterMin" class="fsm-metric">
                                <span>Reduced:</span>
                                <strong>{{ optimizationMetrics.statesBeforeMin }} → {{ optimizationMetrics.statesAfterMin }}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="fsm-subsection">
                        <span class="fsm-sublabel">K-Map Visualization</span>
                        <button 
                            class="fsm-action-btn"
                            @click="generateKMaps"
                            style="width: 100%"
                        >
                            <span>📊</span> Generate K-Maps
                        </button>
                        <div v-if="showKMaps && kmapData.length > 0" class="kmap-container">
                            <div v-for="(kmap, idx) in kmapData" :key="idx" class="kmap-card">
                                <div class="kmap-title">{{ kmap.variable }}</div>
                                <div class="kmap-grid" :style="getKmapGridStyle(kmap.variables)">
                                    <div class="kmap-header-cell"></div>
                                    <div 
                                        v-for="(col, colIdx) in kmap.colHeaders" 
                                        :key="'col-'+colIdx" 
                                        class="kmap-header-cell"
                                    >{{ col }}</div>
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
                </div>
            </div>

            <!-- Collapsible: Import / Export -->
            <div class="fsm-section fsm-collapsible" :class="{ collapsed: sections.importExport }">
                <h4 class="fsm-section-toggle" @click="sections.importExport = !sections.importExport">
                    <span>Import / Export</span>
                    <i :class="sections.importExport ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
                </h4>
                <div v-show="!sections.importExport" class="fsm-section-body">
                    <div class="fsm-subsection">
                        <span class="fsm-sublabel">Verilog</span>
                        <div class="fsm-btn-row">
                            <button class="fsm-action-btn" @click="triggerVerilogImport" title="Import FSM from .v file">
                                <i class="fas fa-file-import"></i> Import
                            </button>
                            <button class="fsm-action-btn" @click="exportVerilog" title="Export as Verilog code">
                                <i class="fas fa-file-export"></i> Export
                            </button>
                        </div>
                    </div>
                    <div class="fsm-subsection">
                        <span class="fsm-sublabel">JSON Data</span>
                        <div class="fsm-btn-row">
                            <button class="fsm-action-btn" @click="saveFSM" title="Save FSM as JSON">
                                <i class="fas fa-save"></i> Save JSON
                            </button>
                            <button class="fsm-action-btn" @click="triggerLoadFSM" title="Load FSM from JSON">
                                <i class="fas fa-folder-open"></i> Load JSON
                            </button>
                        </div>
                    </div>
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

            <!-- Status Bar (always visible, pinned to bottom - only shows counts) -->
            <div class="fsm-status">
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

            <!-- Empty Canvas: Getting Started overlay -->
            <div 
                v-if="!fsmStore.currentFSM || fsmStore.currentFSM.states.length === 0"
                class="fsm-empty-hint"
            >
                <div class="fsm-empty-hint__icon">🔧</div>
                <h3 class="fsm-empty-hint__title">Getting Started</h3>
                <ol class="fsm-empty-hint__steps">
                    <li>Select <strong>Add State</strong> <kbd>A</kbd> from the toolbar</li>
                    <li>Click on the canvas to place states</li>
                    <li>Use <strong>Add Transition</strong> <kbd>T</kbd> to connect them</li>
                </ol>
                <p class="fsm-empty-hint__sub">Then hit <strong>Synthesize Circuit</strong> to generate hardware</p>
            </div>

            <!-- Toast Notification (slides up from bottom of canvas) -->
            <Transition name="toast">
                <div 
                    v-if="toast.visible" 
                    :class="['fsm-toast', 'fsm-toast--' + toast.type]"
                >
                    {{ toast.message }}
                </div>
            </Transition>
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


// Toast notification state
const toast = ref<{
    visible: boolean
    message: string
    type: 'error' | 'success' | 'info'
}>({
    visible: false,
    message: '',
    type: 'info'
})
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'error' | 'success' | 'info' = 'info', duration = 3000) {
    // Clear any existing timer
    if (toastTimer) clearTimeout(toastTimer)
    
    toast.value = { visible: true, message, type }
    
    toastTimer = setTimeout(() => {
        toast.value.visible = false
    }, duration)
}

// Collapsible section states (true = collapsed)
const sections = ref({
    config: true,       // Configuration collapsed by default
    advanced: true,     // Advanced collapsed by default  
    importExport: true,  // Import/Export collapsed by default
})

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
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            // Only delete if no input is focused (to avoid deleting text)
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                deleteSelected()
            }
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
    
    if (!fsmCanvas.value) {
        return
    }
    
    const container = fsmCanvas.value.parentElement
    if (!container) {
        return
    }
    
    // Get computed dimensions
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    
    if (width <= 0 || height <= 0) {
        // Retry with increasing delay
        if (retryCount < 10) {
            const delay = 100 + retryCount * 100
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
    
    
    // Create new FSM if not exist
    if (!fsmStore.currentFSM) {
        fsmStore.createNewFSM('New FSM', fsmType.value)
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
    // Reset toast state
    if (toastTimer) clearTimeout(toastTimer)
    toast.value.visible = false
    
    exitFSMMode()
    simulatorMobileStore.isFSM = false
}

function drawCanvas() {
    
    if (!ctx || !fsmCanvas.value) {
        return
    }
    
    const canvas = fsmCanvas.value
    
    if (canvas.width <= 0 || canvas.height <= 0) {
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
        return
    }
    
    
    // Draw transitions
    for (const transition of fsmStore.currentFSM.transitions) {
        drawTransition(transition)
    }
    
    // Draw states
    for (const state of fsmStore.currentFSM.states) {
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
            fill: '#FFE0B2',      // Material Orange 100 (very light)
            highlight: '#FFF3E0', // Material Orange 50
            border: '#FFB74D',    // Material Orange 300
            text: '#E65100'       // Dark Orange text
        }
    }
    if (isRed) {
        return {
            fill: '#FFCDD2',      // Material Red 100 (very light)
            highlight: '#FFEBEE', // Material Red 50
            border: '#E57373',    // Material Red 300
            text: '#C62828'       // Dark Red text
        }
    }
    if (isYellow) {
        return {
            fill: '#FFF9C4',      // Material Yellow 100 (very light)
            highlight: '#FFFDE7', // Material Yellow 50
            border: '#FFF176',    // Material Yellow 300
            text: '#F57F17'       // Dark Yellow text
        }
    }
    if (isGreen) {
        return {
            fill: '#C8E6C9',      // Material Green 100 (very light)
            highlight: '#E8F5E9', // Material Green 50
            border: '#81C784',    // Material Green 300
            text: '#1B5E20'       // Dark Green text
        }
    }
    
    // Default: Initial state is soft green, others are soft blue
    if (state.isInitial) {
        return {
            fill: '#C8E6C9',      // Material Green 100
            highlight: '#E8F5E9', // Material Green 50
            border: '#66BB6A',    // Material Green 400
            text: '#1B5E20'
        }
    }
    
    // Standard state color (soft blue)
    return {
        fill: '#BBDEFB',          // Material Blue 100
        highlight: '#E3F2FD',     // Material Blue 50
        border: '#64B5F6',        // Material Blue 300
        text: '#0D47A1'           // Dark Blue text
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
    
    if (!fsmCanvas.value) {
        return
    }
    
    // Ensure FSM exists
    if (!fsmStore.currentFSM) {
        fsmStore.createNewFSM('New FSM', fsmType.value)
    }
    
    if (!fsmStore.currentFSM) {
        console.error('Failed to create FSM')
        return
    }
    
    const rect = fsmCanvas.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
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
        fsmStore.addState({
            id: stateId,
            label: stateId,
            isInitial: fsmStore.currentFSM.states.length === 0,
            position: { x, y },
            outputs: {}
        })
    } else if (tool.value === 'transition') {
        if (clickedState) {
            if (!transitionStart.value) {
                transitionStart.value = clickedState.id
            } else {
                // Create transition with auto-incrementing input value
                const transitionId = `T${fsmStore.currentFSM.transitions.length}`
                const inputValue = fsmStore.currentFSM.transitions.length
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

function deleteSelected() {
    if (fsmStore.selectedStateId) {
        fsmStore.removeState(fsmStore.selectedStateId)
        fsmStore.selectState(null)
        showStateDialog.value = false
        drawCanvas()
    } else if (fsmStore.selectedTransitionId) {
        fsmStore.removeTransition(fsmStore.selectedTransitionId)
        fsmStore.selectTransition(null)
        showTransitionDialog.value = false
        drawCanvas()
    } else {
        showToast('Select a state or transition to delete', 'info')
    }
}

function loadTemplateHandler() {
    if (!selectedTemplate.value) return
    
    fsmStore.loadTemplate(selectedTemplate.value)
    drawCanvas()
    selectedTemplate.value = ''
}

function synthesizeCircuit() {
    
    if (!fsmStore.currentFSM) {
        showToast('No FSM defined — add states first', 'error')
        return
    }

    const fsm = fsmStore.currentFSM
    
    // === Pre-synthesis validation with user-friendly messages ===
    if (fsm.states.length === 0) {
        showToast('No states — click canvas to add states', 'error')
        return
    }

    if (!fsm.initialState) {
        showToast('No initial state — double-click a state and mark it as initial', 'error')
        return
    }

    if (fsm.transitions.length === 0) {
        showToast('No transitions — use the Transition tool to connect states', 'error')
        return
    }

    // Large FSM warning
    if (fsm.states.length > 8) {
        console.warn(`Large FSM with ${fsm.states.length} states — circuit may be complex`)
    }
    
    try {
        const validation = validateFSM(fsm)
        
        if (!validation.isValid) {
            // Build specific, actionable messages
            const issues: string[] = []
            
            for (const issue of validation.completenessIssues) {
                if (issue.includes('initial state')) {
                    issues.push('⚠️ Set an initial state (double-click a state)')
                } else {
                    issues.push('⚠️ ' + issue)
                }
            }
            
            if (validation.unreachableStates.length > 0) {
                const names = validation.unreachableStates
                    .map(id => fsm.states.find(s => s.id === id)?.label || id)
                    .join(', ')
                issues.push(`⚠️ Unreachable states: ${names} — add transitions to reach them`)
            }
            
            if (validation.deadStates.length > 0) {
                const names = validation.deadStates
                    .map(id => fsm.states.find(s => s.id === id)?.label || id)
                    .join(', ')
                issues.push(`🚩 Dead-end states: ${names} — add outgoing transitions`)
            }
            
            if (validation.conflicts.length > 0) {
                issues.push(`❌ ${validation.conflicts.length} conflicting transition(s) — same input from same state`)
            }
            
            showToast(issues[0] || 'Validation failed', 'error')
            
            // Log all issues for debugging
            console.warn('FSM validation issues:', issues)
            return
        }
        
        // === Generate circuit ===
        const projectData = generateCircuitVerseJSON(fsm) as any
        
        if (!projectData || !projectData.scopes || projectData.scopes.length === 0) {
            throw new Error('Failed to generate circuit data')
        }

        const scopeName = projectData.scopes[0].name
        const scope = newCircuit(scopeName, undefined, false, false)
        
        if (!scope) {
            throw new Error('Failed to create new circuit scope')
        }

        loadScope(scope, projectData.scopes[0])

        const synthesizer = new FSMSynthesizer(fsm)
        synthesizer.synthesize()
        const ffCount = synthesizer.getFlipFlopCount()

        showToast(`Circuit "${scopeName}" created! (${ffCount} flip-flops)`, 'success', 5000)
        
        storeFSMScopeId()
        exitFSMMode()
        simulatorMobileStore.isFSM = false
            
    } catch (error) {
        console.error('Synthesis error:', error)
        showToast(`Synthesis failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
}

// K-map visualization functions
function generateKMaps() {
    if (!fsmStore.currentFSM || fsmStore.currentFSM.states.length === 0) {
        showToast('No FSM states to generate K-maps', 'error')
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
    showToast(`Generated ${maps.length} K-map(s)`, 'success')
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
    if (!fsmStore.currentFSM) {
        showToast('No FSM to export', 'error')
        return
    }

    if (fsmStore.currentFSM.states.length === 0) {
        showToast('Add states before exporting Verilog', 'error')
        return
    }
    
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
        
        showToast('Verilog exported!', 'success')
    } catch (error) {
        showToast(`Export error: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
}

function minimizeStates() {
    if (!fsmStore.currentFSM) {
        showToast('No FSM to minimize', 'error')
        return
    }

    if (fsmStore.currentFSM.states.length < 2) {
        showToast('Need at least 2 states to minimize', 'info')
        return
    }
    
    try {
        const result = minimizeFSM(fsmStore.currentFSM)
        
        if (result.statesReduced > 0) {
            fsmStore.currentFSM.states = result.minimizedFSM.states
            fsmStore.currentFSM.transitions = result.minimizedFSM.transitions
            fsmStore.currentFSM.initialState = result.minimizedFSM.initialState
            
            showToast(`Minimized: ${result.originalStates} → ${result.minimizedStates} states`, 'success')
            
            calculateMetrics()
            drawCanvas()
        } else {
            showToast('Already minimal — no equivalent states found', 'info')
        }
    } catch (error) {
        showToast(`Minimize error: ${error instanceof Error ? error.message : String(error)}`, 'error')
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
            showToast('FSM loaded!', 'success')
            drawCanvas()
        } catch (error) {
            showToast(`Load error: ${error instanceof Error ? error.message : String(error)}`, 'error')
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
                showToast('Verilog FSM imported!', 'success')
                
                if (result.warnings.length > 0) {
                    console.warn('Import warnings:', result.warnings)
                }
                
                drawCanvas()
            } else {
                showToast(`Import failed: ${result.error}`, 'error')
            }
        } catch (error) {
            showToast(`Import error: ${error instanceof Error ? error.message : String(error)}`, 'error')
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
    background: var(--primary);
    color: var(--text-panel);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0;
    border-right: 2px solid var(--br-primary);
}

.fsm-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 17px;
    padding-top: 15px;
    background: var(--primary);
    border-bottom: 1px solid var(--br-secondary);
    cursor: default;
}

.fsm-sidebar-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--text-panel);
}

.btn-close-fsm {
    background: transparent;
    border: none;
    color: #e74c3c;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    transition: all 0.2s;
}

.btn-close-fsm:hover {
    background: rgba(231, 76, 60, 0.15);
}

.fsm-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--br-secondary);
}



/* Compact icon toolbar */
.fsm-toolbar-section {
    padding: 10px 16px;
    border-bottom: 1px solid var(--br-secondary);
}


.fsm-icon-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.fsm-toolbar-group {
    display: flex;
    gap: 4px;
    align-items: center;
}

.fsm-icon-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--br-secondary);
    border-radius: 4px;
    color: var(--text-panel);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.fsm-icon-btn:hover:not(:disabled) {
    background: var(--bg-icons);
}

.fsm-icon-btn.active {
    background: var(--bg-toggle-btn-primary);
    border-color: var(--bg-toggle-btn-primary);
    color: var(--text-lite);
}

.fsm-icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.fsm-icon-btn--danger:hover:not(:disabled) {
    background: var(--btn-danger);
    border-color: var(--btn-danger);
}

.fsm-toolbar-separator {
    width: 1px;
    height: 24px;
    background: var(--br-secondary);
    margin: 0 4px;
}

/* Synthesize section */
.fsm-actions-section {
    padding: 10px 16px;
    border-bottom: 1px solid var(--br-secondary);
}

/* Collapsible sections */
.fsm-collapsible {
    border-bottom: 1px solid var(--br-secondary);
}

.fsm-section-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    margin: 0 !important;
    padding: 10px 0;
    font-size: 17px;
    font-weight: 500;
    line-height: 1.3;
    color: var(--text-panel);
    transition: opacity 0.15s;
}

.fsm-section-toggle:hover {
    opacity: 0.8;
}

.fsm-section-toggle i {
    font-size: 12px;
    width: 16px;
    text-align: center;
    transition: transform 0.2s ease;
    color: var(--text-panel);
}

.fsm-section-toggle i.fa-chevron-down {
    transform: rotate(0deg);
}

.fsm-section-toggle i.fa-chevron-right {
    transform: rotate(0deg);
}

.fsm-section-body {
    margin-top: 10px;
    overflow: hidden;
    animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        max-height: 600px;
        transform: translateY(0);
    }
}

/* Subsection labels within Advanced */
.fsm-subsection {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.fsm-subsection:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.fsm-sublabel {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--br-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
}

/* Inline metrics (inside Advanced) */
.fsm-metrics-inline {
    margin-top: 8px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    border: 1px solid var(--br-secondary);
}

/* Legacy (keep for compatibility) */
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
    background: transparent;
    border: 1px solid var(--br-secondary);
    border-radius: 4px;
    color: var(--text-panel);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.fsm-tool-btn:hover {
    background: var(--bg-icons);
}

.fsm-tool-btn.active {
    background: var(--bg-toggle-btn-primary);
    border-color: var(--bg-toggle-btn-primary);
}

.fsm-btn-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.fsm-action-btn {
    flex: 1;
    min-width: 60px;
    padding: 9px 12px;
    background: transparent;
    border: 1px solid var(--br-secondary);
    border-radius: 4px;
    color: var(--text-panel);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.fsm-action-btn:hover:not(:disabled) {
    background: var(--bg-icons);
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
    color: var(--text-panel);
}

.fsm-config-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.fsm-config-row label {
    font-size: 13px;
    min-width: 70px;
    color: var(--text-panel);
}

.fsm-select {
    width: 100%;
    padding: 9px 12px;
    background: var(--primary);
    border: 1px solid var(--br-secondary);
    border-radius: 4px;
    color: var(--text-lite);
    font-size: 14px;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 18px;
    cursor: pointer;
    transition: border-color 0.2s ease-in-out;
}

.fsm-select:hover {
    border-color: var(--br-primary);
}

.fsm-select:focus {
    outline: none;
    border-color: var(--br-primary);
}

.fsm-select option {
    background-color: var(--primary);
    color: var(--text-lite);
    padding: 10px;
}

.fsm-action-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.fsm-primary-btn {
    width: 100%;
    padding: 10px 16px;
    background-color: var(--bg-toggle-btn-primary);
    border: none;
    border-radius: 4px;
    color: var(--text-lite);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
}

.fsm-primary-btn:hover {
    background-color: var(--primary-btn-hov);
}

.fsm-secondary-btn {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--br-secondary);
    border-radius: 4px;
    color: var(--text-panel);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.fsm-secondary-btn:hover {
    background: var(--bg-icons);
}

.fsm-metrics-panel {
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.15);
    border-bottom: 1px solid var(--br-secondary);
}

.fsm-metric {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 4px;
    padding: 2px 0;
}

.fsm-metric span {
    color: var(--text-panel);
    opacity: 0.7;
}

.fsm-metric strong {
    color: var(--bg-toggle-btn-primary);
    font-weight: 600;
}

.fsm-status {
    margin-top: auto;
    padding: 10px 16px;
    border-top: 1px solid var(--br-secondary);
    color: var(--text-panel);
}

.fsm-status-info {
    font-size: 13px;
    color: var(--text-panel);
    opacity: 0.7;
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

/* Empty canvas hint overlay */
.fsm-empty-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #888;
    pointer-events: none;
    user-select: none;
}

.fsm-empty-hint__icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
}

.fsm-empty-hint__title {
    font-size: 22px;
    font-weight: 600;
    color: #555;
    margin: 0 0 16px;
}

.fsm-empty-hint__steps {
    text-align: left;
    display: inline-block;
    font-size: 15px;
    line-height: 2;
    color: #666;
    padding-left: 20px;
    margin: 0 0 14px;
}

.fsm-empty-hint__steps kbd {
    display: inline-block;
    padding: 1px 6px;
    font-size: 12px;
    font-family: monospace;
    background: #e8e8e8;
    border: 1px solid #ccc;
    border-radius: 3px;
    color: #555;
    margin-left: 4px;
}

.fsm-empty-hint__sub {
    font-size: 13px;
    color: #999;
    margin: 0;
}

/* Toast notification — CV-style horizontal bar */
.fsm-toast {
    position: absolute;
    bottom: 16px;
    left: 24px;
    right: 24px;
    padding: 12px 18px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    z-index: 100;
    pointer-events: none;
    border-left: 4px solid;
}

.fsm-toast--error {
    background: rgba(220, 53, 69, 0.08);
    border-left-color: #dc3545;
    color: #721c24;
}

.fsm-toast--success {
    background: rgba(40, 167, 69, 0.08);
    border-left-color: #28a745;
    color: #155724;
}

.fsm-toast--info {
    background: rgba(23, 162, 184, 0.08);
    border-left-color: #17a2b8;
    color: #0c5460;
}

/* Vue <Transition name="toast"> */
.toast-enter-active {
    transition: all 0.3s ease-out;
}

.toast-leave-active {
    transition: all 0.3s ease-in;
}

.toast-enter-from {
    opacity: 0;
    transform: translateY(20px);
}

.toast-leave-to {
    opacity: 0;
    transform: translateY(10px);
}

/* K-Map Visualization Styles */
.kmap-container {
    margin-top: 10px;
    max-height: 300px;
    overflow-y: auto;
}

.kmap-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid var(--br-secondary);
    padding: 10px;
    margin-bottom: 10px;
}

.kmap-title {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--bg-toggle-btn-primary);
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
