// URL del backend.
// - En local: "http://localhost:4000"
// - En producción (Vercel): se toma de la variable de entorno VITE_API_URL
//   que configuras en el panel de Vercel.
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Coordenadas del recuadro transparente DENTRO del marco (medidas del PNG).
// Si cambias el marco, recalcula estos valores.
export const FRAME_HOLE = {
  left: 14.97,
  top: 12.11,
  width: 70.44,
  height: 70.9,
};
