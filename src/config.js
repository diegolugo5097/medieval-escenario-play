// URL del backend.
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Coordenadas del recuadro del video DENTRO del marco (en % de la pantalla).
// 'top' = 19.5% deja el escudo "Medieval Café" (que baja hasta ~18%) COMPLETO
// por encima. El video nunca llega a esa altura, así que es imposible que lo
// corte, sin depender de trucos de capas del navegador.
export const FRAME_HOLE = {
  left: 8.55,
  top: 19.5,
  width: 82.89,
  height: 64.0,
};
