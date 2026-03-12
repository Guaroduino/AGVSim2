// js/robot.js
import { PIXELS_PER_METER, WHEEL_LENGTH_M, WHEEL_WIDTH_M, DEFAULT_ROBOT_GEOMETRY } from './config.js';
import { clamp } from './utils.js';

export class Robot {
    constructor(initialX_m = 0.1, initialY_m = 0.1, initialAngle_rad = 0, geometry = DEFAULT_ROBOT_GEOMETRY) {
        this.x_m = initialX_m;
        this.y_m = initialY_m;
        this.angle_rad = initialAngle_rad; // Angle in radians, 0 is along positive X-axis

        // Default to 3 sensors if not specified
        const sensorCount = geometry && geometry.sensorCount ? geometry.sensorCount : 3;
        this.sensorCount = sensorCount;
        this.sensors = {};
        this._initSensorState();
        // Motor speeds as PWM values (0-255), set by user's analogWrite
        this.motorPWMSpeeds = {
            left: 0,
            right: 0
        };

        this.updateGeometry(geometry, false); // false to skip trail reset if called from constructor

        this.currentApplied_vL_mps = 0; // Actual speed of left wheel
        this.currentApplied_vR_mps = 0; // Actual speed of right wheel

        this.centerTrail = [];
        this.leftWheelTrail = [];
        this.rightWheelTrail = [];
        this.maxTrailLength = 300; // Shorter trail for performance

        this.wheelImage = null;
        this.decorativeParts = []; // Array to store decorative parts
    }

    _initSensorState() {
        // Always use keys: left, center, right, farLeft, farRight (for up to 5 sensors)
        // For 2 sensors: left, right
        // For 3 sensors: left, center, right
        // For 4 sensors: farLeft, left, right, farRight
        // For 5 sensors: farLeft, left, center, right, farRight
        this.sensors = {};
        if (this.sensorCount === 1) {
            this.sensors.center = 0;
        } else if (this.sensorCount === 2) {
            this.sensors.left = 0;
            this.sensors.right = 0;
        } else if (this.sensorCount === 3) {
            this.sensors.left = 0;
            this.sensors.center = 0;
            this.sensors.right = 0;
        } else if (this.sensorCount === 4) {
            this.sensors.farLeft = 0;
            this.sensors.left = 0;
            this.sensors.right = 0;
            this.sensors.farRight = 0;
        } else if (this.sensorCount === 5) {
            this.sensors.farLeft = 0;
            this.sensors.left = 0;
            this.sensors.center = 0;
            this.sensors.right = 0;
            this.sensors.farRight = 0;
        } else if (this.sensorCount === 6) {
            this.sensors.fullFarLeft = 0;
            this.sensors.farLeft = 0;
            this.sensors.left = 0;
            this.sensors.right = 0;
            this.sensors.farRight = 0;
            this.sensors.fullFarRight = 0;
        } else if (this.sensorCount === 7) {
            this.sensors.fullFarLeft = 0;
            this.sensors.farLeft = 0;
            this.sensors.left = 0;
            this.sensors.center = 0;
            this.sensors.right = 0;
            this.sensors.farRight = 0;
            this.sensors.fullFarRight = 0;
        } else if (this.sensorCount === 8) {
            this.sensors.fullFarLeft = 0;
            this.sensors.farLeft = 0;
            this.sensors.left = 0;
            this.sensors.centerLeft = 0; // Addition for 8 sensors to keep symmetry
            this.sensors.centerRight = 0;
            this.sensors.right = 0;
            this.sensors.farRight = 0;
            this.sensors.fullFarRight = 0;
        }

        if (this.customSensors && this.customSensors.length > 0) {
            this.customSensors.forEach((s, idx) => {
                this.sensors[`custom_${idx}`] = 0;
            });
        }
    }

    setImages(wheelImg) {
        this.wheelImage = wheelImg;
    }

    setDecorativeParts(parts) {
        this.decorativeParts = parts;
    }

