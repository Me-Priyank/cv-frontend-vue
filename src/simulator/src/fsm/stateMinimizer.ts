/**
 * State Minimization using Hopcroft's Algorithm
 * Reduces equivalent states in FSM to minimize circuit complexity
 * 
 * Time Complexity: O(n log n) where n is the number of states
 */

import type { FSMDefinition, FSMState, FSMTransition } from '../../../types/fsm'

/**
 * Partition-based state minimizer using Hopcroft's algorithm
 */
export class StateMinimizer {
    private fsm: FSMDefinition
    private partitions: Set<string>[] = []
    private stateToPartition: Map<string, number> = new Map()

    constructor(fsm: FSMDefinition) {
        this.fsm = fsm
    }

    /**
     * Minimize the FSM and return a new FSM with equivalent states merged
     */
    minimize(): FSMDefinition {
        if (this.fsm.states.length <= 1) {
            return this.fsm
        }

        // Step 1: Initial partition by output behavior
        this.initialPartition()

        // Step 2: Iteratively refine partitions
        let changed = true
        let iterations = 0
        const maxIterations = 100

        while (changed && iterations < maxIterations) {
            changed = this.refinePartitions()
            iterations++
        }

        // Step 3: Build minimized FSM
        return this.buildMinimizedFSM()
    }

    /**
     * Step 1: Create initial partitions based on output behavior
     * For Moore machines: states with same outputs are in same partition
     * For Mealy machines: all states start in single partition (will be refined by transitions)
     */
    private initialPartition(): void {
        if (this.fsm.type === 'MOORE') {
            // Group states by their output values
            const outputGroups = new Map<string, Set<string>>()

            for (const state of this.fsm.states) {
                const outputKey = JSON.stringify(state.outputs || {})
                if (!outputGroups.has(outputKey)) {
                    outputGroups.set(outputKey, new Set())
                }
                outputGroups.get(outputKey)!.add(state.id)
            }

            this.partitions = Array.from(outputGroups.values())
        } else {
            // Mealy: start with all states in one partition
            // Will be refined based on transition outputs
            const allStates = new Set(this.fsm.states.map(s => s.id))
            this.partitions = [allStates]
        }

        // Update state-to-partition mapping
        this.updateStateToPartition()
    }

    /**
     * Update the mapping from state to partition index
     */
    private updateStateToPartition(): void {
        this.stateToPartition.clear()
        for (let i = 0; i < this.partitions.length; i++) {
            for (const stateId of this.partitions[i]) {
                this.stateToPartition.set(stateId, i)
            }
        }
    }

    /**
     * Step 2: Refine partitions based on transition behavior
     * Two states are distinguishable if they transition to different partitions
     */
    private refinePartitions(): boolean {
        let changed = false
        const newPartitions: Set<string>[] = []

        for (const partition of this.partitions) {
            if (partition.size <= 1) {
                newPartitions.push(partition)
                continue
            }

            // Try to split this partition
            const subGroups = this.splitPartition(partition)

            if (subGroups.length > 1) {
                changed = true
            }

            newPartitions.push(...subGroups)
        }

        this.partitions = newPartitions
        this.updateStateToPartition()

        return changed
    }

    /**
     * Split a partition into sub-groups based on transition signatures
     */
    private splitPartition(partition: Set<string>): Set<string>[] {
        const signatureGroups = new Map<string, Set<string>>()

        for (const stateId of partition) {
            const signature = this.getTransitionSignature(stateId)

            if (!signatureGroups.has(signature)) {
                signatureGroups.set(signature, new Set())
            }
            signatureGroups.get(signature)!.add(stateId)
        }

        return Array.from(signatureGroups.values())
    }

