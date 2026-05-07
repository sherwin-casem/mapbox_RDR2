/**
 * Token: .env.local → VITE_MAPBOX_TOKEN, then ?token=..., then localStorage `mapbox_token`.
 * Basemap: defaults to a minimal custom style (neon purple); set VITE_MAPBOX_STYLE to override
 *          with a Mapbox style URL or hosted JSON.
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

/** Must match `NEON.land` in main when using the built-in basemap. */
export const DEFAULT_NEON_LAND = "#2e004f";

/**
 * Minimal Mapbox GL style: one background layer only. All land/water/roads are added in main.js.
 */
export function createNeonBasemapStyle(backgroundColor = DEFAULT_NEON_LAND) {
  return {
    version: 8,
    name: "Neon basemap (custom)",
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "neon-global-bg",
        type: "background",
        paint: { "background-color": backgroundColor },
      },
    ],
  };
}

/**
 * @returns {string | object} Mapbox URL/JSON string, or null to use inline basemap from main.
 */
export function getMapStyleRef() {
  const s = import.meta.env.VITE_MAPBOX_STYLE?.trim?.();
  if (s) return s;
  return null;
}

export const mapView = {
  center: [-45.4, 0],
  zoom: 3,
  minZoom: 1.5,
  maxZoom: 22,
  maxPitch: 85,
};
