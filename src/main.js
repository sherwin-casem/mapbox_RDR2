import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./styles.css";

import {
  resolveMapboxToken,
  createNeonBasemapStyle,
  getMapStyleRef,
  mapView,
  DEFAULT_NEON_LAND,
} from "./mapConfig.js";

/**
 * Custom neon cartography on a minimal programmatic basemap (see `createNeonBasemapStyle`).
 * Deep purple nebula land, luminous cyan water, gray roads + casings, pale buildings — not violet slabs.
 * Default land hue: `DEFAULT_NEON_LAND` in mapConfig.js.
 */
const NEON = {
  land: DEFAULT_NEON_LAND,
  landUrban: "#3b0868",
  nebulaPurple: "rgba(106, 13, 173, 0.38)",
  nebulaPurpleDeep: "rgba(96, 0, 160, 0.32)",
  ink: "#0c0218",
  waterCore: "#00d0f0",
  waterDepth: "#00a8cc",
  waterInnerGlow: "rgba(0, 229, 255, 0.35)",
  coastHaloOuter: "#00b8d4",
  coastHaloMid: "#40e8ff",
  coastHaloInner: "#a8fcff",
  magentaWood: "rgba(255, 0, 255, 0.14)",
  magentaWood2: "rgba(255, 0, 255, 0.22)",
  urbanVeil: "rgba(60, 0, 96, 0.22)",
  /** Topo contours: hairline neutral gray, low contrast (ref ~etched, 20–35% over land) */
  contourLine: "#d6d2dc",
  contourLineIndex: "#e8e4ee",
  roadGray: "#9090a0",
  roadGrayBright: "#a8a8b8",
  roadCasing: "#1c1c24",
  roadBloomBlur: 0.95,
  buildingFill: "#d0d0e0",
  buildingFillMuted: "#c0c8d8",
  buildingFillLight: "#e8e8f4",
  buildingLine: "#25252f",
  railGray: "#9090a0",
  borderWhite: "#ffffff",
  maritimeWhite: "#ffffff",
  /** Raster DEM hillshade — lifted midtones, no near-black craters */
  hillShadow: "#4a2d72",
  hillHighlight: "#9b6ec4",
  hillAccent: "#b894e0",
  /** Terrain-v2 vector hillshade — paint soft purple glow, not black silhouettes */
  reliefVectorShadow: "rgba(52, 28, 96, 0.22)",
  reliefVectorShadowDeep: "rgba(38, 18, 72, 0.18)",
  reliefVectorHighlight: "rgba(180, 110, 255, 0.14)",
  reliefVectorHighlightCore: "rgba(220, 170, 255, 0.1)",
  atmoLandcoverBloom: "rgba(120, 40, 200, 0.16)",
  atmoLandcoverVeil: "rgba(74, 20, 128, 0.12)",
  fogColor: "rgb(40, 8, 70)",
  fogSpace: "rgb(12, 0, 26)",
};

function expWidth(zMin, zMax, wMin, wMax, base) {
  return [
    "interpolate",
    ["exponential", base],
    ["zoom"],
    zMin,
    wMin,
    zMax,
    wMax,
  ];
}

/** Terrain-v2: index 10/5/2 barely wider than base (hairlines, not bold strokes). */
function contourWidthByIndex(w10, w5, w2, w1) {
  return ["match", ["coalesce", ["get", "index"], 1], 10, w10, 5, w5, 2, w2, -1, 0, w1];
}

mapboxgl.accessToken = resolveMapboxToken();

