// js/simulation.js (Simulation Engine)
import { Robot } from './robot.js';
// PIDController is not used here if PID is in user code.
// import { PIDController } from './pidController.js';
import { Track } from './track.js';
import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY } from './config.js';
import { LapTimer } from './lapTimer.js';

export class Simulation {
    constructor(robotImages, watermarkImage, initialGeometry = DEFAULT_ROBOT_GEOMETRY) {
        this.robot = new Robot(0, 0, 0, initialGeometry); // Initial position set by loadTrack
        this.robotVisible = false; // <--- Robot oculto por defecto
        if (robotImages) this.robot.setImages(robotImages.wheel);

        // Ensure robot geometry is valid
        if (!this.robot.length_m || isNaN(this.robot.length_m)) {
            this.robot.length_m = 0.15; // Default length in meters
        }
        if (!this.robot.wheelbase_m || isNaN(this.robot.wheelbase_m)) {
            this.robot.wheelbase_m = 0.1; // Default wheelbase in meters
        }

        this.track = new Track();
        if (watermarkImage) this.track.setWatermark(watermarkImage);

        this.lapTimer = new LapTimer(this.robot.wheelbase_m, this.robot.length_m);

        this.params = {
            timeStep: 0.02, // Corresponds to user code delay(20) for ~50 FPS
            maxRobotSpeedMPS: 0.5, // Max physical speed robot can achieve at 255 PWM
            motorEfficiency: 0.85, // Factor reducing max speed
            motorImbalance: 0.0, // Differencial imbalance factor (-0.5 to 0.5)
            motorResponseFactor: 0.1, // How quickly motors reach target speed (0-1, higher is faster)
            sensorNoiseProb: 0.0, // Probability (0-1) of a sensor flipping its reading
            movementPerturbFactor: 0.0, // Random perturbation to movement (0-1)
            motorDeadbandPWM: 10, // PWM values below this (absolute) are treated as 0
            lineThreshold: 100 // For track's isPixelOnLine
        };
        this.totalSimTime_s = 0;
        this.isOutOfTrack = false;

        // Camera State
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZoom = 1;
        this.cameraFollowRobot = false;
    }

    centerCameraOnTrack(canvasWidth, canvasHeight) {
        if (!this.track || !this.track.width_px) return;

        // Calculate the zoom needed to fit the track width or height
        const scaleX = canvasWidth / this.track.width_px;
        const scaleY = canvasHeight / this.track.height_px;

        // Use the smaller scale so it fully fits
        this.cameraZoom = Math.min(scaleX, scaleY) * 0.95; // 95% to leave a tiny margin

        // El centro de la pista en píxeles. 
        // Ya que la pista va de (0,0) a (track.width_px, track.height_px).
        this.cameraX = this.track.width_px / 2;
        this.cameraY = this.track.height_px / 2;
    }

