<template>
    <div v-if="isVisible" class="dialog-overlay" @click.self="close">
        <div class="dialog-box">
            <div class="dialog-header">
                <h3>Transition Properties</h3>
                <button class="close-btn" @click="close">×</button>
            </div>
            
            <div class="dialog-body">
                <div class="form-group">
                    <label>Inputs:</label>
                    <div v-for="(value, key) in localTransition.inputs" :key="key" class="input-row">
                        <span class="input-name">{{ key }}:</span>
                        <input 
                            v-model="localTransition.inputs[key]" 
                            type="number" 
                            min="0" 
                            max="1" 
                            class="form-input-small" 
                        />
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Outputs (Mealy):</label>
                    <div v-if="localTransition.outputs">
                        <div v-for="(value, key) in localTransition.outputs" :key="key" class="output-row">
                            <span class="output-name">{{ key }}:</span>
                            <input 
                                v-model="localTransition.outputs[key]" 
                                type="number" 
                                min="0" 
                                max="1" 
                                class="form-input-small" 
                            />
                        </div>
                    </div>
                    <p v-else class="hint-text">Outputs only for Mealy machines</p>
                </div>
                
                <div class="form-group">
                    <label>Custom Label (optional):</label>
                    <input v-model="localTransition.label" type="text" class="form-input" placeholder="e.g., X=1" />
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
import type { FSMTransition } from '../../../types/fsm'

const props = defineProps<{
    transition: FSMTransition | null
}>()

const emit = defineEmits<{
    close: []
    save: [updates: Partial<FSMTransition>]
}>()

const isVisible = computed(() => props.transition !== null)

const localTransition = ref({
    inputs: {} as Record<string, number | string>,
    outputs: undefined as Record<string, number> | undefined,
    label: ''
})

watch(() => props.transition, (newTransition) => {
    if (newTransition) {
        localTransition.value = {
            inputs: { ...newTransition.inputs },
            outputs: newTransition.outputs ? { ...newTransition.outputs } : undefined,
            label: newTransition.label || ''
        }
    }
}, { immediate: true })

function close() {
    emit('close')
}

function save() {
    emit('save', localTransition.value)
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

.input-row,
.output-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.input-name,
.output-name {
    font-weight: 500;
    min-width: 60px;
}

.hint-text {
    font-size: 13px;
    color: #999;
    font-style: italic;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #eee;
}
</style>
