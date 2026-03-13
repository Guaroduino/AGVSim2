const fs = require('fs');
let file = fs.readFileSync('js/robotEditor.js', 'utf8');

// 1. Remove y_mm !== 0 guard in renderCustomSensorsList
file = file.replace(/if \(sym && sensor\.y_mm !== 0\) \{/g, 'if (sym) {');

// 2. Inject Normal IRs into Custom Sensor List
let insertTarget = \        currentGeometry.customSensors.forEach((sensor, idx) => {
            const sym = elems.horizontalSymmetryToggle ? elems.horizontalSymmetryToggle.checked : false;\;

let insertString = \        const sym = elems.horizontalSymmetryToggle ? elems.horizontalSymmetryToggle.checked : false;

        // --- INJECT NORMAL IRs INTO LIST (DISABLED) ---
        const offset = (currentGeometry.sensorOffset_m || 0) * 1000;
        const spread = (currentGeometry.sensorSpread_m || 0) * 1000;
        const count = currentGeometry.sensorCount || 3;
        
        let normalIRs = [];
        if (count === 2) normalIRs = [{label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. R', x: offset, y: spread}];
        else if (count === 3) normalIRs = [{label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. C', x: offset, y: 0}, {label: 'IR Nor. R', x: offset, y: spread}];
        else if (count === 4) normalIRs = [{label: 'IR Nor. fL', x: offset, y: -spread*2}, {label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. R', x: offset, y: spread}, {label: 'IR Nor. fR', x: offset, y: spread*2}];
        else if (count === 5) normalIRs = [{label: 'IR Nor. fL', x: offset, y: -spread*2}, {label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. C', x: offset, y: 0}, {label: 'IR Nor. R', x: offset, y: spread}, {label: 'IR Nor. fR', x: offset, y: spread*2}];
        else if (count === 6) normalIRs = [{label: 'IR Nor. ffL', x: offset, y: -spread*3}, {label: 'IR Nor. fL', x: offset, y: -spread*2}, {label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. R', x: offset, y: spread}, {label: 'IR Nor. fR', x: offset, y: spread*2}, {label: 'IR Nor. ffR', x: offset, y: spread*3}];
        else if (count === 7) normalIRs = [{label: 'IR Nor. ffL', x: offset, y: -spread*3}, {label: 'IR Nor. fL', x: offset, y: -spread*2}, {label: 'IR Nor. L', x: offset, y: -spread}, {label: 'IR Nor. C', x: offset, y: 0}, {label: 'IR Nor. R', x: offset, y: spread}, {label: 'IR Nor. fR', x: offset, y: spread*2}, {label: 'IR Nor. ffR', x: offset, y: spread*3}];
        else if (count === 8) normalIRs = [{label: 'IR Nor. ffL', x: offset, y: -spread*3.5}, {label: 'IR Nor. fL', x: offset, y: -spread*2.5}, {label: 'IR Nor. L', x: offset, y: -spread*1.5}, {label: 'IR Nor. cL', x: offset, y: -spread*0.5}, {label: 'IR Nor. cR', x: offset, y: spread*0.5}, {label: 'IR Nor. R', x: offset, y: spread*1.5}, {label: 'IR Nor. fR', x: offset, y: spread*2.5}, {label: 'IR Nor. ffR', x: offset, y: spread*3.5}];

        normalIRs.forEach((nir) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.gap = '5px';
            item.style.marginBottom = '5px';
            item.style.alignItems = 'center';
            item.style.opacity = '0.7';
            item.style.backgroundColor = '#eef';
            item.style.padding = '2px';
            item.style.borderRadius = '4px';
            
            item.innerHTML = \\\
                <span style="font-size:0.8em; min-width:60px; color:#555;">\\\:</span>
                <input type="number" value="\\\" placeholder="X (mm)" style="width: 60px; font-size: 0.8em;" disabled>
                <input type="number" value="\\\" placeholder="Y (mm)" style="width: 60px; font-size: 0.8em;" disabled>
                <div style="width: 20px;"></div>
            \\\;
            elems.customSensorsList.appendChild(item);
        });

        currentGeometry.customSensors.forEach((sensor, idx) => {\;

file = file.replace(insertTarget, insertString);

fs.writeFileSync('js/robotEditor.js', file);
console.log('done');
