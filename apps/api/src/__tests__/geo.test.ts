import { describe, it, expect } from "vitest"
import { haversineKm, haversineMeters, boundingBox } from "@pulse/shared"

// Belgrade center
const BELGRADE = { lat: 44.8176, lng: 20.457 }
// Novi Sad, ~80km north
const NOVI_SAD = { lat: 45.267, lng: 19.833 }

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(44.8176, 20.457, 44.8176, 20.457)).toBe(0)
  })

  it("Belgrade → Novi Sad is ~65-75 km", () => {
    const km = haversineKm(BELGRADE.lat, BELGRADE.lng, NOVI_SAD.lat, NOVI_SAD.lng)
    expect(km).toBeGreaterThan(65)
    expect(km).toBeLessThan(75)
  })
})

describe("haversineMeters", () => {
  it("is haversineKm × 1000", () => {
    const km = haversineKm(BELGRADE.lat, BELGRADE.lng, NOVI_SAD.lat, NOVI_SAD.lng)
    const m = haversineMeters(BELGRADE.lat, BELGRADE.lng, NOVI_SAD.lat, NOVI_SAD.lng)
    expect(m).toBeCloseTo(km * 1000, 0)
  })
})

describe("boundingBox", () => {
  it("point inside 1km box is within bounds", () => {
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 1)
    const nearby = { lat: BELGRADE.lat + 0.005, lng: BELGRADE.lng + 0.005 }
    expect(nearby.lat).toBeGreaterThan(box.minLat)
    expect(nearby.lat).toBeLessThan(box.maxLat)
    expect(nearby.lng).toBeGreaterThan(box.minLng)
    expect(nearby.lng).toBeLessThan(box.maxLng)
  })

  it("box is symmetric around center", () => {
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 2)
    expect(BELGRADE.lat - box.minLat).toBeCloseTo(box.maxLat - BELGRADE.lat, 5)
    expect(BELGRADE.lng - box.minLng).toBeCloseTo(box.maxLng - BELGRADE.lng, 5)
  })
})
