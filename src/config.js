// URL del backend.
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Coordenadas del recuadro del video DENTRO del marco (en % de la pantalla).
// El marco va por encima del video (z-index + 3D), así el escudo nunca se corta.
// Hueco del marco nuevo (más amplio que el anterior).
export const FRAME_HOLE = {
  left: 3.29,
  top: 6.06,
  width: 93.42,
  height: 87.35,
};
