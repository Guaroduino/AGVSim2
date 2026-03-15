const fs = require('fs');
let t = fs.readFileSync('index.html', 'utf8');

const regex = /<div style="font-weight: bold; margin-bottom: 8px;">Panel de Control:<\/div>\s*<label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">\s*<span>Pantalla activa \(OLED I2C\):<\/span>\s*<input type="checkbox" id="panelScreenToggle" style="width: auto; margin: 0; cursor: pointer;">\s*<\/label>\s*<label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">\s*<span>N.* Botones en Panel:<\/span>\s*<select id="panelButtonCount" style="width: auto; margin: 0;">\s*<option value="0" selected>0<\/option>\s*<option value="1">1<\/option>\s*<option value="2">2<\/option>\s*<option value="3">3<\/option>\s*<option value="4">4<\/option>\s*<\/select>\s*<\/label>/;

const replacement = '<div style="font-weight: bold; margin-bottom: 8px;">Panel de Control:</div>\n<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">\n    <label style="display: flex; align-items: center; gap: 8px; margin: 0; cursor: pointer;">\n        <span>Pantalla (OLED):</span>\n        <input type="checkbox" id="panelScreenToggle" style="width: auto; margin: 0; cursor: pointer;">\n    </label>\n    <label style="display: flex; align-items: center; gap: 8px; margin: 0;">\n        <span>Nro. Botones:</span>\n        <select id="panelButtonCount" style="width: auto; margin: 0;">\n            <option value="0" selected>0</option>\n            <option value="1">1</option>\n            <option value="2">2</option>\n            <option value="3">3</option>\n            <option value="4">4</option>\n        </select>\n    </label>\n</div>';

t = t.replace(regex, replacement);
fs.writeFileSync('index.html', t);
console.log('Done!');
