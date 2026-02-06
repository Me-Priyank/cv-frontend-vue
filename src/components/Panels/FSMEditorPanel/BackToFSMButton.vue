<template>
    <button 
        v-if="showButton" 
        class="back-to-fsm-btn" 
        @click="goBack"
        title="Back to FSM Editor"
    >
        <i class="fas fa-arrow-left"></i> Back to FSM
    </button>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { switchBackToFSM, getStoredFSMScopeId } from '../../../simulator/src/fsmMode'
import { useSimulatorMobileStore } from '../../../store/simulatorMobileStore'

const simulatorMobileStore = useSimulatorMobileStore()

// Reactive check for stored FSM scope
const hasStoredScope = ref(false)

// Update the check periodically and on mount
function checkStoredScope() {
    hasStoredScope.value = getStoredFSMScopeId() !== null
}

let intervalId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    checkStoredScope()
    // Check every 500ms for scope changes
    intervalId = setInterval(checkStoredScope, 500)
})

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId)
    }
})

const showButton = computed(() => {
    // Show only if:
    // 1. Not currently in FSM mode
    // 2. We have a stored FSM scope to go back to
    return !simulatorMobileStore.isFSM && hasStoredScope.value
})

function goBack() {
    switchBackToFSM()
    simulatorMobileStore.isFSM = true
    hasStoredScope.value = false
}
</script>

<style scoped>
.back-to-fsm-btn {
    position: fixed;
    top: 50px;
    left: 20px;
    z-index: 1000;
    padding: 10px 18px;
    background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
}

.back-to-fsm-btn:hover {
    background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.35);
}

.back-to-fsm-btn:active {
    transform: translateY(0);
}

.back-to-fsm-btn i {
    font-size: 14px;
}
</style>
