const fs = require('fs');
let code = fs.readFileSync('js/robotEditor.js', 'utf8');

const target1 = /\s*const sym = elems\.horizontalSymmetryToggle \? elems\.horizontalSymmetryToggle\.checked : false;\s*currentGeometry\.customSensors\.forEach\(\(sensor, idx\) => \{\s*const sym = elems\.horizontalSymmetryToggle \? elems\.horizontalSymmetryToggle\.checked : false;/g;

code = code.replace(target1, `
        currentGeometry.customSensors.forEach((sensor, idx) => {
`);

const target2 = /let cloneItem = null;[\s\S]*?if \(sym\) \{[\s\S]*?cloneItem = createSensorRow\(true\);[\s\S]*?elems\.customSensorsList\.appendChild\(cloneItem\);[\s\S]*?\}/g;

code = code.replace(target2, `let cloneItem = null;
            if (sensor.symmetric) {
                cloneItem = createSensorRow(true);
                elems.customSensorsList.appendChild(cloneItem);
            }`);

const target3 = /\$\{extraHTML\}\s*\$\{\!isClone \? \`<button type=\"button\" class=\"delCustomSensorBtn\"/g;

code = code.replace(target3, `\${extraHTML}
                    \${!isClone ? \`<label style="font-size: 0.8em; display:flex; align-items:center; cursor:pointer;" title="Simétrico atrás"><input type="checkbox" id="customSensorSym_\${idx}" \${sensor.symmetric ? 'checked' : ''} style="margin-right:2px; transform: scale(0.9);"> Sym</label><button type="button" class="delCustomSensorBtn"\`);


const target4 = /if \(sym && newX < 0\)/g;
code = code.replace(target4, 'if (sensor.symmetric && newX < 0)');

const target5 = /const inY = mainItem\.querySelector\(\`#customSensorY_\$\{idx\}\`\);/;
code = code.replace(target5, `const inY = mainItem.querySelector(\`#customSensorY_\${idx}\`);
            const inSym = mainItem.querySelector(\`#customSensorSym_\${idx}\`);`);

const target6 = /inY\.addEventListener\('input', updateVal\);/;
code = code.replace(target6, `inY.addEventListener('input', updateVal);
            if (inSym) {
                inSym.addEventListener('change', (e) => {
                    currentGeometry.customSensors[idx].symmetric = e.target.checked;
                    updateVal(); // Recalculate clamps
                    window.renderCustomSensorsList();
                    if(typeof updateSensorConnectionsUI === 'function') updateSensorConnectionsUI(currentGeometry.sensorCount);
                    window.forceGeometrySync();
                });
            }`);

fs.writeFileSync('js/robotEditor.js', code);
console.log('done regexing js');