    // Generate a start line at a connection between pieces (preferred)
    _generateStartLineFromConnection() {
        // Accede a la grilla del editor
        const grid = window.trackEditorInstance?.grid;
        if (!grid) {
            console.warn('[RandomStart] No se encontró la grilla de piezas.');
            return null;
        }
        const rows = grid.length;
        const cols = grid[0].length;
        if (!rows || !cols) {
            console.warn('[RandomStart] Grilla vacía.');
            return null;
        }
        // Lista de conexiones válidas
        const conexiones = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pieza = grid[r][c];
                if (!pieza) continue;
                // Conexión Este
                if (c < cols - 1 && grid[r][c + 1]) {
                    conexiones.push({ r1: r, c1: c, r2: r, c2: c + 1 });
                }
                // Conexión Sur
                if (r < rows - 1 && grid[r + 1][c]) {
                    conexiones.push({ r1: r, c1: c, r2: r + 1, c2: c });
                }
            }
        }
        if (conexiones.length === 0) {
            console.warn('[RandomStart] No se encontraron conexiones entre piezas.');
            return null;
        }
        // Elige una conexión aleatoria
        const idx = Math.floor(Math.random() * conexiones.length);
        const { r1, c1, r2, c2 } = conexiones[idx];
        // Calcula el centro de cada celda en píxeles
        const cellSize_px = this.track.width_px / cols;
        const x1 = (c1 + 0.5) * cellSize_px;
        const y1 = (r1 + 0.5) * cellSize_px;
        const x2 = (c2 + 0.5) * cellSize_px;
        const y2 = (r2 + 0.5) * cellSize_px;
        // Centro de la conexión
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        // Ángulo de la línea que une los centros
        const angle = Math.atan2(y2 - y1, x2 - x1);
        // Perpendicular para la línea de inicio
        const perpAngle = angle + Math.PI / 2;
        const lineLength_px = this.robot.wheelbase_m * 1.5 * PIXELS_PER_METER;
        const halfLength_px = lineLength_px / 2;
        const dx = Math.cos(perpAngle) * halfLength_px;
        const dy = Math.sin(perpAngle) * halfLength_px;
        // Extremos de la línea de inicio
        const x1_line = cx - dx;
        const y1_line = cy - dy;
        const x2_line = cx + dx;
        const y2_line = cy + dy;
        // Devuelve en metros
        return {
            startLine: {
                x1: x1_line / PIXELS_PER_METER,
                y1: y1_line / PIXELS_PER_METER,
                x2: x2_line / PIXELS_PER_METER,
                y2: y2_line / PIXELS_PER_METER
            },
            startX: cx / PIXELS_PER_METER,
            startY: cy / PIXELS_PER_METER,
            startAngle: perpAngle
        };
    }

    // Reemplaza la generación aleatoria por la de conexión si es posible
    _generateRandomStartLine() {
        // Intenta primero con la conexión entre piezas
        const fromConnection = this._generateStartLineFromConnection();
        if (fromConnection) {
            console.log('[RandomStart] Línea generada en conexión entre piezas:', fromConnection);
            return fromConnection;
        }
        // Si no es posible, usa la línea de inicio por defecto proporcionada
        console.warn('[RandomStart] No se pudo generar una línea en conexión, usando línea de inicio por defecto.');
        // Coordenadas por defecto en píxeles
        const x1 = 749.6005822946047;
        const y1 = 523.3982349194796;
        const x2 = 988.4578291329269;
        const y2 = 523.3982349194796;
        return {
            startLine: {
                x1: x1 / PIXELS_PER_METER,
                y1: y1 / PIXELS_PER_METER,
                x2: x2 / PIXELS_PER_METER,
                y2: y2 / PIXELS_PER_METER
            },
            startX: (x1 + x2) / 2 / PIXELS_PER_METER,
            startY: y1 / PIXELS_PER_METER,
            startAngle: Math.PI / 2 // Perpendicular a la línea horizontal
        };
    }

    // Update simulation parameters (from UI)
    updateParameters(newParams) {
        if (newParams.robotGeometry) {
            this.robot.updateGeometry(newParams.robotGeometry);
            // LapTimer might need update if robot dimensions change significantly for start line
            this.lapTimer.robotWidth_m = this.robot.wheelbase_m;
            this.lapTimer.robotLength_m = this.robot.length_m;
        }
        this.params.timeStep = newParams.timeStep ?? this.params.timeStep;
        this.params.maxRobotSpeedMPS = newParams.maxRobotSpeedMPS ?? this.params.maxRobotSpeedMPS;
        this.params.motorEfficiency = newParams.motorEfficiency ?? this.params.motorEfficiency;
        this.params.motorImbalance = newParams.motorImbalance ?? this.params.motorImbalance;
        this.params.motorResponseFactor = newParams.motorResponseFactor ?? this.params.motorResponseFactor;
        this.params.sensorNoiseProb = newParams.sensorNoiseProb ?? this.params.sensorNoiseProb;
        this.params.movementPerturbFactor = newParams.movementPerturbFactor ?? this.params.movementPerturbFactor;
        this.params.motorDeadbandPWM = newParams.motorDeadbandPWM ?? this.params.motorDeadbandPWM;
        this.params.lineThreshold = newParams.lineThreshold ?? this.params.lineThreshold;

        this.track.lineThreshold = this.params.lineThreshold; // Update track's threshold
    }

    // Load a track (from file or editor canvas)
    loadTrack(source, startX_m, startY_m, startAngle_rad, callback) {
        this.track.load(source, null, null, this.params.lineThreshold, (success, trackWidthPx, trackHeightPx) => {
            if (success) {
                // If the source is a canvas with start position data, use that
                if (
                    source instanceof HTMLCanvasElement &&
                    source.dataset.startX !== undefined &&
                    source.dataset.startY !== undefined &&
                    source.dataset.startAngle !== undefined
                ) {
                    startX_m = parseFloat(source.dataset.startX);
                    startY_m = parseFloat(source.dataset.startY);
                    startAngle_rad = parseFloat(source.dataset.startAngle);
                } else {
                    console.log('[RandomStart] No hay línea de inicio en el editor, generando aleatoria...');
                    // Generate random start line if no start position is provided
                    const randomStart = this._generateRandomStartLine();
                    if (randomStart) {
                        startX_m = randomStart.startX;
                        startY_m = randomStart.startY;
                        startAngle_rad = randomStart.startAngle;
                    } else {
                        console.warn('[RandomStart] No se pudo generar una línea aleatoria, usando valores por defecto.');
                    }
                }

                // Reset simulation state first
                this.resetSimulationState(startX_m, startY_m, startAngle_rad);

                // Ensure LapTimer has up-to-date robot dimensions
                if (!this.robot.length_m || isNaN(this.robot.length_m)) {
                    this.robot.length_m = 0.15;
                }
                if (!this.robot.wheelbase_m || isNaN(this.robot.wheelbase_m)) {
                    this.robot.wheelbase_m = 0.1;
                }
                this.lapTimer.robotWidth_m = this.robot.wheelbase_m;
                this.lapTimer.robotLength_m = this.robot.length_m;

                // Initialize lap timer with the new start pose
                this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);

                // Position robot at start line
                if (this.lapTimer.isActive && this.lapTimer.startLine) {
                    // Calculate robot position at start line
                    const lineCenterX = (this.lapTimer.startLine.x1 + this.lapTimer.startLine.x2) / 2;
                    const lineCenterY = (this.lapTimer.startLine.y1 + this.lapTimer.startLine.y2) / 2;

                    // Position robot slightly behind the start line
                    const backOffset = -this.robot.length_m / 2;
                    const cosA = Math.cos(startAngle_rad);
                    const sinA = Math.sin(startAngle_rad);

                    this.robot.x_m = lineCenterX + backOffset * cosA;
                    this.robot.y_m = lineCenterY + backOffset * sinA;
                    this.robot.angle_rad = startAngle_rad;
                }

                // Notify track editor if the track was loaded from a source other than the editor
                if (source instanceof HTMLCanvasElement && !source.dataset.fromEditor) {
                    // Create a copy of the canvas to send to the editor
                    const trackCanvas = document.createElement('canvas');
                    trackCanvas.width = trackWidthPx;
                    trackCanvas.height = trackHeightPx;
                    const ctx = trackCanvas.getContext('2d');
                    ctx.drawImage(source, 0, 0);
                    trackCanvas.dataset.fromEditor = 'true';

                    // Notify the track editor through the main app interface
                    if (window.mainAppInterface) {
                        window.mainAppInterface.loadTrackToEditor(trackCanvas);
                    }
                }
            }
            if (callback) callback(success, trackWidthPx, trackHeightPx);
        }, source instanceof HTMLCanvasElement);
    }

    resetSimulationState(startX_m, startY_m, startAngle_rad, newGeometry = null) {
        if (newGeometry) this.robot.updateGeometry(newGeometry);
        this.robot.resetState(startX_m, startY_m, startAngle_rad);
        this.totalSimTime_s = 0;
        this.isOutOfTrack = false;
        this.lapTimer.reset(); // Reset lap data, but don't re-initialize line until new track/start
        if (this.track.imageData) { // Re-initialize if track already loaded
            this.lapTimer.initialize(
                { x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad },
                this.totalSimTime_s,
                this.lapTimer.startLine // <-- Mantener la línea de comienzo actual
            );
        }
    }

    // This is the main step function called by the simulation loop in main.js
    // It takes PWM values from the user's code.
    simulationStep(userLeftPWM, userRightPWM) {
        if (!this.track.imageData) {
            return { error: "No track loaded." }; // Early exit if no track
        }

        // 1. Update robot's internal sensor readings based on its current position and track
        this._updateRobotSensors();

        // (User code runs here, via main.js, and sets robot.motorPWMSpeeds)
        // For this method, userLeftPWM and userRightPWM are passed in.

        // 2. Calculate target motor speeds from PWMs
        let leftPWM = userLeftPWM;
        let rightPWM = userRightPWM;

        // Apply deadband (user code's constrain should handle 0-255, but good to be safe)
        leftPWM = (Math.abs(leftPWM) < this.params.motorDeadbandPWM && leftPWM !== 0) ? 0 : leftPWM;
        rightPWM = (Math.abs(rightPWM) < this.params.motorDeadbandPWM && rightPWM !== 0) ? 0 : rightPWM;

        const effectiveMaxSpeed = this.params.maxRobotSpeedMPS * this.params.motorEfficiency;

        // Motor Imbalance
        const imbalance = this.params.motorImbalance;
        // If > 0, left motor is weaker. If < 0, right motor is weaker.
        const leftFactor = 1.0 - Math.max(0, imbalance);
        const rightFactor = 1.0 - Math.max(0, -imbalance);

        let target_vL_mps = (leftPWM / 255.0) * effectiveMaxSpeed * leftFactor;
        let target_vR_mps = (rightPWM / 255.0) * effectiveMaxSpeed * rightFactor;

        // 3. Update robot physics (movement)
        this.robot.updateMovement(
            this.params.timeStep,
            target_vL_mps,
            target_vR_mps,
            this.params.motorResponseFactor,
            effectiveMaxSpeed, // Max physical speed used for clamping inside updateMovement
            this.params.movementPerturbFactor
        );

        // 4. Update total simulation time and lap timer
        this.totalSimTime_s += this.params.timeStep;
        const lapUpdate = this.lapTimer.update(this.totalSimTime_s, { x_m: this.robot.x_m, y_m: this.robot.y_m, angle_rad: this.robot.angle_rad });

        // 5. Check if robot is out of track boundaries
        // A simple boundary check. More sophisticated would be checking if far from any line.
        const boundaryMargin_m = Math.max(this.robot.length_m, this.robot.wheelbase_m); // Generous margin
        this.isOutOfTrack = (
            this.robot.x_m < -boundaryMargin_m ||
            this.robot.x_m * PIXELS_PER_METER > this.track.width_px + boundaryMargin_m * PIXELS_PER_METER ||
            this.robot.y_m < -boundaryMargin_m ||
            this.robot.y_m * PIXELS_PER_METER > this.track.height_px + boundaryMargin_m * PIXELS_PER_METER
        );

        // 6. Return data for UI update
        return {
            sensorStates: { ...this.robot.sensors }, // Current sensor readings (0=online, 1=offline)
            motorPWMsFromUser: { leftPWM: userLeftPWM, rightPWM: userRightPWM }, // PWMs from user code
            actualMotorSpeeds: { left_mps: this.robot.currentApplied_vL_mps, right_mps: this.robot.currentApplied_vR_mps },
            lapData: this.lapTimer.getDisplayData(),
            newLapCompleted: lapUpdate.newLapCompleted,
            completedLapTime: lapUpdate.completedLapTime,
            simTime_s: this.totalSimTime_s,
            outOfBounds: this.isOutOfTrack
        };
    }

    _updateRobotSensors() {
        if (!this.track.imageData) {
            // All off line if no track
            this.robot._initSensorState();
            for (const key in this.robot.sensors) {
                this.robot.sensors[key] = 1;
            }
            return;
        }
        const sensorPositions_m = this.robot.getSensorPositions_world_m();
        // Calculate sensor radius in pixels using robot's parameter
        const sensorRadiusPx = Math.max(1, (this.robot.sensorDiameter_m / 2) * PIXELS_PER_METER);
        
        // For each sensor, compute state
        for (const key in sensorPositions_m) {
            const pos = sensorPositions_m[key];
            const px = pos.x_m * PIXELS_PER_METER;
            const py = pos.y_m * PIXELS_PER_METER;
            let onLine = this.track.isAreaOnLine(px, py, sensorRadiusPx);
            // Apply sensor noise if enabled
            if (this.params.sensorNoiseProb > 0 && Math.random() < this.params.sensorNoiseProb) {
                onLine = !onLine;
            }
            // 1 = on line (HIGH), 0 = off line (LOW)
            this.robot.sensors[key] = onLine ? 1 : 0;
        }
    }

    draw(displayCtx, displayCanvasWidth, displayCanvasHeight) {
        if (!displayCtx) return;

        displayCtx.save();
        displayCtx.clearRect(0, 0, displayCanvasWidth, displayCanvasHeight);

        // Calculate Camera Transform
        // We want the rendering to be centered on (cameraX, cameraY) with scale cameraZoom
        const centerX = displayCanvasWidth / 2;
        const centerY = displayCanvasHeight / 2;

        displayCtx.translate(centerX, centerY);
        displayCtx.scale(this.cameraZoom, this.cameraZoom);
        displayCtx.translate(-this.cameraX, -this.cameraY);

        if (this.track) {
            this.track.draw(displayCtx, displayCanvasWidth, displayCanvasHeight); // Note: track drawer might ignore width/height if it draws its own bounds
        }
        if (this.robot && this.track && this.track.imageData && this.robotVisible) {
            // Pass all sensor states for display
            const displaySensorStates = {};
            for (const key in this.robot.sensors) {
                // Pass true if on line (1), false if off line (0)
                displaySensorStates[key] = this.robot.sensors[key] === 1;
            }
            this.robot.draw(displayCtx, displaySensorStates);
        }

        // Draw Lap Timer Start/Finish Line
        if (this.lapTimer.isActive) {
            const x1 = this.lapTimer.startLine.x1 * PIXELS_PER_METER;
            const y1 = this.lapTimer.startLine.y1 * PIXELS_PER_METER;
            const x2 = this.lapTimer.startLine.x2 * PIXELS_PER_METER;
            const y2 = this.lapTimer.startLine.y2 * PIXELS_PER_METER;
            displayCtx.save();
            displayCtx.setLineDash([]); // solid line
            displayCtx.strokeStyle = "#FF9999"; // light red
            displayCtx.lineWidth = 2; // thinner line
            displayCtx.beginPath();
            displayCtx.moveTo(x1, y1);
            displayCtx.lineTo(x2, y2);
            displayCtx.stroke();

            // Draw endpoint circles in the same color as the line
            displayCtx.fillStyle = "#FF9999";
            displayCtx.beginPath();
            displayCtx.arc(x1, y1, 4, 0, 2 * Math.PI);
            displayCtx.fill();
            displayCtx.beginPath();
            displayCtx.arc(x2, y2, 4, 0, 2 * Math.PI);
            displayCtx.fill();

            displayCtx.restore();
        }

        // Guardar la matriz de cámara antes de restaurar para poder invertirla en screenToWorld()
        // getTransform() devuelve la matriz ACTUAL (con el camera transform aplicado)
        this._cameraMatrix = displayCtx.getTransform();

        displayCtx.restore();
    }

    /**
     * Convierte posición de pantalla (CSS px relativo al canvas) a coordenadas del mundo (px de pista).
     * Usa la inversa de la verdadera matriz de cámara usada en draw(), garantizando precisión exacta.
     * @param {number} cssPx_x  - event.clientX - canvas.getBoundingClientRect().left
     * @param {number} cssPx_y  - event.clientY - canvas.getBoundingClientRect().top
     * @param {HTMLCanvasElement} canvas
     * @returns {{ x: number, y: number }} world pixel coordinates
     */
    screenToWorld(cssPx_x, cssPx_y, canvas) {
        const rect = canvas.getBoundingClientRect();
        
        // Manejar object-fit: contain
        const renderWidth = rect.width;
        const renderHeight = rect.height;
        const canvasAspect = canvas.width / canvas.height;
        const containerAspect = renderWidth / renderHeight;

        let actualWidth, actualHeight, offsetX, offsetY;

        if (containerAspect > canvasAspect) {
            actualHeight = renderHeight;
            actualWidth = renderHeight * canvasAspect;
            offsetX = (renderWidth - actualWidth) / 2;
            offsetY = 0;
        } else {
            actualWidth = renderWidth;
            actualHeight = renderWidth / canvasAspect;
            offsetX = 0;
            offsetY = (renderHeight - actualHeight) / 2;
        }

        // Si el click fue en el letterbox (fuera del area dibujada), podemos ajustarlo a los bordes
        let adjustedPx_x = cssPx_x - offsetX;
        let adjustedPx_y = cssPx_y - offsetY;

        // Convertir al internal pixel de canvas (0..canvas.width, 0..canvas.height)
        const internalX = adjustedPx_x * (canvas.width / actualWidth);
        const internalY = adjustedPx_y * (canvas.height / actualHeight);

        if (!this._cameraMatrix) {
            return { x: internalX, y: internalY };
        }

        const inv = this._cameraMatrix.inverse();
        return {
            x: inv.a * internalX + inv.c * internalY + inv.e,
            y: inv.b * internalX + inv.d * internalY + inv.f,
        };
    }

    // Utility to get current robot geometry
    getCurrentRobotGeometry() {
        return {
            width_m: this.robot.wheelbase_m,
            length_m: this.robot.length_m,
            sensorOffset_m: this.robot.sensorForwardProtrusion_m,
            sensorSpread_m: this.robot.sensorSideSpread_m,
            sensorDiameter_m: this.robot.sensorDiameter_m,
            sensorCount: this.robot.sensorCount, // <-- Mantener la cantidad de sensores
            robotMass_kg: this.robot.robotMass_kg,
            comOffset_m: this.robot.comOffset_m,
            tireGrip: this.robot.tireGrip,
            customWheels: this.robot.customWheels || null,
            connections: this.robot.connections || null, // ← CRÍTICO: sin esto, se pierde la config de pines al reiniciar
        };
    }
}