if (!mapboxgl.accessToken) {
  document.body.innerHTML =
    '<div style="padding:24px;font-family:system-ui;max-width:520px;line-height:1.5">' +
    "<strong>Mapbox token required.</strong><br><br>" +
    "Create <code>.env.local</code> with <code>VITE_MAPBOX_TOKEN=YOUR_PK_TOKEN</code> and run " +
    "<code>npm run dev</code>, or visit with <code>?token=YOUR_PK_TOKEN</code> once.<br><br>" +
    "Default basemap is a minimal custom neon style (see <code>mapConfig.js</code>)." +
    "</div>";
} else {
  const map = new mapboxgl.Map({
    container: "map",
    style: getMapStyleRef() ?? createNeonBasemapStyle(NEON.land),
    center: mapView.center,
    zoom: mapView.zoom,
    minZoom: mapView.minZoom,
    maxZoom: mapView.maxZoom,
    maxPitch: mapView.maxPitch,
    antialias: true,
    projection: "mercator",
    pitchWithRotate: true,
  });

  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new mapboxgl.FullscreenControl(), "top-right");
  map.addControl(
    new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }),
    "bottom-left",
  );
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }),
    "top-right",
  );

  const elZoom = document.getElementById("readout-zoom");
  const elPitch = document.getElementById("readout-pitch");
  const elBearing = document.getElementById("readout-bearing");
  const btnTerrain = document.getElementById("btn-terrain");

  function updateHud() {
    elZoom.textContent = map.getZoom().toFixed(2);
    elPitch.textContent = map.getPitch().toFixed(1) + "°";
    elBearing.textContent = map.getBearing().toFixed(1) + "°";
  }

  map.on("load", updateHud);
  map.on("move", updateHud);
  map.on("zoom", updateHud);
  map.on("rotate", updateHud);
  map.on("pitch", updateHud);

  let terrainOn = true;

  function setTerrain(enabled) {
    terrainOn = enabled;
    btnTerrain.setAttribute("aria-pressed", String(enabled));
    if (enabled) {
      map.setTerrain({
        source: "mapbox-dem",
        exaggeration: 1.45,
      });
      if (!map.getLayer("sky-atmosphere")) {
        map.addLayer({
          id: "sky-atmosphere",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun-intensity": 4,
            "sky-atmosphere-sun": [0.5, 90],
          },
        });
      }
    } else {
      map.setTerrain(null);
      if (map.getLayer("sky-atmosphere")) map.removeLayer("sky-atmosphere");
    }
  }

  function applyNeonFog() {
    if (typeof map.setFog !== "function") return;
    try {
      map.setFog({
        color: NEON.fogColor,
        "high-color": "rgba(120, 40, 140, 0.35)",
        "horizon-blend": 0.48,
        "space-color": NEON.fogSpace,
        "star-intensity": 0,
        range: [0.5, 10],
      });
    } catch (_) {}
  }

  const STREETS_ID = "overlay-streets-v8";

  function ensureStreetsSource() {
    if (!map.getSource(STREETS_ID)) {
      map.addSource(STREETS_ID, {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });
    }
  }

  function ensureTopoSource() {
    if (!map.getSource("mapbox-topo-v2")) {
      map.addSource("mapbox-topo-v2", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-terrain-v2",
      });
    }
  }

  /**
   * Layered soft “nebula” atmosphere on landcover + urban (no reliance on template land paint).
   */
  function addAtmosphericLandFills() {
    ensureStreetsSource();
    if (!map.getLayer("neon-atmo-landcover-veil")) {
      map.addLayer({
        id: "neon-atmo-landcover-veil",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        paint: {
          "fill-antialias": false,
          "fill-color": NEON.atmoLandcoverVeil,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 6, 0.62, 12, 0.55, 16, 0.48],
        },
      });
    }
    if (!map.getLayer("neon-atmo-landcover-bloom")) {
      map.addLayer({
        id: "neon-atmo-landcover-bloom",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: [
          "match",
          ["get", "class"],
          ["wood", "scrub", "grass", "wetland", "crop"],
          true,
          false,
        ],
        paint: {
          "fill-antialias": false,
          "fill-color": NEON.atmoLandcoverBloom,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.35, 10, 0.55, 15, 0.5],
        },
      });
    }
    if (!map.getLayer("neon-landcover-snow")) {
      map.addLayer({
        id: "neon-landcover-snow",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "snow"],
        paint: {
          "fill-antialias": false,
          "fill-color": NEON.land,
          "fill-opacity": 1,
        },
      });
    }
    if (!map.getLayer("neon-landcover-magenta")) {
      map.addLayer({
        id: "neon-landcover-magenta",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: [
          "match",
          ["get", "class"],
          ["wood", "scrub", "grass", "crop", "wetland"],
          true,
          false,
        ],
        paint: {
          "fill-antialias": false,
          "fill-color": NEON.magentaWood,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.85, 10, 1, 16, 0.9],
        },
      });
    }
    if (!map.getLayer("neon-landcover-nebula-indigo")) {
      map.addLayer({
        id: "neon-landcover-nebula-indigo",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: [
          "match",
          ["get", "class"],
          ["wood", "scrub", "grass", "wetland"],
          true,
          false,
        ],
        paint: {
          "fill-color": NEON.nebulaPurpleDeep,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.65, 12, 0.95],
        },
      });
    }
    if (!map.getLayer("neon-landcover-nebula-violet")) {
      map.addLayer({
        id: "neon-landcover-nebula-violet",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "scrub"], true, false],
        paint: {
          "fill-color": NEON.nebulaPurple,
          "fill-opacity": 0.88,
        },
      });
    }
  }

  function addNeonUrbanVeil() {
    ensureStreetsSource();
    if (!map.getLayer("neon-urban-landuse")) {
      map.addLayer({
        id: "neon-urban-landuse",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landuse",
        filter: [
          "match",
          ["get", "class"],
          [
            "industrial",
            "commercial",
            "residential",
            "neighbourhood",
            "neighborhood",
            "suburban",
            "urban",
          ],
          true,
          false,
        ],
        paint: {
          "fill-color": NEON.landUrban,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.72, 11, 0.9, 16, 0.94],
        },
      });
    }
    if (!map.getLayer("neon-urban-magenta-haze")) {
      map.addLayer({
        id: "neon-urban-magenta-haze",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landuse",
        filter: [
          "match",
          ["get", "class"],
          [
            "industrial",
            "commercial",
            "residential",
            "neighbourhood",
            "neighborhood",
            "suburban",
            "urban",
            "park",
          ],
          true,
          false,
        ],
        paint: {
          "fill-color": NEON.urbanVeil,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.35, 12, 0.5, 16, 0.4],
        },
      });
    }
  }

  /** Subtle DEM hillshade + terrain-v2 vector relief (soft sculpted glow). */
  function addReliefStack() {
    ensureTopoSource();
    if (!map.getLayer("neon-hillshade-raster")) {
      map.addLayer({
        id: "neon-hillshade-raster",
        type: "hillshade",
        source: "mapbox-dem",
        paint: {
          "hillshade-shadow-color": NEON.hillShadow,
          "hillshade-highlight-color": NEON.hillHighlight,
          "hillshade-accent-color": NEON.hillAccent,
          "hillshade-exaggeration": 0.16,
          "hillshade-method": "standard",
          "hillshade-illumination-direction": 300,
          "hillshade-illumination-anchor": "viewport",
        },
      });
    }
    if (!map.getLayer("neon-relief-vector-shadow")) {
      map.addLayer({
        id: "neon-relief-vector-shadow",
        type: "fill",
        source: "mapbox-topo-v2",
        "source-layer": "hillshade",
        filter: ["==", ["get", "class"], "shadow"],
        paint: {
          "fill-antialias": false,
          "fill-color": [
            "match",
            ["get", "level"],
            56,
            NEON.reliefVectorShadowDeep,
            67,
            NEON.reliefVectorShadow,
            78,
            NEON.reliefVectorShadow,
            NEON.reliefVectorShadow,
          ],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 10, 0.55, 14, 0.42],
        },
      });
    }
    if (!map.getLayer("neon-relief-vector-highlight")) {
      map.addLayer({
        id: "neon-relief-vector-highlight",
        type: "fill",
        source: "mapbox-topo-v2",
        "source-layer": "hillshade",
        filter: ["==", ["get", "class"], "highlight"],
        paint: {
          "fill-antialias": false,
          "fill-color": [
            "match",
            ["get", "level"],
            94,
            NEON.reliefVectorHighlightCore,
            90,
            NEON.reliefVectorHighlight,
            NEON.reliefVectorHighlight,
          ],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.28, 10, 0.48, 14, 0.38],
        },
      });
    }
  }

  /**
   * Cinematic stack (bottom → top): relief → atmospheric land → topography → hydro → transit → structures → framing.
   * Layers appended in call order; no Mapbox template land/water reliance when using built-in empty style.
   */
  function mountNeonBasemapLayers() {
    ensureTopoSource();
    ensureStreetsSource();

    addReliefStack();
    addAtmosphericLandFills();
    addNeonUrbanVeil();

    /**
     * Terrain-v2: index lines from ~z9; dense lines from z12+. Very thin neutral strokes + low opacity (ref).
     */
    if (!map.getLayer("neon-contour-line")) {
      map.addLayer(
        {
          id: "neon-contour-line",
          type: "line",
          source: "mapbox-topo-v2",
          "source-layer": "contour",
          filter: ["!=", ["get", "index"], -1],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "match",
              ["coalesce", ["get", "index"], 1],
              10,
              NEON.contourLineIndex,
              5,
              NEON.contourLineIndex,
              NEON.contourLine,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.25],
              ["zoom"],
              9,
              contourWidthByIndex(0.26, 0.23, 0.2, 0.16),
              12,
              contourWidthByIndex(0.36, 0.32, 0.28, 0.22),
              16,
              contourWidthByIndex(0.48, 0.42, 0.36, 0.28),
              22,
              contourWidthByIndex(0.62, 0.54, 0.44, 0.34),
            ],
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              0,
              9,
              0.26,
              11.5,
              0.32,
              14,
              0.36,
              18,
              0.34,
              22,
              0.3,
            ],
            "line-blur": 0.28,
          },
        },
      );
    }

    /* Luminous cyan water (center read) + halo at shore */
    if (!map.getLayer("neon-water-fill")) {
      map.addLayer(
        {
          id: "neon-water-fill",
          type: "fill",
          source: STREETS_ID,
          "source-layer": "water",
          paint: {
            "fill-color": NEON.waterCore,
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.94, 8, 1, 16, 1],
          },
        },
      );
    }

    if (!map.getLayer("neon-water-depth")) {
      map.addLayer(
        {
          id: "neon-water-depth",
          type: "fill",
          source: STREETS_ID,
          "source-layer": "water",
          paint: {
            "fill-color": NEON.waterDepth,
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.18, 8, 0.12, 14, 0.08],
          },
        },
      );
    }

    if (!map.getLayer("neon-water-glow-patch")) {
      map.addLayer(
        {
          id: "neon-water-glow-patch",
          type: "fill",
          source: STREETS_ID,
          "source-layer": "water",
          paint: {
            "fill-color": NEON.waterInnerGlow,
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.12, 10, 0.22, 16, 0.18],
          },
        },
      );
    }

    if (!map.getLayer("neon-coast-glow-outer")) {
      map.addLayer(
        {
          id: "neon-coast-glow-outer",
          type: "line",
          source: STREETS_ID,
          "source-layer": "water",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.coastHaloOuter,
            "line-width": expWidth(4, 18, 5, 24, 1.2),
            "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 10, 18, 20],
            "line-opacity": 0.52,
          },
        },
      );
    }

    if (!map.getLayer("neon-coast-glow-mid")) {
      map.addLayer(
        {
          id: "neon-coast-glow-mid",
          type: "line",
          source: STREETS_ID,
          "source-layer": "water",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.coastHaloMid,
            "line-width": expWidth(5, 18, 2, 7, 1.2),
            "line-blur": 2.8,
            "line-opacity": 0.62,
          },
        },
      );
    }

    if (!map.getLayer("neon-coast-glow-inner")) {
      map.addLayer(
        {
          id: "neon-coast-glow-inner",
          type: "line",
          source: STREETS_ID,
          "source-layer": "water",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.coastHaloInner,
            "line-width": expWidth(6, 20, 0.5, 2, 1.15),
            "line-blur": 0.65,
            "line-opacity": 0.72,
          },
        },
      );
    }

    if (!map.getLayer("neon-water-edge")) {
      map.addLayer(
        {
          id: "neon-water-edge",
          type: "line",
          source: STREETS_ID,
          "source-layer": "water",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.waterDepth,
            "line-width": expWidth(13, 22, 0.3, 1.65, 1.15),
            "line-opacity": 0.4,
          },
        },
      );
    }

    /* Cool gray roads, dark outline + light bloom (matches right ref) */
    if (!map.getLayer("neon-road-freeway-casing")) {
      map.addLayer(
        {
          id: "neon-road-freeway-casing",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["==", ["get", "class"], "motorway"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadCasing,
            "line-width": expWidth(12, 22, 0.85, 4.8, 1.28),
            "line-opacity": 1,
          },
        },
      );
    }

    if (!map.getLayer("neon-road-freeway")) {
      map.addLayer(
        {
          id: "neon-road-freeway",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["==", ["get", "class"], "motorway"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadGray,
            "line-width": expWidth(12, 22, 0.48, 3.65, 1.28),
            "line-opacity": 1,
            "line-blur": NEON.roadBloomBlur,
          },
        },
      );
    }

    if (!map.getLayer("neon-road-arterial-casing")) {
      map.addLayer(
        {
          id: "neon-road-arterial-casing",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: [
            "match",
            ["get", "class"],
            ["trunk", "primary", "secondary"],
            true,
            false,
          ],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadCasing,
            "line-width": expWidth(12, 22, 0.62, 3.15, 1.25),
            "line-opacity": 1,
          },
        },
      );
    }

    if (!map.getLayer("neon-road-arterial")) {
      map.addLayer(
        {
          id: "neon-road-arterial",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: [
            "match",
            ["get", "class"],
            ["trunk", "primary", "secondary"],
            true,
            false,
          ],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadGray,
            "line-width": expWidth(12, 22, 0.35, 2.25, 1.25),
            "line-opacity": 1,
            "line-blur": 0.72,
          },
        },
      );
    }

    if (!map.getLayer("neon-road-local-casing")) {
      map.addLayer(
        {
          id: "neon-road-local-casing",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: [
            "match",
            ["get", "class"],
            ["motorway_link", "street", "tertiary"],
            true,
            false,
          ],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadCasing,
            "line-width": expWidth(13, 22, 0.42, 1.75, 1.2),
            "line-opacity": 0.95,
          },
        },
      );
    }

    if (!map.getLayer("neon-road-local")) {
      map.addLayer(
        {
          id: "neon-road-local",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: [
            "match",
            ["get", "class"],
            ["motorway_link", "street", "tertiary"],
            true,
            false,
          ],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadGrayBright,
            "line-width": expWidth(13, 22, 0.2, 1.05, 1.2),
            "line-opacity": 0.94,
            "line-blur": 0.55,
          },
        },
      );
    }

    if (!map.getLayer("neon-path-casing")) {
      map.addLayer(
        {
          id: "neon-path-casing",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["==", ["get", "class"], "path"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadCasing,
            "line-width": expWidth(14, 22, 0.36, 1.12, 1.15),
            "line-opacity": 0.88,
          },
        },
      );
    }

    if (!map.getLayer("neon-path")) {
      map.addLayer(
        {
          id: "neon-path",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["==", ["get", "class"], "path"],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadGrayBright,
            "line-width": expWidth(14, 22, 0.16, 0.68, 1.15),
            "line-opacity": 0.78,
            "line-blur": 0.5,
            "line-dasharray": [2, 3],
          },
        },
      );
    }

    if (!map.getLayer("neon-rail-casing")) {
      map.addLayer(
        {
          id: "neon-rail-casing",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["match", ["get", "class"], ["major_rail", "minor_rail"], true, false],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.roadCasing,
            "line-width": expWidth(12, 22, 0.52, 2.55, 1.26),
            "line-opacity": 1,
          },
        },
      );
    }

    if (!map.getLayer("neon-rail")) {
      map.addLayer(
        {
          id: "neon-rail",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["match", ["get", "class"], ["major_rail", "minor_rail"], true, false],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.railGray,
            "line-width": expWidth(12, 22, 0.32, 1.92, 1.26),
            "line-opacity": 1,
            "line-blur": 0.55,
          },
        },
      );
    }

    if (!map.getLayer("neon-rail-ties")) {
      map.addLayer(
        {
          id: "neon-rail-ties",
          type: "line",
          source: STREETS_ID,
          "source-layer": "road",
          filter: ["match", ["get", "class"], ["major_rail", "minor_rail"], true, false],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.railGray,
            "line-width": expWidth(12, 22, 0.3, 1.75, 1.26),
            "line-opacity": 0.48,
            "line-dasharray": [0.3, 2.2],
          },
        },
      );
    }

    if (!map.getLayer("neon-building-fill")) {
      map.addLayer(
        {
          id: "neon-building-fill",
          type: "fill",
          source: STREETS_ID,
          "source-layer": "building",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["to-number", ["coalesce", ["get", "render_height"], ["get", "height"], 14]],
              0,
              NEON.buildingFillMuted,
              16,
              NEON.buildingFill,
              48,
              NEON.buildingFillLight,
              140,
              "#f0f0fa",
            ],
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, 0.82, 22, 0.92],
          },
        },
      );
    }

    if (!map.getLayer("neon-building-line")) {
      map.addLayer(
        {
          id: "neon-building-line",
          type: "line",
          source: STREETS_ID,
          "source-layer": "building",
          layout: { "line-join": "miter", "line-cap": "butt" },
          paint: {
            "line-color": NEON.buildingLine,
            "line-width": expWidth(13, 22, 0.35, 1.45, 1.22),
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, 0.88, 22, 0.95],
          },
        },
      );
    }

    if (!map.getLayer("neon-border-land")) {
      map.addLayer(
        {
          id: "neon-border-land",
          type: "line",
          source: STREETS_ID,
          "source-layer": "admin",
          filter: ["!", ["boolean", ["get", "maritime"], false]],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.borderWhite,
            "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.35, 6, 0.65, 12, 0.95, 22, 1.15],
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0, 3, 0.88, 22, 1],
            "line-dasharray": [3, 2],
          },
        },
      );
    }

    if (!map.getLayer("neon-maritime-dash")) {
      map.addLayer(
        {
          id: "neon-maritime-dash",
          type: "line",
          source: STREETS_ID,
          "source-layer": "admin",
          filter: ["boolean", ["get", "maritime"], false],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": NEON.maritimeWhite,
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 10, 0.75, 16, 1],
            "line-opacity": 0.72,
            "line-dasharray": [2, 3],
          },
        },
      );
    }
  }

  map.once("idle", () => {
    try {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      mountNeonBasemapLayers();
      applyNeonFog();
    } catch (e) {
      console.warn("Neon basemap stack:", e);
    }
    setTerrain(true);
  });

  btnTerrain.addEventListener("click", () => {
    setTerrain(!terrainOn);
  });

  map.scrollZoom.enable();
  map.doubleClickZoom.enable();
  map.dragPan.enable();
  map.keyboard.enable();
  map.touchZoomRotate.enable();
}
