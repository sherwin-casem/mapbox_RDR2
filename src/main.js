import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./styles.css";

import { resolveMapboxToken, createNeonBasemapStyle, getMapStyleRef, mapView } from "./mapConfig.js";

const TACTICAL = {
  background: "#22003d",
  urban: "#2e004f",
  buildings: "rgba(220,215,240,0.38)",
  buildingOutline: "rgba(30,10,50,0.45)",
  highway: "#f1ecff",
  primaryRoad: "#d8d4ea",
  localRoad: "#b5b1ca",
  roadOutline: "#2b1144",
  water: "#006dff",
  coastline: "#94d7ff",
  contours: "rgba(220,220,230,0.12)",
  terrainShadow: "rgba(34, 0, 61, 0.22)",
  terrainHighlight: "rgba(70, 30, 115, 0.2)",
  terrainAccent: "rgba(110, 74, 160, 0.18)",
  rail: "#b9b4d3",
  border: "#f2eeff",
};

function expWidth(zMin, zMax, wMin, wMax, base = 1.2) {
  return ["interpolate", ["exponential", base], ["zoom"], zMin, wMin, zMax, wMax];
}

function contourWidthByIndex(w10, w5, w2, w1) {
  return ["match", ["coalesce", ["get", "index"], 1], 10, w10, 5, w5, 2, w2, -1, 0, w1];
}

function addRoadLayer(map, id, source, sourceLayer, filter, color, width, opacity = 1) {
  if (map.getLayer(id)) return;
  map.addLayer({
    id,
    type: "line",
    source,
    "source-layer": sourceLayer,
    filter,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": color,
      "line-width": width,
      "line-opacity": opacity,
    },
  });
}

function addRoadCasing(map, id, source, sourceLayer, filter, width) {
  addRoadLayer(map, id, source, sourceLayer, filter, TACTICAL.roadOutline, width, 1);
}

function addRoadFill(map, id, source, sourceLayer, filter, color, width) {
  addRoadLayer(map, id, source, sourceLayer, filter, color, width, 1);
}

mapboxgl.accessToken = resolveMapboxToken();

