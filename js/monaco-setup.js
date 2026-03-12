// Esquemas de código
const codeTemplates = {
    simpleOnOff: `void setup() {
  // put your setup code here, to run once:

}

void loop() {
  // put your main code here, to run repeatedly:

}`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    simpleOnOff: `🌟 <b>Nuevo Proyecto</b>\n\nEste es un lienzo en blanco para tu código de Arduino. \n\n<b>Pasos recomendados:</b>\n1. Configura tus pines en <code>setup()</code> usando <code>pinMode()</code>.\n2. Escribe tu lógica de control en <code>loop()</code>.\n3. Consulta la <b>Guía del Editor</b> de abajo para ver los pines según tu robot.`
};

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

let editor = null;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: codeTemplates.simpleOnOff, // Start with the single default template
        language: 'cpp', // Use C++ for basic syntax highlighting and native brace matching
        theme: 'vs',
        minimap: {
            enabled: false
        },
        automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        roundedSelection: false,
        readOnly: false,
        cursorStyle: 'line',
        selectOnLineNumbers: true,
        contextmenu: true,
        quickSuggestions: true,
        wordWrap: 'on'
    });

    // Make the editor instance available globally
    window.monacoEditor = editor;

    window.monacoEditor = editor;
});

// --- Descargar y cargar código desde archivo ---
document.getElementById('downloadCodeButton').addEventListener('click', function () {
    let code = '';
    if (window.monacoEditor && typeof window.monacoEditor.getValue === 'function') {
        code = window.monacoEditor.getValue();
    } else if (window.editor && typeof window.editor.getValue === 'function') {
        code = window.editor.getValue();
    }
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigo_robot.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
});

document.getElementById('uploadCodeInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        // Cambia el dropdown a 'custom' antes de cargar el código
        const templateSelect = document.getElementById('codeTemplate');
        if (templateSelect) templateSelect.value = 'custom';
        // Si hay un evento de cambio, disparemoslo para que el editor se actualice si es necesario
        if (templateSelect) {
            const event = new Event('change', { bubbles: true });
            templateSelect.dispatchEvent(event);
        }
        // Espera un pequeño tiempo para asegurar que el editor esté en modo custom
        setTimeout(function () {
            if (window.editor && typeof window.editor.setValue === 'function') {
                window.editor.setValue(evt.target.result);
            } else if (typeof editor !== 'undefined' && typeof editor.setValue === 'function') {
                editor.setValue(evt.target.result);
            }
        }, 100);
    };
    reader.readAsText(file);
});

// --- Cargar código de ejemplo ---
document.getElementById('loadExampleCodeButton').addEventListener('click', async function () {
    try {
        const response = await fetch('assets/robots/Codigo_Ejemplo.txt');
        if (!response.ok) throw new Error('No se pudo cargar Codigo_Ejemplo.txt');
        const text = await response.text();
        if (window.editor && typeof window.editor.setValue === 'function') {
            window.editor.setValue(text);
        } else if (typeof editor !== 'undefined' && typeof editor.setValue === 'function') {
            editor.setValue(text);
        }
    } catch (err) {
        console.error(err);
        alert('Error al cargar el código de ejemplo.');
    }
});

// Handle window resize
window.addEventListener('resize', function () {
    if (editor) {
        editor.layout();
    }
});