    /**
     * Get a signature string representing transition behavior
     * This identifies which partitions a state transitions to for each input
     */
    private getTransitionSignature(stateId: string): string {
        const signatures: string[] = []
        const inputCombos = this.getInputCombinations()

        for (const inputs of inputCombos) {
            const transition = this.findTransition(stateId, inputs)

            if (transition) {
                const targetPartition = this.stateToPartition.get(transition.to) ?? -1

                // For Mealy machines, include output in signature
                if (this.fsm.type === 'MEALY') {
                    const outputKey = JSON.stringify(transition.outputs || {})
                    signatures.push(`${targetPartition}:${outputKey}`)
                } else {
                    signatures.push(`${targetPartition}`)
                }
            } else {
                signatures.push('-1') // No transition
            }
        }

        return signatures.join('|')
    }

    /**
     * Find transition from state for given inputs
     */
    private findTransition(stateId: string, inputs: Record<string, number>): FSMTransition | null {
        for (const transition of this.fsm.transitions) {
            if (transition.from === stateId) {
                let matches = true
                for (const [key, value] of Object.entries(inputs)) {
                    if (transition.inputs[key] !== value) {
                        matches = false
                        break
                    }
                }
                if (matches) {
                    return transition
                }
            }
        }
        return null
    }

    /**
     * Generate all possible input combinations
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
     * Step 3: Build minimized FSM from partitions
     */
    private buildMinimizedFSM(): FSMDefinition {
        // Create representative state for each partition
        const newStates: FSMState[] = []
        const partitionRepresentative = new Map<number, string>()
        const oldToNewState = new Map<string, string>()

        for (let i = 0; i < this.partitions.length; i++) {
            const partition = this.partitions[i]
            const stateIds = Array.from(partition)

            // Use first state as representative
            const representative = stateIds[0]
            const originalState = this.fsm.states.find(s => s.id === representative)!

            // Create merged state name
            const mergedName = stateIds.length > 1
                ? `${stateIds.join('_')}`
                : representative

            const newState: FSMState = {
                id: mergedName,
                label: mergedName,
                isInitial: stateIds.some(id => id === this.fsm.initialState),
                isFinal: stateIds.some(id => this.fsm.states.find(s => s.id === id)?.isFinal),
                position: originalState.position,
                outputs: originalState.outputs
            }

            newStates.push(newState)
            partitionRepresentative.set(i, mergedName)

            // Map all old states to new state
            for (const oldId of stateIds) {
                oldToNewState.set(oldId, mergedName)
            }
        }

        // Create transitions using representatives
        const newTransitions: FSMTransition[] = []
        const transitionSet = new Set<string>()

        for (const transition of this.fsm.transitions) {
            const newFrom = oldToNewState.get(transition.from)!
            const newTo = oldToNewState.get(transition.to)!

            const transitionKey = `${newFrom}-${JSON.stringify(transition.inputs)}-${newTo}`

            if (!transitionSet.has(transitionKey)) {
                transitionSet.add(transitionKey)

                newTransitions.push({
                    id: `T${newTransitions.length}`,
                    from: newFrom,
                    to: newTo,
                    inputs: transition.inputs,
                    outputs: transition.outputs,
                    label: transition.label
                })
            }
        }

        // Find new initial state
        const newInitialState = oldToNewState.get(this.fsm.initialState) || newStates[0].id

        return {
            ...this.fsm,
            states: newStates,
            transitions: newTransitions,
            initialState: newInitialState
        }
    }

    /**
     * Get statistics about minimization
     */
    getMinimizationStats(): { originalStates: number; minimizedStates: number; reduction: number } {
        return {
            originalStates: this.fsm.states.length,
            minimizedStates: this.partitions.length,
            reduction: this.fsm.states.length - this.partitions.length
        }
    }
}

/**
 * Convenience function to minimize an FSM
 */
export function minimizeFSM(fsm: FSMDefinition): {
    minimizedFSM: FSMDefinition
    originalStates: number
    minimizedStates: number
    statesReduced: number
} {
    const minimizer = new StateMinimizer(fsm)
    const minimizedFSM = minimizer.minimize()
    const stats = minimizer.getMinimizationStats()

    return {
        minimizedFSM,
        originalStates: stats.originalStates,
        minimizedStates: stats.minimizedStates,
        statesReduced: stats.reduction
    }
}
