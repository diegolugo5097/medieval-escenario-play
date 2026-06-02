// URL del backend.
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Coordenadas del recuadro del video DENTRO del marco (en % de la pantalla).
// El marco va por encima del video (z-index 30 + contexto de apilamiento propio),
// así el escudo "Medieval Café" se dibuja SOBRE el video y nunca se corta.
export const FRAME_HOLE = {
  left: 8.55,
  top: 13.28,
  width: 82.89,
  height: 73.11,
};
