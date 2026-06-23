"use client"

import { useEffect, useRef, useState } from "react"
import { AddressAutocomplete } from "./AddressAutocomplete"
import { reverseGeocode } from "../lib/places"

// Map-first location picker: search bar over the map, click/drag to drop the
// pin, and a "locate me" control. MapLibre is loaded from CDN (UMD) so there's
// no bundler/worker variability — same path the rest of the app uses.

export type VenueLocation = { address: string; city: string; lat: number; lng: number }

const BELGRADE = { lat: 44.8125, lng: 20.4612 }
const MAPLIBRE_VER = "4.7.1"
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

let mapLibrePromise: Promise<unknown> | null = null
function loadMapLibre(): Promise<Record<string, unknown>> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  const w = window as unknown as { maplibregl?: Record<string, unknown> }
  if (w.maplibregl) return Promise.resolve(w.maplibregl)
  if (!mapLibrePromise) {
    mapLibrePromise = new Promise((resolve, reject) => {
      if (!document.getElementById("maplibre-css")) {
        const css = document.createElement("link")
        css.id = "maplibre-css"
        css.rel = "stylesheet"
        css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`
        document.head.appendChild(css)
      }
      const js = document.createElement("script")
      js.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`
      js.onload = () => resolve(w.maplibregl as Record<string, unknown>)
      js.onerror = () => reject(new Error("Не удалось загрузить карту (CDN)"))
      document.head.appendChild(js)
    })
  }
  return mapLibrePromise as Promise<Record<string, unknown>>
}

export function VenueLocationPicker({
  initial,
  onChange,
}: {
  initial?: Partial<VenueLocation>
  onChange: (loc: VenueLocation | null) => void
}) {
  const [address, setAddress] = useState(initial?.address ?? "")
  const [err, setErr] = useState("")
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const coordsRef = useRef<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null,
  )
  const cityRef = useRef(initial?.city ?? "")
  const addressRef = useRef(address)
  addressRef.current = address
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function emit() {
    const c = coordsRef.current
    onChangeRef.current(c ? { address: addressRef.current.trim(), city: cityRef.current || "Belgrade", lat: c.lat, lng: c.lng } : null)
  }

  async function setFromPoint(lat: number, lng: number) {
    coordsRef.current = { lat, lng }
    if (markerRef.current && mapRef.current) markerRef.current.setLngLat([lng, lat]).addTo(mapRef.current)
    emit()
    const r = await reverseGeocode(lat, lng)
    if (r?.address) {
      cityRef.current = r.city || cityRef.current
      setAddress(r.address)
      addressRef.current = r.address
      emit()
    }
  }

  // Init the map once.
  useEffect(() => {
    let cancelled = false
    loadMapLibre()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((gl: any) => {
        if (cancelled || !hostRef.current || mapRef.current) return
        const start: [number, number] = [coordsRef.current?.lng ?? BELGRADE.lng, coordsRef.current?.lat ?? BELGRADE.lat]
        const map = new gl.Map({ container: hostRef.current, style: OSM_STYLE, center: start, zoom: coordsRef.current ? 16 : 13 })
        map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right")
        const geo = new gl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true })
        map.addControl(geo, "top-right")
        const marker = new gl.Marker({ color: "#fd4600", draggable: true })
        if (coordsRef.current) marker.setLngLat(start).addTo(map)
        // Container is often sized after first paint — resize once tiles can flow.
        map.on("load", () => map.resize())
        setTimeout(() => { try { map.resize() } catch { /* ignore */ } }, 200)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", (e: any) => setFromPoint(e.lngLat.lat, e.lngLat.lng))
        marker.on("dragend", () => { const ll = marker.getLngLat(); setFromPoint(ll.lat, ll.lng) })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geo.on("geolocate", (pos: any) => { map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }); setFromPoint(pos.coords.latitude, pos.coords.longitude) })
        mapRef.current = map
        markerRef.current = marker
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Карта недоступна"))
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearchPick(p: VenueLocation) {
    coordsRef.current = { lat: p.lat, lng: p.lng }
    cityRef.current = p.city
    setAddress(p.address)
    addressRef.current = p.address
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([p.lng, p.lat]).addTo(mapRef.current)
      mapRef.current.easeTo({ center: [p.lng, p.lat], zoom: 16 })
    }
    emit()
  }

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 right-12 z-10">
        <AddressAutocomplete
          value={address}
          onChange={(t) => { setAddress(t); addressRef.current = t; emit() }}
          onPick={handleSearchPick}
          cityHint={cityRef.current}
          placeholder="Найти адрес…"
        />
      </div>
      <div ref={hostRef} className="w-full rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#E9EDF0]" style={{ height: 360 }} />
      {err
        ? <p className="mt-1 text-xs text-red-600">{err}. Найдите адрес в строке поиска — точка поставится без карты.</p>
        : <p className="mt-1 text-xs text-[#9CA3AF]">Найдите адрес, кликните по карте или нажмите ⊙, чтобы поставить точку.</p>}
    </div>
  )
}
