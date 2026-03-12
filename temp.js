const fs = require('fs');
const jsCode = \
// --- CONFIGURACIÓN DE MOTORES ---
int vel = 180, velinv = 90, velmin = 150, ultimoDir = 2; // 1 izq, 2 centro, 3 der

// --- CONFIGURACIÓN DE PARADAS ---
unsigned long tiemposParada[3] = {5000, 15000, 25000}; // Segundos: 5, 15 y 25
const unsigned long DURACION_PARADA = 2000; // 2 segundos
int indiceParada = 0; 
bool estaParado = false;
unsigned long inicioParada = 0;

// --- CONFIGURACIÓN DE GIROS ---
unsigned long tiemposGiro[3] = {10000, 20000, 30000}; // Segundos: 10, 20 y 30
int dirGiros[3] = {3, 1, 3}; // Direcciones: 3=Der, 1=Izq
\;
const TYPES = ['unsigned\\\\s+long\\\\s+long', 'unsigned\\\\s+long', 'int', 'bool'].join('|');
console.log(jsCode.replace(new RegExp(\(?:\\\\bconst\\\\s+)?\\\\b(?:\)\\\\s+(\\\\w+)\\\\s*\\\\[([^\\\\]]*)\\\\]\\\\s*=\\\\s*\\\\{([\\\\s\\\\S]*?)\\\\}\\\\s*;\, 'g'), 'let \ = [\];'));

