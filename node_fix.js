const fs = require('fs');
let file = fs.readFileSync('js/robot.js', 'utf8');

// The replacement: adding isRGB, isRFID, customIdx, mapping variables
let target = \              let numP = 1;
              let isIR = true;
              let isToF = false;
              let isLED = false;
              let ledColor = '#ff0000';
              let tofIdx = -1;
              let tofAngle = 0;
              if (key.startsWith('custom_')) {\;

let repl = \              let currentDrawRadiusPx = sensorRadiusPx;

              let numP = 1;
              let isIR = true;
              let isToF = false;
              let isLED = false;
              let isRGB = false;
              let isRFID = false;
              let ledColor = '#ff0000';
              let customIdx = -1;
              let tofIdx = -1;
              let tofAngle = 0;
              
              if (key.startsWith('custom_')) {
                  currentDrawRadiusPx = Math.max(3, 0.005 * PIXELS_PER_METER); // 10mm fixed default for custom IRs vs global size
\;

file = file.replace(target, repl);

let target2 = \                      if (cSens.type === 'led') {
                          isLED = true;
                          ledColor = cSens.color || '#ff0000';
                      }
                  }
              }\;

let repl2 = \                      if (cSens.type === 'led') {
                          isLED = true;
                          ledColor = cSens.color || '#ff0000';
                      }
                      if (cSens.type === 'rgb') isRGB = true;
                      if (cSens.type === 'rfid') isRFID = true;
                      
                      // Overwrite radius if it has a explicit param
                      if (cSens.detectionDiameter) {
                          currentDrawRadiusPx = Math.max(2, (parseFloat(cSens.detectionDiameter) / 1000 / 2) * PIXELS_PER_METER);
                      }
                      
                      customIdx = idx;
                  }
              }\;

file = file.replace(target2, repl2);

let drawBlockStart = file.indexOf('ctx.save();', file.indexOf('if (key.startsWith(\\'custom_\\')'));
let strToFix = file.substring(drawBlockStart, file.indexOf('let pinNumber', drawBlockStart));
strToFix = strToFix.replace(/sensorRadiusPx/g, 'currentDrawRadiusPx');

let fallbackTarget = \              } else {
                  ctx.beginPath();
                  ctx.arc(0, 0, currentDrawRadiusPx, 0, 2 * Math.PI);
                  ctx.fillStyle = isOnLine ? 'lime' : 'gray';
                  ctx.fill();
                  ctx.strokeStyle = 'black';
                  ctx.lineWidth = 1;
                  ctx.stroke();
              }
              ctx.restore();\;

let fallbackRepl = \              } else if (isRGB || isRFID) {
                  // Dashed circle for detection radius (in currentDrawRadiusPx)
                  ctx.beginPath();
                  ctx.arc(0, 0, currentDrawRadiusPx, 0, 2 * Math.PI);
                  ctx.strokeStyle = isRGB ? 'blue' : 'purple';
                  ctx.setLineDash([4, 4]);
                  ctx.stroke();
                  ctx.setLineDash([]); // reset dash

                  // Rectangle for the sensor body
                  ctx.fillStyle = 'white';
                  ctx.strokeStyle = 'black';
                  ctx.lineWidth = 1;
                  const rw = 40; // rectangle width
                  const rh = 16;
                  ctx.fillRect(-rw/2, -rh/2, rw, rh);
                  ctx.strokeRect(-rw/2, -rh/2, rw, rh);

                  // Text inside
                  ctx.fillStyle = 'black';
                  ctx.font = 'bold 9px Arial';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(\\\\\\\\, 0, 0);

              } else {
                  ctx.beginPath();
                  ctx.arc(0, 0, currentDrawRadiusPx, 0, 2 * Math.PI);
                  ctx.fillStyle = isOnLine ? 'lime' : 'gray';
                  ctx.fill();
                  ctx.strokeStyle = 'black';
                  ctx.lineWidth = 1;
                  ctx.stroke();
              }
              ctx.restore();\;

strToFix = strToFix.replace(fallbackTarget, fallbackRepl);

file = file.substring(0, drawBlockStart) + strToFix + file.substring(file.indexOf('let pinNumber', drawBlockStart));

fs.writeFileSync('js/robot.js', file);
