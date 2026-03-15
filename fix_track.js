const fs = require('fs');
let code = fs.readFileSync('js/trackEditor.js', 'utf8');

// Add helper functions
const drawLogic = 
function drawInteractiveElements(targetCtx, scaleRatio) {
    interactiveElements.forEach(el => {
        targetCtx.save();
        
        // El.x and el.y are in TRACK_PART_SIZE_PX scale space
        const x = el.x * scaleRatio;
        const y = el.y * scaleRatio;
        const w = el.width * scaleRatio;
        const h = el.height * scaleRatio;
        const cx = x + w / 2;
        const cy = y + h / 2;
        
        targetCtx.translate(cx, cy);
        if (el.rotation) {
            targetCtx.rotate(el.rotation * Math.PI / 180);
        }
        
        if (el.type === 'color') {
            targetCtx.fillStyle = el.color || '#0000ff';
            targetCtx.fillRect(-w/2, -h/2, w, h);
            targetCtx.strokeStyle = 'white';
            targetCtx.lineWidth = 2 * scaleRatio;
            targetCtx.strokeRect(-w/2, -h/2, w, h);
        } else if (el.type === 'rfid') {
            targetCtx.fillStyle = 'rgba(200, 200, 200, 0.8)';
            targetCtx.fillRect(-w/2, -h/2, w, h);
            targetCtx.strokeStyle = '#333';
            targetCtx.lineWidth = 2 * scaleRatio;
            targetCtx.strokeRect(-w/2, -h/2, w, h);
            targetCtx.fillStyle = 'black';
            targetCtx.font = \\px Arial\;
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(\RFID:\\, 0, 0);
        } else if (el.type === 'hopper') {
            targetCtx.fillStyle = 'rgba(139, 69, 19, 0.8)';
            targetCtx.fillRect(-w/2, -h/2, w, h);
            targetCtx.strokeStyle = '#fff';
            targetCtx.beginPath();
            targetCtx.moveTo(-w/2, -h/2);
            targetCtx.lineTo(w/2, h/2);
            targetCtx.moveTo(w/2, -h/2);
            targetCtx.lineTo(-w/2, h/2);
            targetCtx.stroke();
        }
        
        // Highlight if selected AND we are drawing on the editor (scaleRatio !== 1 ideally, but just checking selectedInteractiveElement)
        if (selectedInteractiveElement && selectedInteractiveElement.id === el.id) {
            targetCtx.strokeStyle = 'cyan';
            targetCtx.lineWidth = 3 * scaleRatio;
            targetCtx.setLineDash([5 * scaleRatio, 5 * scaleRatio]);
            targetCtx.strokeRect(-w/2 - 2*scaleRatio, -h/2 - 2*scaleRatio, w + 4*scaleRatio, h + 4*scaleRatio);
            targetCtx.setLineDash([]);
        }
        
        targetCtx.restore();
    });
}
;

// Insert draw logic before function exportTrackAsCanvas
code = code.replace("function exportTrackAsCanvas()", drawLogic + "\nfunction exportTrackAsCanvas()");

