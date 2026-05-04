import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const formatCRC = (n) => {
  const num = Number(n || 0);
  return `₡${num.toLocaleString("es-CR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

export const STATUS_LABEL = { pendiente: "Pendiente", en_proceso: "En proceso", entregado: "Entregado" };
export const STATUS_COLOR = {
  pendiente:  { bg: "#F4E9D8", fg: "#8A5A1F" },
  en_proceso: { bg: "#E7ECE3", fg: "#4E5B46" },
  entregado:  { bg: "#E8DBD6", fg: "#6B2D20" },
};