    updateGeometry(geometry, resetTrails = true) {
        if (!geometry) return;

        this.wheelbase_m = geometry.width_m;
        this.length_m = geometry.length_m || 0.15; // Use provided length or default to 0.15m
        this.sensorForwardProtrusion_m = geometry.sensorOffset_m;
        this.sensorSideSpread_m = geometry.sensorSpread_m;
        this.sensorDiameter_m = geometry.sensorDiameter_m;
        this.sensorCount = geometry.sensorCount || 3;

        // Asignar parámetros físicos de la geometría (o usar defaults de config en caso que no vengan)
        this.robotMass_kg = geometry.robotMass_kg ?? 0.25;
        this.comOffset_m = geometry.comOffset_m ?? 0.0;
        this.tireGrip = geometry.tireGrip ?? 0.8;

        // Asignar llantas paramétricas si existen
        this.customWheels = geometry.customWheels || null;

        // Asignar sensores customizados
        this.customSensors = geometry.customSensors || null;

        // Asignar conexiones de pines
        this.connections = geometry.connections || null;

        this._initSensorState();

        if (resetTrails) this.resetTrails();
    }

    resetState(x_m, y_m, angle_rad, geometry = null) {
        this.x_m = x_m;
        this.y_m = y_m;
        this.angle_rad = angle_rad;
        if (geometry) this.updateGeometry(geometry);

        this.currentApplied_vL_mps = 0;
        this.currentApplied_vR_mps = 0;
        this.motorPWMSpeeds = { left: 0, right: 0 };
        this._initSensorState();
        this.resetTrails();
    }

    resetTrails() {
        this.centerTrail = [];
        this.leftWheelTrail = [];
        this.rightWheelTrail = [];
    }

    // Called by the simulation loop AFTER user code has run and set motorPWMSpeeds
    updateMovement(dt_s, target_vL_mps, target_vR_mps, motorResponseFactor, maxPhysicalSpeed_mps, movementPerturbationFactor) {
        // --- 1. inercia longitudinal y rotacional avanzada ---
        // Basic inertia modified by mass and CoM
        const massFactor = Math.max(0.1, this.robotMass_kg); // Evitamos masas demasiado bajas
        // Un centro de masa alejado (mayor inercia rotacional) afecta cuán lento cambian las velocidades asimétricas

        let actualResponseL = motorResponseFactor / Math.sqrt(massFactor);
        let actualResponseR = motorResponseFactor / Math.sqrt(massFactor);

        // Asimetría (si comOffset_m está desplazado, las ruedas no levantan parejo la fuerza)
        this.currentApplied_vL_mps += (target_vL_mps - this.currentApplied_vL_mps) * actualResponseL;
        this.currentApplied_vR_mps += (target_vR_mps - this.currentApplied_vR_mps) * actualResponseR;

        this.currentApplied_vL_mps = clamp(this.currentApplied_vL_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);
        this.currentApplied_vR_mps = clamp(this.currentApplied_vR_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);

        let linear_displacement_m = (this.currentApplied_vR_mps + this.currentApplied_vL_mps) / 2.0 * dt_s;
        let d_theta_rad = 0;

        if (this.wheelbase_m > 0.001) {
            // For Y-down screen coordinates, positive (vL - vR) means turning RIGHT (clockwise)
            d_theta_rad = (this.currentApplied_vL_mps - this.currentApplied_vR_mps) / this.wheelbase_m * dt_s;
            // Moderador de inercia rotacional por posición del CG ("péndulo")
            // Un CoM desplazado requiere más energía para rotar.
            let momentOfInertiaMod = 1 + Math.abs(this.comOffset_m) * 10;
            d_theta_rad /= momentOfInertiaMod;
        }

        // --- 2. Perturbaciones Aleatorias ---
        if (movementPerturbationFactor > 0) {
            // El ruido lineal afecta ligeramente el avance
            const perturbLinear = (Math.random() * 2 - 1) * movementPerturbationFactor * 0.1; 
            // El ruido angular se AGREGA en base a qué tanto avanzó el robot (baches en la pista)
            // Se multiplica por la distancia para que no vibre cuando el robot está totalmente detenido
            const perturbAngular = (Math.random() * 2 - 1) * movementPerturbationFactor * 5.0 * Math.abs(linear_displacement_m);

            linear_displacement_m *= (1 + perturbLinear);
            d_theta_rad += perturbAngular; 
        }

        // --- 3. Posicionamiento Teórico ---
        let deltaX_m = linear_displacement_m * Math.cos(this.angle_rad);
        let deltaY_m = linear_displacement_m * Math.sin(this.angle_rad);

        // --- 4. Derrape (Slip Model) ---
        // Velocidad tangencial v y velocidad angular W
        let v_tan = linear_displacement_m / dt_s;
        let omega = d_theta_rad / dt_s;

        if (Math.abs(omega) > 0.1 && Math.abs(v_tan) > 0.1) {
            // F_c = m * v * w (centripetal force required to turn)
            let F_centripetal = Math.abs(massFactor * v_tan * omega);
            // F_f = m * g * mu (max friction force available)
            const g = 9.81;
            let F_friction_max = massFactor * g * this.tireGrip;

            // Si la fuerza centrífuga supera la fricción disponible, ocurre el derrape!
            if (F_centripetal > F_friction_max) {
                let slipForce = F_centripetal - F_friction_max;
                let slipFactor = slipForce / massFactor; // a = F/m

                // El derrape empuja radialmente "hacia afuera" de la curva
                // Direction of centrifugal force is 90 deg off from current heading
                // Orientación: Si w es positivo (gira a la izq), la fuerza empuja a la derecha (-90 deg)
                let centrifugalAngle = this.angle_rad + (omega > 0 ? -Math.PI / 2 : Math.PI / 2);

                let slip_displacement_m = slipFactor * dt_s * 0.1; // Scale factor for realism

                deltaX_m += slip_displacement_m * Math.cos(centrifugalAngle);
                deltaY_m += slip_displacement_m * Math.sin(centrifugalAngle);
            }
        }

        // --- 5. Actualización final ---
        this.x_m += deltaX_m;
        this.y_m += deltaY_m;
        this.angle_rad += d_theta_rad;
        this.angle_rad = Math.atan2(Math.sin(this.angle_rad), Math.cos(this.angle_rad)); // Normalize angle to [-PI, PI]

        this._updateTrails();
    }

