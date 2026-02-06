import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FSMDefinition, FSMState, FSMTransition, FSMType, StateEncoding } from '../types/fsm'

/**
 * FSM Store - Manages FSM editor state
 * Following CircuitVerse Pinia patterns (similar to verilogStore)
 */
export const useFSMStore = defineStore('fsmStore', () => {
    // Current FSM being edited
    const currentFSM = ref<FSMDefinition | null>(null)

    // Editor state
    const isPanelVisible = ref(false)
    const selectedStateId = ref<string | null>(null)
    const selectedTransitionId = ref<string | null>(null)
    const isEditMode = ref(true)

    // Undo/Redo history stacks
    const undoStack = ref<string[]>([])
    const redoStack = ref<string[]>([])
    const maxHistorySize = 50

    // Save current state to undo stack
    const saveToHistory = () => {
        if (!currentFSM.value) return
        const snapshot = JSON.stringify(currentFSM.value)
        undoStack.value.push(snapshot)
        if (undoStack.value.length > maxHistorySize) {
            undoStack.value.shift()
        }
        // Clear redo stack when new action is performed
        redoStack.value = []
    }

    // Can undo/redo computed
    const canUndo = computed(() => undoStack.value.length > 0)
    const canRedo = computed(() => redoStack.value.length > 0)

    // Computed
    const selectedState = computed(() => {
        if (!currentFSM.value || !selectedStateId.value) return null
        return currentFSM.value.states.find(s => s.id === selectedStateId.value) || null
    })

    const selectedTransition = computed(() => {
        if (!currentFSM.value || !selectedTransitionId.value) return null
        return currentFSM.value.transitions.find(t => t.id === selectedTransitionId.value) || null
    })

    // Actions
    const createNewFSM = (name: string, type: FSMType = 'MOORE') => {
        currentFSM.value = {
            name,
            type,
            states: [],
            transitions: [],
            inputs: ['X'],
            outputs: ['Z'],
            initialState: '',
            encoding: 'BINARY',
        }
    }

    const addState = (state: Partial<FSMState>): string => {
        if (!currentFSM.value) return ''
        saveToHistory()

        const id = `S${currentFSM.value.states.length}`
        const newState: FSMState = {
            id,
            label: state.label || id,
            isInitial: state.isInitial || currentFSM.value.states.length === 0,
            isFinal: state.isFinal || false,
            position: state.position || { x: 100, y: 100 },
            outputs: state.outputs || {},
        }

        currentFSM.value.states.push(newState)

        if (newState.isInitial) {
            currentFSM.value.initialState = id
        }

        return id
    }

    const removeState = (stateId: string) => {
        if (!currentFSM.value) return
        saveToHistory()

        currentFSM.value.states = currentFSM.value.states.filter(s => s.id !== stateId)
        currentFSM.value.transitions = currentFSM.value.transitions.filter(
            t => t.from !== stateId && t.to !== stateId
        )

        if (selectedStateId.value === stateId) {
            selectedStateId.value = null
        }

        if (currentFSM.value.initialState === stateId) {
            currentFSM.value.initialState = currentFSM.value.states[0]?.id || ''
        }
    }

    const updateState = (stateId: string, updates: Partial<FSMState>) => {
        if (!currentFSM.value) return
        saveToHistory()

        const state = currentFSM.value.states.find(s => s.id === stateId)
        if (!state) return

        Object.assign(state, updates)
    }

    const addTransition = (transition: Partial<FSMTransition>): string => {
        if (!currentFSM.value) return ''
        saveToHistory()

        const id = `T${currentFSM.value.transitions.length}`
        const newTransition: FSMTransition = {
            id,
            from: transition.from || '',
            to: transition.to || '',
            inputs: transition.inputs || {},
            outputs: transition.outputs,
            label: transition.label,
        }

        currentFSM.value.transitions.push(newTransition)
        return id
    }

    const removeTransition = (transitionId: string) => {
        if (!currentFSM.value) return
        saveToHistory()

        currentFSM.value.transitions = currentFSM.value.transitions.filter(t => t.id !== transitionId)

        if (selectedTransitionId.value === transitionId) {
            selectedTransitionId.value = null
        }
    }

    const updateTransition = (transitionId: string, updates: Partial<FSMTransition>) => {
        if (!currentFSM.value) return
        saveToHistory()

        const transition = currentFSM.value.transitions.find(t => t.id === transitionId)
        if (!transition) return

        Object.assign(transition, updates)
    }

    // Undo - restore previous state
    const undo = () => {
        if (undoStack.value.length === 0) return false

        // Save current state to redo stack
        if (currentFSM.value) {
            redoStack.value.push(JSON.stringify(currentFSM.value))
        }

        // Restore from undo stack
        const previousState = undoStack.value.pop()
        if (previousState) {
            currentFSM.value = JSON.parse(previousState)
            return true
        }
        return false
    }

    // Redo - restore next state
    const redo = () => {
        if (redoStack.value.length === 0) return false

        // Save current state to undo stack
        if (currentFSM.value) {
            undoStack.value.push(JSON.stringify(currentFSM.value))
        }

        // Restore from redo stack
        const nextState = redoStack.value.pop()
        if (nextState) {
            currentFSM.value = JSON.parse(nextState)
            return true
        }
        return false
    }

    // Clear history (e.g., when loading a new FSM)
    const clearHistory = () => {
        undoStack.value = []
        redoStack.value = []
    }

    const togglePanel = () => {
        isPanelVisible.value = !isPanelVisible.value
    }

    const showPanel = () => {
        isPanelVisible.value = true
    }

    const hidePanel = () => {
        isPanelVisible.value = false
    }

    const selectState = (stateId: string | null) => {
        selectedStateId.value = stateId
        selectedTransitionId.value = null
    }

    const selectTransition = (transitionId: string | null) => {
        selectedTransitionId.value = transitionId
        selectedStateId.value = null
    }

    const setEncoding = (encoding: StateEncoding) => {
        if (!currentFSM.value) return
        currentFSM.value.encoding = encoding
    }

    const clearFSM = () => {
        currentFSM.value = null
        selectedStateId.value = null
        selectedTransitionId.value = null
    }

    // ================== TEMPLATES ==================
    const loadTemplate = (templateName: string) => {
        switch (templateName) {
            case 'sequence_detector':
                loadSequenceDetectorTemplate()
                break
            case 'traffic_light':
                loadTrafficLightTemplate()
                break
            case 'counter_2bit':
                loadCounter2BitTemplate()
                break
            default:
                createNewFSM('New FSM')
        }
    }

    const loadSequenceDetectorTemplate = () => {
        // Sequence detector for pattern "101"
        currentFSM.value = {
            name: 'Sequence_Detector_101',
            type: 'MEALY',
            states: [
                { id: 'S0', label: 'S0', isInitial: true, isFinal: false, position: { x: 100, y: 150 }, outputs: {} },
                { id: 'S1', label: 'S1', isInitial: false, isFinal: false, position: { x: 250, y: 150 }, outputs: {} },
                { id: 'S2', label: 'S2', isInitial: false, isFinal: false, position: { x: 400, y: 150 }, outputs: {} },
            ],
            transitions: [
                { id: 'T0', from: 'S0', to: 'S0', inputs: { X: 0 }, outputs: { Z: 0 }, label: '0/0' },
                { id: 'T1', from: 'S0', to: 'S1', inputs: { X: 1 }, outputs: { Z: 0 }, label: '1/0' },
                { id: 'T2', from: 'S1', to: 'S1', inputs: { X: 1 }, outputs: { Z: 0 }, label: '1/0' },
                { id: 'T3', from: 'S1', to: 'S2', inputs: { X: 0 }, outputs: { Z: 0 }, label: '0/0' },
                { id: 'T4', from: 'S2', to: 'S0', inputs: { X: 0 }, outputs: { Z: 0 }, label: '0/0' },
                { id: 'T5', from: 'S2', to: 'S1', inputs: { X: 1 }, outputs: { Z: 1 }, label: '1/1' },
            ],
            inputs: ['X'],
            outputs: ['Z'],
            initialState: 'S0',
            encoding: 'BINARY',
        }
    }

    const loadTrafficLightTemplate = () => {
        // Simple traffic light controller
        currentFSM.value = {
            name: 'Traffic_Light',
            type: 'MOORE',
            states: [
                { id: 'S0', label: 'GREEN', isInitial: true, isFinal: false, position: { x: 100, y: 100 }, outputs: { G: 1, Y: 0, R: 0 } },
                { id: 'S1', label: 'YELLOW', isInitial: false, isFinal: false, position: { x: 300, y: 100 }, outputs: { G: 0, Y: 1, R: 0 } },
                { id: 'S2', label: 'RED', isInitial: false, isFinal: false, position: { x: 300, y: 250 }, outputs: { G: 0, Y: 0, R: 1 } },
                { id: 'S3', label: 'RED_YELLOW', isInitial: false, isFinal: false, position: { x: 100, y: 250 }, outputs: { G: 0, Y: 1, R: 1 } },
            ],
            transitions: [
                { id: 'T0', from: 'S0', to: 'S1', inputs: { TIMER: 1 }, label: 'TIMER' },
                { id: 'T1', from: 'S0', to: 'S0', inputs: { TIMER: 0 }, label: '!TIMER' },
                { id: 'T2', from: 'S1', to: 'S2', inputs: { TIMER: 1 }, label: 'TIMER' },
                { id: 'T3', from: 'S1', to: 'S1', inputs: { TIMER: 0 }, label: '!TIMER' },
                { id: 'T4', from: 'S2', to: 'S3', inputs: { TIMER: 1 }, label: 'TIMER' },
                { id: 'T5', from: 'S2', to: 'S2', inputs: { TIMER: 0 }, label: '!TIMER' },
                { id: 'T6', from: 'S3', to: 'S0', inputs: { TIMER: 1 }, label: 'TIMER' },
                { id: 'T7', from: 'S3', to: 'S3', inputs: { TIMER: 0 }, label: '!TIMER' },
            ],
            inputs: ['TIMER'],
            outputs: ['G', 'Y', 'R'],
            initialState: 'S0',
            encoding: 'GRAY',
        }
    }

    const loadCounter2BitTemplate = () => {
        // 2-bit up counter
        currentFSM.value = {
            name: '2Bit_Counter',
            type: 'MOORE',
            states: [
                { id: 'S0', label: '00', isInitial: true, isFinal: false, position: { x: 100, y: 100 }, outputs: { Q1: 0, Q0: 0 } },
                { id: 'S1', label: '01', isInitial: false, isFinal: false, position: { x: 250, y: 100 }, outputs: { Q1: 0, Q0: 1 } },
                { id: 'S2', label: '10', isInitial: false, isFinal: false, position: { x: 250, y: 220 }, outputs: { Q1: 1, Q0: 0 } },
                { id: 'S3', label: '11', isInitial: false, isFinal: false, position: { x: 100, y: 220 }, outputs: { Q1: 1, Q0: 1 } },
            ],
            transitions: [
                { id: 'T0', from: 'S0', to: 'S1', inputs: { EN: 1 }, label: 'EN' },
                { id: 'T1', from: 'S0', to: 'S0', inputs: { EN: 0 }, label: '!EN' },
                { id: 'T2', from: 'S1', to: 'S2', inputs: { EN: 1 }, label: 'EN' },
                { id: 'T3', from: 'S1', to: 'S1', inputs: { EN: 0 }, label: '!EN' },
                { id: 'T4', from: 'S2', to: 'S3', inputs: { EN: 1 }, label: 'EN' },
                { id: 'T5', from: 'S2', to: 'S2', inputs: { EN: 0 }, label: '!EN' },
                { id: 'T6', from: 'S3', to: 'S0', inputs: { EN: 1 }, label: 'EN' },
                { id: 'T7', from: 'S3', to: 'S3', inputs: { EN: 0 }, label: '!EN' },
            ],
            inputs: ['EN'],
            outputs: ['Q1', 'Q0'],
            initialState: 'S0',
            encoding: 'BINARY',
        }
    }

    // ================== SAVE/LOAD ==================
    const saveFSMToJSON = (): string | null => {
        if (!currentFSM.value) return null
        return JSON.stringify(currentFSM.value, null, 2)
    }

    const loadFSMFromJSON = (json: string): boolean => {
        try {
            const fsm = JSON.parse(json) as FSMDefinition
            // Validate basic structure
            if (!fsm.name || !fsm.states || !fsm.transitions) {
                throw new Error('Invalid FSM structure')
            }
            currentFSM.value = fsm
            selectedStateId.value = null
            selectedTransitionId.value = null
            return true
        } catch (e) {
            console.error('Failed to load FSM:', e)
            return false
        }
    }

    // Get available template names
    const getAvailableTemplates = () => [
        { id: 'sequence_detector', name: 'Sequence Detector (101)', description: 'Mealy machine detecting pattern 101' },
        { id: 'traffic_light', name: 'Traffic Light Controller', description: 'Moore machine with 4 light states' },
        { id: 'counter_2bit', name: '2-Bit Counter', description: 'Moore machine counting 0-3' },
    ]

    return {
        // State
        currentFSM,
        isPanelVisible,
        selectedStateId,
        selectedTransitionId,
        isEditMode,

        // Computed
        selectedState,
        selectedTransition,
        canUndo,
        canRedo,

        // Actions
        createNewFSM,
        addState,
        removeState,
        updateState,
        addTransition,
        removeTransition,
        updateTransition,
        togglePanel,
        showPanel,
        hidePanel,
        selectState,
        selectTransition,
        setEncoding,
        clearFSM,

        // Undo/Redo
        undo,
        redo,
        clearHistory,

        // Templates
        loadTemplate,
        getAvailableTemplates,

        // Save/Load
        saveFSMToJSON,
        loadFSMFromJSON,
    }
})
