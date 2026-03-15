const fs = require('fs');
let c = fs.readFileSync('js/ui.js', 'utf8');

c = c.replace(/intSettLabel[^}]*/, "intSettWidth: document.getElementById('intSettWidth'),\n        intSettLength: document.getElementById('intSettLength'),\n        lblIntVal: document.getElementById('lblIntVal'),\n        intSettValue: document.getElementById('intSettValue'),\n        lblIntColor: document.getElementById('lblIntColor'),\n        intSettColor: document.getElementById('intSettColor')\n    };\n");

fs.writeFileSync('js/ui.js', c);