if (!mapboxgl.accessToken) {
  document.body.innerHTML =
    '<div style="padding:24px;font-family:system-ui;max-width:520px;line-height:1.5">' +
    "<strong>Mapbox token required.</strong><br><br>" +
    "Create <code>.env.local</code> with <code>VITE_MAPBOX_TOKEN=YOUR_PK_TOKEN</code> and run " +
    "<code>npm run dev</code>, or visit with <code>?token=YOUR_PK_TOKEN</code> once.<br><br>" +
    "This map now uses a flat tactical basemap stack." +
    "</div>";
} else {
  const map = new mapboxgl.Map({
    container: "map",
    style: getMapStyleRef() ?? createNeonBasemapStyle(TACTICAL.background),
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
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
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

  const STREETS_ID = "overlay-streets-v8";
  const TOPO_ID = "mapbox-topo-v2";
  let terrainOn = true;

  function ensureStreetsSource() {
    if (!map.getSource(STREETS_ID)) {
      map.addSource(STREETS_ID, {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });
    }
  }

  function ensureTopoSource() {
    if (!map.getSource(TOPO_ID)) {
      map.addSource(TOPO_ID, {
        type: "vector",
        url: "mapbox://mapbox.mapbox-terrain-v2",
      });
    }
  }

  function setTerrain(enabled) {
    terrainOn = enabled;
    btnTerrain.setAttribute("aria-pressed", String(enabled));
    map.setTerrain(enabled ? { source: "mapbox-dem", exaggeration: 1.03 } : null);
  }

  function mountTacticalLayers() {
    ensureStreetsSource();
    ensureTopoSource();

    // 1) background (already present in base style)

    // 2) terrain (subtle, non-cinematic)
    if (!map.getLayer("tactical-terrain")) {
      map.addLayer({
        id: "tactical-terrain",
        type: "hillshade",
        source: "mapbox-dem",
        paint: {
          "hillshade-shadow-color": TACTICAL.terrainShadow,
          "hillshade-highlight-color": TACTICAL.terrainHighlight,
          "hillshade-accent-color": TACTICAL.terrainAccent,
          "hillshade-exaggeration": 0.08,
          "hillshade-illumination-direction": 300,
          "hillshade-illumination-anchor": "viewport",
        },
      });
    }

    // Flat water under urban overlays; no glow halos.
    if (!map.getLayer("tactical-water-fill")) {
      map.addLayer({
        id: "tactical-water-fill",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "water",
        paint: {
          "fill-color": TACTICAL.water,
          "fill-opacity": 1,
        },
      });
    }
    if (!map.getLayer("tactical-water-coastline")) {
      map.addLayer({
        id: "tactical-water-coastline",
        type: "line",
        source: STREETS_ID,
        "source-layer": "water",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": TACTICAL.coastline,
          "line-width": expWidth(4, 18, 0.25, 0.9, 1.1),
          "line-opacity": 0.8,
        },
      });
    }

    // 3) urban fills (flat land cartography)
    if (!map.getLayer("tactical-landcover-base")) {
      map.addLayer({
        id: "tactical-landcover-base",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landuse",
        paint: {
          "fill-color": TACTICAL.urban,
          "fill-opacity": 0.94,
        },
      });
    }
    if (!map.getLayer("tactical-landcover-wood")) {
      map.addLayer({
        id: "tactical-landcover-wood",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "scrub", "grass", "crop", "wetland", "snow"], true, false],
        paint: {
          "fill-color": TACTICAL.urban,
          "fill-opacity": 0.84,
        },
      });
    }

    // 4) buildings (flat and subordinate)
    if (!map.getLayer("tactical-building-fill")) {
      map.addLayer({
        id: "tactical-building-fill",
        type: "fill",
        source: STREETS_ID,
        "source-layer": "building",
        paint: {
          "fill-color": TACTICAL.buildings,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, 0.18, 16, 0.28, 22, 0.34],
        },
      });
    }
    if (!map.getLayer("tactical-building-line")) {
      map.addLayer({
        id: "tactical-building-line",
        type: "line",
        source: STREETS_ID,
        "source-layer": "building",
        layout: { "line-join": "miter", "line-cap": "butt" },
        paint: {
          "line-color": TACTICAL.buildingOutline,
          "line-width": expWidth(12, 22, 0.2, 0.6, 1.15),
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 0.5, 16, 0.6, 22, 0.7],
        },
      });
    }

    // 5) contour lines (subtle and sharp)
    if (!map.getLayer("tactical-contour-line")) {
      map.addLayer({
        id: "tactical-contour-line",
        type: "line",
        source: TOPO_ID,
        "source-layer": "contour",
        filter: ["!=", ["get", "index"], -1],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": TACTICAL.contours,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            9,
            contourWidthByIndex(0.2, 0.18, 0.16, 0.14),
            14,
            contourWidthByIndex(0.3, 0.26, 0.22, 0.18),
            22,
            contourWidthByIndex(0.5, 0.42, 0.34, 0.26),
          ],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 10, 0.35, 16, 0.5, 22, 0.38],
        },
      });
    }

    // 6) rail
    if (!map.getLayer("tactical-rail")) {
      map.addLayer({
        id: "tactical-rail",
        type: "line",
        source: STREETS_ID,
        "source-layer": "road",
        filter: ["match", ["get", "class"], ["major_rail", "minor_rail"], true, false],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": TACTICAL.rail,
          "line-width": expWidth(11, 22, 0.25, 1.1, 1.2),
          "line-opacity": 0.9,
        },
      });
    }

    // 7) borders
    if (!map.getLayer("tactical-border-land")) {
      map.addLayer({
        id: "tactical-border-land",
        type: "line",
        source: STREETS_ID,
        "source-layer": "admin",
        filter: ["!", ["boolean", ["get", "maritime"], false]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": TACTICAL.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.25, 6, 0.5, 12, 0.75, 22, 1],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0, 4, 0.72, 22, 0.9],
          "line-dasharray": [3, 2.5],
        },
      });
    }
    if (!map.getLayer("tactical-border-maritime")) {
      map.addLayer({
        id: "tactical-border-maritime",
        type: "line",
        source: STREETS_ID,
        "source-layer": "admin",
        filter: ["boolean", ["get", "maritime"], false],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": TACTICAL.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.25, 10, 0.55, 16, 0.8],
          "line-opacity": 0.58,
          "line-dasharray": [2, 3],
        },
      });
    }

    // 8-10) all roads LAST (thick corridor style)
    const motorwayFilter = ["==", ["get", "class"], "motorway"];
    const arterialFilter = ["match", ["get", "class"], ["secondary", "primary", "trunk"], true, false];
    const localFilter = [
      "match",
      ["get", "class"],
      ["street", "tertiary", "motorway_link", "path"],
      true,
      false,
    ];

    // Local roads: casing 2-6px, fill 1.2-4px
    addRoadCasing(
      map,
      "tactical-road-local-casing",
      STREETS_ID,
      "road",
      localFilter,
      expWidth(10, 22, 2, 6, 1.2),
    );
    addRoadFill(
      map,
      "tactical-road-local",
      STREETS_ID,
      "road",
      localFilter,
      TACTICAL.localRoad,
      expWidth(10, 22, 1.2, 4, 1.2),
    );

    // Arterials: casing 4-12px, fill 2.5-9px
    addRoadCasing(
      map,
      "tactical-road-arterial-casing",
      STREETS_ID,
      "road",
      arterialFilter,
      expWidth(10, 22, 4, 12, 1.22),
    );
    addRoadFill(
      map,
      "tactical-road-arterial",
      STREETS_ID,
      "road",
      arterialFilter,
      TACTICAL.primaryRoad,
      expWidth(10, 22, 2.5, 9, 1.22),
    );

    // Motorways: casing 6-18px, fill 4-14px
    addRoadCasing(
      map,
      "tactical-road-highway-casing",
      STREETS_ID,
      "road",
      motorwayFilter,
      expWidth(10, 22, 6, 18, 1.25),
    );
    addRoadFill(
      map,
      "tactical-road-highway",
      STREETS_ID,
      "road",
      motorwayFilter,
      TACTICAL.highway,
      expWidth(10, 22, 4, 14, 1.25),
    );
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
      mountTacticalLayers();
    } catch (e) {
      console.warn("Tactical basemap stack:", e);
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
