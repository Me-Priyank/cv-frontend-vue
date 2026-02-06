<template>
    <div class="fsm-test-page">
        <h1>FSM Editor Test</h1>
        <p>Testing the FSM to Circuit Synthesizer</p>
        
        <FSMEditorPanel />
    </div>
</template>

<script lang="ts" setup>
import FSMEditorPanel from '../components/Panels/FSMEditorPanel/FSMEditorPanel.vue'
</script>

<style scoped>
.fsm-test-page {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

h1 {
    margin-bottom: 10px;
}

p {
    color: #666;
    margin-bottom: 30px;
}
</style>