    _updateTrails() {
        this.centerTrail.push({ x_m: this.x_m, y_m: this.y_m });
        if (this.centerTrail.length > this.maxTrailLength) this.centerTrail.shift();

        const halfWheelbase_m = this.wheelbase_m / 2;
        const sinAngle = Math.sin(this.angle_rad);
        const cosAngle = Math.cos(this.angle_rad);

        // Left wheel trail (robot's left)
        const x_lw_m = this.x_m + halfWheelbase_m * Math.sin(this.angle_rad); // sin for y offset in robot frame
        const y_lw_m = this.y_m - halfWheelbase_m * Math.cos(this.angle_rad); // -cos for x offset in robot frame
        this.leftWheelTrail.push({ x_m: x_lw_m, y_m: y_lw_m });
        if (this.leftWheelTrail.length > this.maxTrailLength) this.leftWheelTrail.shift();

        // Right wheel trail (robot's right)
        const x_rw_m = this.x_m - halfWheelbase_m * Math.sin(this.angle_rad);
        const y_rw_m = this.y_m + halfWheelbase_m * Math.cos(this.angle_rad);
        this.rightWheelTrail.push({ x_m: x_rw_m, y_m: y_rw_m });
        if (this.rightWheelTrail.length > this.maxTrailLength) this.rightWheelTrail.shift();
    }

