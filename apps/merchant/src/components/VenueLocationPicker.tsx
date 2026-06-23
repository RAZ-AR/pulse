"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef, useState } from "react"
import { AddressAutocomplete } from "./AddressAutocomplete"
import { reverseGeocode } from "../lib/places"

// Map-first location picker: search bar over the map, click/drag to drop the
// pin, and the built-in "locate me" control. MapLibre comes from the npm
// package (loaded client-side) with free OSM raster tiles — no key, no CDN.

export type VenueLocation = { address: string; city: string; lat: number; lng: number }

const BELGRADE = { lat: 44.8125, lng: 20.4612 }
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

export function VenueLocationPicker({
  initial,
  onChange,
}: {
  initial?: Partial<VenueLocation>
  onChange: (loc: VenueLocation | null) => void
}) {
  const [address, setAddress] = useState(initial?.address ?? "")
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

  // Push the current state up whenever we have coordinates.
  function emit() {
    const c = coordsRef.current
    onChangeRef.current(c ? { address: addressRef.current.trim(), city: cityRef.current || "Belgrade", lat: c.lat, lng: c.lng } : null)
  }

  // Drop / move the pin to a point, then reverse-geocode to fill the address.
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

  // Init the map once (client-side dynamic import avoids any SSR window access).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const maplibregl = (await import("maplibre-gl")).default
      if (cancelled || !hostRef.current || mapRef.current) return
      const start: [number, number] = [coordsRef.current?.lng ?? BELGRADE.lng, coordsRef.current?.lat ?? BELGRADE.lat]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = new maplibregl.Map({ container: hostRef.current, style: OSM_STYLE as any, center: start, zoom: coordsRef.current ? 16 : 13 })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true })
      map.addControl(geo, "top-right")
      const marker = new maplibregl.Marker({ color: "#fd4600", draggable: true })
      if (coordsRef.current) marker.setLngLat(start).addTo(map)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => setFromPoint(e.lngLat.lat, e.lngLat.lng))
      marker.on("dragend", () => { const ll = marker.getLngLat(); setFromPoint(ll.lat, ll.lng) })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geo.on("geolocate", (pos: any) => { map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }); setFromPoint(pos.coords.latitude, pos.coords.longitude) })
      mapRef.current = map
      markerRef.current = marker
    })()
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search pick: recenter, drop the pin, lock the address.
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
      <div ref={hostRef} className="w-full rounded-lg overflow-hidden border border-[#E5E7EB]" style={{ height: 360 }} />
      <p className="mt-1 text-xs text-[#9CA3AF]">Найдите адрес, кликните по карте или нажмите ⊙, чтобы поставить точку.</p>
    </div>
  )
}