// Patch renderEditor to call draw logic
code = code.replace(
    /if \(AVAILABLE_TRACK_PARTS\.length === 0/g,
    "drawInteractiveElements(ctx, cellSize / TRACK_PART_SIZE_PX);\n\n    if (AVAILABLE_TRACK_PARTS.length === 0"
);

// Patch exportTrackAsCanvas to call draw logic
code = code.replace(
    /if \(!hasContent\)/g,
    // Add draw calls before returning exportCanvas
    "drawInteractiveElements(exportCtx, 1);\n\n    if (!hasContent && interactiveElements.length === 0)"
);

// Modify onGridSingleClick heavily
const clickLogicOld = const scale = editorCanvas.width / actualWidth;
    const x_canvas = x_relative * scale;
    const y_canvas = y_relative * scale;

    // Calculate cell size dynamically
    const cellSize = editorCanvas.width / Math.max(currentGridSize.rows, currentGridSize.cols);

    const c = Math.floor(x_canvas / cellSize);
    const r = Math.floor(y_canvas / cellSize);;

const clickLogicNew = const scale = editorCanvas.width / actualWidth;
    const x_canvas = x_relative * scale;
    const y_canvas = y_relative * scale;
    
    const exportScale = (currentGridSize.cols * TRACK_PART_SIZE_PX) / editorCanvas.width;
    const p_x = x_canvas * exportScale;
    const p_y = y_canvas * exportScale;

    // --- INTERACTIVE ELEMENTS LOGIC --- 
    if (currentToolMode && currentToolMode !== 'erase' && (!event.detail || event.detail === 1)) {
        const elems = getDOMElements();
        let w = parseFloat(elems?.intSettWidth?.value) || 100;
        let h = parseFloat(elems?.intSettLength?.value) || 100;
        let val = parseInt(elems?.intSettValue?.value) || 0;
        let col = elems?.intSettColor?.value || '#0000ff';

        interactiveElements.push({
            id: Date.now() + Math.floor(Math.random()*1000),
            type: currentToolMode,
            x: p_x - w/2, 
            y: p_y - h/2,
            width: w,
            height: h,
            value: val,
            color: col,
            rotation: 0
        });

        selectedInteractiveElement = interactiveElements[interactiveElements.length-1];
        document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
        selectedTrackPart = null;

        renderEditor();
        return; 
    }

    // Si damos click normal y no hay herramienta activa, ver si seleccionamos un elemento.
    if (!currentToolMode && (!event.detail || event.detail === 1)) {
        let found = null;
        for(let i = interactiveElements.length-1; i>=0; i--) {
            let e = interactiveElements[i];
            if (p_x >= e.x && p_x <= e.x + e.width && p_y >= e.y && p_y <= e.y + e.height) {
                found = e; break;
            }
        }
        if (found) {
            selectedInteractiveElement = found;
            const elems = getDOMElements();
            if (elems) {
                 if (elems.intSettWidth) elems.intSettWidth.value = found.width;
                 if (elems.intSettLength) elems.intSettLength.value = found.height;
                 if (elems.intSettValue) elems.intSettValue.value = found.value || 0;
                 if (elems.intSettColor) elems.intSettColor.value = found.color || '#0000ff';
                 updateInteractiveUI(found.type, elems);
            }
            renderEditor();
            return;
        } else {
            selectedInteractiveElement = null; // deselect
            renderEditor();
        }
    }
    // --- FIN LÓGICA INTERACTIVA ---

    // Calculate cell size dynamically
    const cellSize = editorCanvas.width / Math.max(currentGridSize.rows, currentGridSize.cols);

    const c = Math.floor(x_canvas / cellSize);
    const r = Math.floor(y_canvas / cellSize);;

code = code.replace(clickLogicOld, clickLogicNew);


// Modify onGridDoubleClick heavily
const dbClickLogicOld = const scale = editorCanvas.width / actualWidth;
    const x_canvas = x_relative * scale;
    const y_canvas = y_relative * scale;

    const r = Math.floor(y_canvas / cellSize);;

const dbClickLogicNew = const scale = editorCanvas.width / actualWidth;
    const x_canvas = x_relative * scale;
    const y_canvas = y_relative * scale;

    const exportScale = (currentGridSize.cols * TRACK_PART_SIZE_PX) / editorCanvas.width;
    const p_x = x_canvas * exportScale;
    const p_y = y_canvas * exportScale;

    // Double click logic for interactive elements
    let clickedElementIndex = -1;
    for(let i = interactiveElements.length-1; i>=0; i--) {
        let e = interactiveElements[i];
        if (p_x >= e.x && p_x <= e.x + e.width && p_y >= e.y && p_y <= e.y + e.height) {
            clickedElementIndex = i; break;
        }
    }

    if (clickedElementIndex >= 0) {
        if (currentToolMode === 'erase') {
            // Delete
            if (selectedInteractiveElement && selectedInteractiveElement.id === interactiveElements[clickedElementIndex].id) {
                selectedInteractiveElement = null;
            }
            interactiveElements.splice(clickedElementIndex, 1);
            console.log("Element deleted");
        } else {
            // Rotate 90 deg
            interactiveElements[clickedElementIndex].rotation = ((interactiveElements[clickedElementIndex].rotation || 0) + 90) % 360;
        }
        renderEditor();
        return;
    }

    // Default double click rotation for tracks
    const cellSize = editorCanvas.width / Math.max(currentGridSize.rows, currentGridSize.cols);
    const c = Math.floor(x_canvas / cellSize);
    const r = Math.floor(y_canvas / cellSize);;

code = code.replace(dbClickLogicOld, dbClickLogicNew);

// Find "let selectedInteractiveElement = null;" to make sure it's exported or globally accessible in the file.
fs.writeFileSync('js/trackEditor.js', code);
console.log("Done");
