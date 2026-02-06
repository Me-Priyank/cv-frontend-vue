/**
 * FSM Mode Controller
 * Similar to Verilog2CV's verilogModeSet pattern
 * Controls the FSM Editor tab-based view
 */

import { createNewCircuitScope, switchCircuit } from './circuit'
import { simulationArea } from './simulationArea'
import { showProperties } from './ux'

// Access globals from window (set by simulator)
declare const globalScope: any
declare const embed: boolean | undefined

let fsmMode = false
let previousScopeId: string | null = null

/**
 * Get current FSM mode state
 */
export function fsmModeGet(): boolean {
    return fsmMode
}

/**
 * Set FSM mode and toggle UI visibility
 * @param mode - true to enter FSM editor mode, false to exit
 */
export function fsmModeSet(mode: boolean): void {
    console.log('fsmModeSet called with mode:', mode, 'current fsmMode:', fsmMode)
    if (mode === fsmMode) return
    fsmMode = mode

    if (mode) {
        // Entering FSM mode - show FSM editor, hide circuit panels
        const fsmEditorTab = document.getElementById('fsm-editor-tab')
        console.log('FSM editor tab element:', fsmEditorTab)
        if (fsmEditorTab) {
            fsmEditorTab.style.display = 'flex'
            console.log('Set fsm-editor-tab display to flex')
        }

        // Hide element panel (circuit components)
        const elementPanel = document.querySelector('.elementPanel') as HTMLElement
        if (elementPanel) {
            elementPanel.style.display = 'none'
        }

        // Hide timing diagram panel
        const timingDiagramPanel = document.querySelector('.timing-diagram-panel') as HTMLElement
        if (timingDiagramPanel) {
            timingDiagramPanel.style.display = 'none'
        }

        // Hide quick button
        const quickBtn = document.querySelector('.quick-btn') as HTMLElement
        if (quickBtn) {
            quickBtn.style.display = 'none'
        }

        // Hide the old FSM overlay panel if visible
        const fsmOverlayPanel = document.getElementById('fsmEditorPanel')
        if (fsmOverlayPanel) {
            fsmOverlayPanel.style.display = 'none'
        }

        // Note: isFSM store value updated from Vue component

        // Update properties panel
        if (typeof embed === 'undefined' || !embed) {
            simulationArea.lastSelected = globalScope.root
            showProperties(undefined)
            showProperties(simulationArea.lastSelected)
        }
    } else {
        // Exiting FSM mode - hide FSM editor, restore circuit panels
        const fsmEditorTab = document.getElementById('fsm-editor-tab')
        if (fsmEditorTab) {
            fsmEditorTab.style.display = 'none'
        }

        // Show element panel
        const elementPanel = document.querySelector('.elementPanel') as HTMLElement
        if (elementPanel) {
            elementPanel.style.display = ''
        }

        // Show timing diagram panel
        const timingDiagramPanel = document.querySelector('.timing-diagram-panel') as HTMLElement
        if (timingDiagramPanel) {
            timingDiagramPanel.style.display = ''
        }

        // Show quick button
        const quickBtn = document.querySelector('.quick-btn') as HTMLElement
        if (quickBtn) {
            quickBtn.style.display = ''
        }

        // Note: isFSM store value updated from Vue component
    }
}

/**
 * Create a new FSM circuit tab
 * Called when user clicks "FSM Editor" in the menu
 */
export async function createFSMCircuit(): Promise<boolean> {
    // Create new circuit scope for FSM
    const returned = await createNewCircuitScope(
        undefined,  // name (will be prompted)
        undefined,  // scope
        true,       // prompt for name
        true        // restrict to close
    )

    if (returned) {
        // Mark this scope as FSM type
        globalScope.fsmMetadata = {
            isFSM: true,
            fsmData: null
        }

        // Enter FSM mode
        fsmModeSet(true)

        return true
    }

    return false
}

/**
 * Exit FSM mode and return to normal circuit view
 */
export function exitFSMMode(): void {
    fsmModeSet(false)
}

/**
 * Check if current scope is an FSM scope
 */
export function isCurrentScopeFSM(): boolean {
    return globalScope?.fsmMetadata?.isFSM === true
}

/**
 * Store current scope before synthesizing
 */
export function storeFSMScopeId(): void {
    previousScopeId = globalScope?.id || null
}

/**
 * Get stored FSM scope ID
 */
export function getStoredFSMScopeId(): string | null {
    return previousScopeId
}

/**
 * Switch back to FSM scope after viewing synthesized circuit
 */
export function switchBackToFSM(): void {
    if (previousScopeId) {
        switchCircuit(previousScopeId)
        fsmModeSet(true)
    }
}