    // Gets sensor positions in meters, relative to robot's origin (center of axle line) and orientation
    // Returns an object with keys matching this.sensors
    getSensorPositions_world_m() {
        const count = this.sensorCount || 3;
        const offset = this.sensorForwardProtrusion_m;
        const spread = this.sensorSideSpread_m;
        const cosA = Math.cos(this.angle_rad);
        const sinA = Math.sin(this.angle_rad);
        // Positions along the y axis (robot local frame)
        let positions = {};
        if (count === 2) {
            // left/right only
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.left = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
            positions.right = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
        } else if (count === 3) {
            // left, center, right
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.left = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
            positions.center = { x_m: x, y_m: y };
            positions.right = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
        } else if (count === 4) {
            // farLeft, left, right, farRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.farLeft = {
                x_m: x + 1.5 * ySpread * sinA,
                y_m: y - 1.5 * ySpread * cosA
            };
            positions.left = {
                x_m: x + 0.5 * ySpread * sinA,
                y_m: y - 0.5 * ySpread * cosA
            };
            positions.right = {
                x_m: x - 0.5 * ySpread * sinA,
                y_m: y + 0.5 * ySpread * cosA
            };
            positions.farRight = {
                x_m: x - 1.5 * ySpread * sinA,
                y_m: y + 1.5 * ySpread * cosA
            };
        } else if (count === 5) {
            // farLeft, left, center, right, farRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.farLeft = {
                x_m: x + 2 * ySpread * sinA,
                y_m: y - 2 * ySpread * cosA
            };
            positions.left = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
            positions.center = { x_m: x, y_m: y };
            positions.right = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
            positions.farRight = {
                x_m: x - 2 * ySpread * sinA,
                y_m: y + 2 * ySpread * cosA
            };
        } else if (count === 6) {
            // fullFarLeft, farLeft, left, right, farRight, fullFarRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.fullFarLeft = { x_m: x + 2.5 * ySpread * sinA, y_m: y - 2.5 * ySpread * cosA };
            positions.farLeft = { x_m: x + 1.5 * ySpread * sinA, y_m: y - 1.5 * ySpread * cosA };
            positions.left = { x_m: x + 0.5 * ySpread * sinA, y_m: y - 0.5 * ySpread * cosA };
            positions.right = { x_m: x - 0.5 * ySpread * sinA, y_m: y + 0.5 * ySpread * cosA };
            positions.farRight = { x_m: x - 1.5 * ySpread * sinA, y_m: y + 1.5 * ySpread * cosA };
            positions.fullFarRight = { x_m: x - 2.5 * ySpread * sinA, y_m: y + 2.5 * ySpread * cosA };
        } else if (count === 7) {
            // fullFarLeft, farLeft, left, center, right, farRight, fullFarRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.fullFarLeft = { x_m: x + 3 * ySpread * sinA, y_m: y - 3 * ySpread * cosA };
            positions.farLeft = { x_m: x + 2 * ySpread * sinA, y_m: y - 2 * ySpread * cosA };
            positions.left = { x_m: x + ySpread * sinA, y_m: y - ySpread * cosA };
            positions.center = { x_m: x, y_m: y };
            positions.right = { x_m: x - ySpread * sinA, y_m: y + ySpread * cosA };
            positions.farRight = { x_m: x - 2 * ySpread * sinA, y_m: y + 2 * ySpread * cosA };
            positions.fullFarRight = { x_m: x - 3 * ySpread * sinA, y_m: y + 3 * ySpread * cosA };
        } else if (count === 8) {
            // same as 7 but with center split
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.fullFarLeft = { x_m: x + 3.5 * ySpread * sinA, y_m: y - 3.5 * ySpread * cosA };
            positions.farLeft = { x_m: x + 2.5 * ySpread * sinA, y_m: y - 2.5 * ySpread * cosA };
            positions.left = { x_m: x + 1.5 * ySpread * sinA, y_m: y - 1.5 * ySpread * cosA };
            positions.centerLeft = { x_m: x + 0.5 * ySpread * sinA, y_m: y - 0.5 * ySpread * cosA };
            positions.centerRight = { x_m: x - 0.5 * ySpread * sinA, y_m: y + 0.5 * ySpread * cosA };
            positions.right = { x_m: x - 1.5 * ySpread * sinA, y_m: y + 1.5 * ySpread * cosA };
            positions.farRight = { x_m: x - 2.5 * ySpread * sinA, y_m: y + 2.5 * ySpread * cosA };
            positions.fullFarRight = { x_m: x - 3.5 * ySpread * sinA, y_m: y + 3.5 * ySpread * cosA };
        }

        if (this.customSensors && this.customSensors.length > 0) {
            this.customSensors.forEach((s, idx) => {
                // s.x_mm es avance (eje X local del robot)
                // s.y_mm es lateral (eje Y local del robot - izquierda es negativo en el canvas?)
                // En el canvas, +X es derecha, +Y es abajo. El robot mira -Y en el origen
                // Pero wait! angle_rad=0 mira a +X.
                // Posición (X_local=avance, Y_local=lateral donde negativo es izquierda, positivo es derecha)
                const xLocal_m = s.x_mm / 1000.0;
                const yLocal_m = s.y_mm / 1000.0;
                const wx = this.x_m + xLocal_m * cosA - yLocal_m * sinA;
                const wy = this.y_m + xLocal_m * sinA + yLocal_m * cosA;
                positions[`custom_${idx}`] = { x_m: wx, y_m: wy };
            });
        }

        return positions;
    }

    draw(ctx, displaySensorStates = null) {
        ctx.save();
        ctx.translate(this.x_m * PIXELS_PER_METER, this.y_m * PIXELS_PER_METER);
        ctx.rotate(this.angle_rad);

        // Draw Wheels
        let wheelLengthPx = WHEEL_LENGTH_M * PIXELS_PER_METER;
        let wheelWidthPx = WHEEL_WIDTH_M * PIXELS_PER_METER;
        let wheelYOffsetPx = this.wheelbase_m / 2 * PIXELS_PER_METER;
        let wheelColor = 'rgba(80, 80, 80, 0.9)';
        let useImage = false;

        if (this.customWheels) {
            wheelLengthPx = this.customWheels.length_m * PIXELS_PER_METER;
            wheelWidthPx = this.customWheels.width_m * PIXELS_PER_METER;
            wheelColor = this.customWheels.color;
        } else if (this.wheelImage && this.wheelImage.complete && this.wheelImage.naturalWidth > 0) {
            useImage = true;
        }

        if (useImage) {
            // Left wheel
            ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            // Right wheel
            ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, -wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
        } else {
            ctx.fillStyle = wheelColor;
            ctx.fillRect(-wheelLengthPx / 2, wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            ctx.fillRect(-wheelLengthPx / 2, -wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            if (this.customWheels) {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(-wheelLengthPx / 2, wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
                ctx.strokeRect(-wheelLengthPx / 2, -wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            }
        }

        // Draw direction indicator
        ctx.fillStyle = 'rgba(173, 216, 230, 0.9)';
        ctx.beginPath();
        const indicatorTipX = wheelLengthPx / 2;
        const indicatorBaseX = wheelLengthPx / 2 - Math.min(10, wheelLengthPx * 0.2);
        const indicatorBaseSpread = wheelWidthPx / 3;
        ctx.moveTo(indicatorTipX, 0);
        ctx.lineTo(indicatorBaseX, -indicatorBaseSpread / 2);
        ctx.lineTo(indicatorBaseX, indicatorBaseSpread / 2);
        ctx.closePath();
        ctx.fill();

        // Draw decorative parts
        if (this.decorativeParts && this.decorativeParts.length > 0) {
            this.decorativeParts.forEach(part => {
                if (part.img && part.img.complete && part.img.naturalWidth > 0) {
                    const x = part.x * PIXELS_PER_METER;
                    const y = part.y * PIXELS_PER_METER;
                    const sizeW = part.img.width;
                    const sizeH = part.img.height;
                    ctx.save();
                    // Always fully opaque
                    ctx.translate(x, y);
                    ctx.rotate(part.rotation || 0); // Apply the part's rotation
                    ctx.drawImage(part.img, -sizeW / 2, -sizeH / 2, sizeW, sizeH);
                    ctx.restore();
                }
            });
        }

        ctx.restore(); // <-- End robot-local transform

        // Draw Trails (world space)
        const drawTrail = (trail, color, lineWidth) => {
            if (trail.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.moveTo(trail[0].x_m * PIXELS_PER_METER, trail[0].y_m * PIXELS_PER_METER);
                for (let i = 1; i < trail.length; i++) {
                    ctx.lineTo(trail[i].x_m * PIXELS_PER_METER, trail[i].y_m * PIXELS_PER_METER);
                }
                ctx.stroke();
            }
        };
        drawTrail(this.centerTrail, 'rgba(0, 0, 255, 0.2)', 3);
        drawTrail(this.leftWheelTrail, 'rgba(255, 0, 0, 0.2)', 2);
        drawTrail(this.rightWheelTrail, 'rgba(0, 255, 0, 0.2)', 2);

        // Draw Sensors (world space, after transform restored)
        if (displaySensorStates) {
            this.drawSensorsForDisplay(ctx, displaySensorStates);
        }
    }

    drawSensorsForDisplay(ctx, sensorReadings) {
        // Called in WORLD-SPACE (outside robot local transform)
        // getSensorPositions_world_m() returns world meter coords -> convert to world pixels
        const sensorPositions_world = this.getSensorPositions_world_m();
        const sensorRadiusPx = Math.max(2, (this.sensorDiameter_m / 2) * PIXELS_PER_METER);

        for (const key in sensorPositions_world) {
            const pos = sensorPositions_world[key];
            const px = pos.x_m * PIXELS_PER_METER;
            const py = pos.y_m * PIXELS_PER_METER;
            const isOnLine = sensorReadings[key];

            ctx.beginPath();
            ctx.arc(px, py, sensorRadiusPx, 0, 2 * Math.PI);
            ctx.fillStyle = isOnLine ? 'lime' : 'gray';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Pin number label
            let pinNumber = '';
            const conns = this.connections?.sensorPins;
            if (conns) {
                if (key === 'left') pinNumber = conns.left || '';
                else if (key === 'center') pinNumber = conns.center || '';
                else if (key === 'right') pinNumber = conns.right || '';
                else if (key === 'farLeft') pinNumber = conns.farLeft || '';
                else if (key === 'farRight') pinNumber = conns.farRight || '';
                else if (key === 'fullFarLeft') pinNumber = conns.fullFarLeft || '';
                else if (key === 'fullFarRight') pinNumber = conns.fullFarRight || '';
                else if (key === 'centerLeft') pinNumber = conns.centerLeft || '';
                else if (key === 'centerRight') pinNumber = conns.centerRight || '';
                else if (key.startsWith('custom_')) pinNumber = conns[key] || '';
            } else {
                if (this.sensorCount === 2) {
                    if (key === 'left') pinNumber = '2';
                    else if (key === 'right') pinNumber = '3';
                } else if (this.sensorCount === 3) {
                    if (key === 'left') pinNumber = '2';
                    else if (key === 'center') pinNumber = '3';
                    else if (key === 'right') pinNumber = '4';
                } else if (this.sensorCount === 4) {
                    if (key === 'farLeft') pinNumber = '2';
                    else if (key === 'left') pinNumber = '3';
                    else if (key === 'right') pinNumber = '4';
                    else if (key === 'farRight') pinNumber = '5';
                } else if (this.sensorCount === 5) {
                    if (key === 'farLeft') pinNumber = '2';
                    else if (key === 'left') pinNumber = '3';
                    else if (key === 'center') pinNumber = '4';
                    else if (key === 'right') pinNumber = '5';
                    else if (key === 'farRight') pinNumber = '6';
                } else if (this.sensorCount === 6) {
                    if (key === 'fullFarLeft') pinNumber = '2';
                    else if (key === 'farLeft') pinNumber = '3';
                    else if (key === 'left') pinNumber = '4';
                    else if (key === 'right') pinNumber = '5';
                    else if (key === 'farRight') pinNumber = '6';
                    else if (key === 'fullFarRight') pinNumber = '7';
                } else if (this.sensorCount === 7) {
                    if (key === 'fullFarLeft') pinNumber = '2';
                    else if (key === 'farLeft') pinNumber = '3';
                    else if (key === 'left') pinNumber = '4';
                    else if (key === 'center') pinNumber = '5';
                    else if (key === 'right') pinNumber = '6';
                    else if (key === 'farRight') pinNumber = '7';
                    else if (key === 'fullFarRight') pinNumber = '8';
                } else if (this.sensorCount === 8) {
                    if (key === 'fullFarLeft') pinNumber = '2';
                    else if (key === 'farLeft') pinNumber = '3';
                    else if (key === 'left') pinNumber = '4';
                    else if (key === 'centerLeft') pinNumber = '5';
                    else if (key === 'centerRight') pinNumber = '6';
                    else if (key === 'right') pinNumber = '7';
                    else if (key === 'farRight') pinNumber = '8';
                    else if (key === 'fullFarRight') pinNumber = '9';
                }
            }

            if (pinNumber) {
                ctx.save();
                ctx.fillStyle = 'black';
                ctx.font = `${Math.max(8, sensorRadiusPx * 0.9)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pinNumber, px, py);
                ctx.restore();
            }
        }
    }
}