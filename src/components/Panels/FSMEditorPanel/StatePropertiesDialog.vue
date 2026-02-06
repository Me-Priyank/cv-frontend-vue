<template>
    <div v-if="isVisible" class="dialog-overlay" @click.self="close">
        <div class="dialog-box">
            <div class="dialog-header">
                <h3>State Properties</h3>
                <button class="close-btn" @click="close">×</button>
            </div>
            
            <div class="dialog-body">
                <div class="form-group">
                    <label>Label:</label>
                    <input v-model="localState.label" type="text" class="form-input" />
                </div>
                
                <div class="form-group">
                    <label>
                        <input v-model="localState.isInitial" type="checkbox" />
                        Initial State
                    </label>
                </div>
                
                <div class="form-group">
                    <label>
                        <input v-model="localState.isFinal" type="checkbox" />
                        Final State
                    </label>
                </div>
                
                <div class="form-group">
                    <label>Outputs (Moore):</label>
                    <div v-for="(value, key) in localState.outputs" :key="key" class="output-row">
                        <input v-model="localState.outputs[key]" type="number" min="0" max="1" class="form-input-small" />
                        <span>{{ key }}</span>
                    </div>
                </div>
            </div>
            
            <div class="dialog-footer">
                <button class="btn custom-btn--secondary" @click="close">Cancel</button>
                <button class="btn custom-btn--primary" @click="save">Save</button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import type { FSMState } from '../../../types/fsm'

const props = defineProps<{
    state: FSMState | null
}>()

const emit = defineEmits<{
    close: []
    save: [updates: Partial<FSMState>]
}>()

const isVisible = computed(() => props.state !== null)

const localState = ref({
    label: '',
    isInitial: false,
    isFinal: false,
    outputs: {} as Record<string, number>
})

watch(() => props.state, (newState) => {
    if (newState) {
        localState.value = {
            label: newState.label,
            isInitial: newState.isInitial,
            isFinal: newState.isFinal,
            outputs: { ...newState.outputs }
        }
    }
}, { immediate: true })

function close() {
    emit('close')
}

function save() {
    emit('save', localState.value)
}
</script>

<style scoped>
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.dialog-box {
    background: white;
    border-radius: 8px;
    width: 400px;
    max-width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
}

.dialog-header h3 {
    margin: 0;
    font-size: 18px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
}

.close-btn:hover {
    color: #333;
}

.dialog-body {
    padding: 20px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 14px;
}

.form-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.form-input-small {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
}

.output-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #eee;
}

.btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.custom-btn--secondary {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
}

.custom-btn--secondary:hover {
    background: #e0e0e0;
}

.custom-btn--primary {
    background: #27ae60;
    color: white;
}

.custom-btn--primary:hover {
    background: #219150;
}
</style>
