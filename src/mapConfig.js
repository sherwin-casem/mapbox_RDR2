/**
 * Token: .env.local → VITE_MAPBOX_TOKEN, then ?token=..., then localStorage `mapbox_token`.
 * Style: VITE_MAPBOX_STYLE or Mapbox Dark v11.
 */
export function resolveMapboxToken() {
  const fromEnv = import.meta.env.VITE_MAPBOX_TOKEN || "";
  const qs = new URLSearchParams(window.location.search);
  const fromUrl = qs.get("token");
  if (fromUrl) {
    try {
      localStorage.setItem("mapbox_token", fromUrl);
    } catch (_) {}
    return fromUrl;
  }
  try {
    const ls = localStorage.getItem("mapbox_token");
    if (ls) return ls;
  } catch (_) {}
  return fromEnv;
}

const defaultStyle = "mapbox://styles/mapbox/dark-v11";

export function getMapStyle() {
  return import.meta.env.VITE_MAPBOX_STYLE || defaultStyle;
}

export const mapView = {
  center: [-45.4, 0],
  zoom: 3,
  minZoom: 1.5,
  maxZoom: 22,
  maxPitch: 85,
};
