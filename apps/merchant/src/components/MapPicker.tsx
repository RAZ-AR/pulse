"use client"

import { useEffect, useRef } from "react"

// MapLibre is loaded from CDN so there's no npm dep / bundler config. Free OSM
// raster tiles, no key. The merchant drags (or clicks) the pin to set the exact
// venue spot when the geocoder lands a few doors off.

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

const MAPLIBRE_VER = "4.7.1"
let mapLibrePromise: Promise<unknown> | null = null
function loadMapLibre(): Promise<Record<string, unknown>> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  const w = window as unknown as { maplibregl?: Record<string, unknown> }
  if (w.maplibregl) return Promise.resolve(w.maplibregl)
  if (!mapLibrePromise) {
    mapLibrePromise = new Promise((resolve, reject) => {
      const css = document.createElement("link")
      css.rel = "stylesheet"
      css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`
      document.head.appendChild(css)
      const js = document.createElement("script")
      js.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`
      js.onload = () => resolve(w.maplibregl as Record<string, unknown>)
      js.onerror = () => reject(new Error("maplibre failed to load"))
      document.head.appendChild(js)
    })
  }
  return mapLibrePromise as Promise<Record<string, unknown>>
}

export function MapPicker({
  lat,
  lng,
  onMove,
}: {
  lat: number
  lng: number
  onMove: (lat: number, lng: number) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  // Init once.
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadMapLibre().then((gl: any) => {
      if (cancelled || !hostRef.current || mapRef.current) return
      const map = new gl.Map({ container: hostRef.current, style: OSM_STYLE, center: [lng, lat], zoom: 15 })
      map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right")
      const marker = new gl.Marker({ color: "#fd4600", draggable: true }).setLngLat([lng, lat]).addTo(map)
      marker.on("dragend", () => { const ll = marker.getLngLat(); onMoveRef.current(ll.lat, ll.lng) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => { marker.setLngLat(e.lngLat); onMoveRef.current(e.lngLat.lat, e.lngLat.lng) })
      mapRef.current = map
      markerRef.current = marker
    }).catch(() => {})
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recenter + move the pin when coords change from the outside (address picked).
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return
    markerRef.current.setLngLat([lng, lat])
    mapRef.current.easeTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom?.() ?? 15, 15) })
  }, [lat, lng])

  return (
    <div ref={hostRef} className="w-full rounded-lg overflow-hidden border border-[#E5E7EB]" style={{ height: 240 }} />
  )
}
