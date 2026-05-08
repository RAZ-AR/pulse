export type VenueCategory = "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER"

export type CityOption = {
  name: "Belgrade" | "Novi Sad"
  label: string
  lat: number
  lng: number
  radiusKm: number
}

export type VenueFilter = {
  key: string
  label: string
  category?: VenueCategory
}

export type DemoVenue = {
  id: string
  name: string
  category: VenueCategory
  description: string
  city: "Belgrade" | "Novi Sad"
  country: string
  address: string
  lat: number
  lng: number
  photos: string[]
  isPartner: boolean
  pointsPerCurrency: number | null
  currency: string | null
  boostMultiplier: number | null
  boostUntil: Date | null
  subscriptionTier: "BASIC" | "PRO" | "FEATURED" | null
  enableDiscount: boolean
  maxDiscountPercent: number
  googleRating: number | null
  googleReviews: number | null
  distanceMeters: number
}

export const DEFAULT_CITY: CityOption = { name: "Belgrade", label: "Belgrade", lat: 44.8125, lng: 20.4612, radiusKm: 12 }

export const CITY_OPTIONS: CityOption[] = [
  DEFAULT_CITY,
  { name: "Novi Sad", label: "Novi Sad", lat: 45.2671, lng: 19.8335, radiusKm: 12 },
]

export const DEFAULT_VENUE_FILTER: VenueFilter = { key: "all", label: "All" }

export const VENUE_FILTERS: VenueFilter[] = [
  DEFAULT_VENUE_FILTER,
  { key: "cafe", label: "Cafe", category: "CAFE" },
  { key: "coffee", label: "Coffee", category: "CAFE" },
  { key: "restaurant", label: "Restaurant", category: "RESTAURANT" },
  { key: "japanese", label: "Japanese", category: "RESTAURANT" },
  { key: "pizza", label: "Pizza", category: "RESTAURANT" },
  { key: "bar", label: "Bar", category: "RESTAURANT" },
  { key: "beauty", label: "Beauty", category: "SERVICE" },
  { key: "stores", label: "Stores", category: "RETAIL" },
]

export const DEMO_VENUES: DemoVenue[] = [
  {
    id: "demo_bg_willow",
    name: "Café Willow",
    category: "CAFE",
    description: "Specialty coffee, pastry rewards, Instagram-ready brunch table.",
    city: "Belgrade",
    country: "Serbia",
    address: "Skadarska 36, Dorćol",
    lat: 44.8198,
    lng: 20.4632,
    photos: [],
    isPartner: true,
    pointsPerCurrency: 0.008,
    currency: "RSD",
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: "FEATURED",
    enableDiscount: true,
    maxDiscountPercent: 30,
    googleRating: 4.7,
    googleReviews: 428,
    distanceMeters: 820,
  },
  {
    id: "demo_bg_jan",
    name: "JAN",
    category: "RESTAURANT",
    description: "Modern Serbian kitchen with high-value dessert and starter offers.",
    city: "Belgrade",
    country: "Serbia",
    address: "Đure Jakšića 12, Stari Grad",
    lat: 44.8185,
    lng: 20.4608,
    photos: [],
    isPartner: true,
    pointsPerCurrency: 0.008,
    currency: "RSD",
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: "PRO",
    enableDiscount: true,
    maxDiscountPercent: 50,
    googleRating: 4.8,
    googleReviews: 312,
    distanceMeters: 640,
  },
  {
    id: "demo_bg_torii",
    name: "Torii Sushi Bar",
    category: "RESTAURANT",
    description: "Japanese sets, lunch combos and check-in bonuses.",
    city: "Belgrade",
    country: "Serbia",
    address: "Kralja Petra 18, Dorćol",
    lat: 44.8201,
    lng: 20.4566,
    photos: [],
    isPartner: false,
    pointsPerCurrency: null,
    currency: null,
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: null,
    enableDiscount: false,
    maxDiscountPercent: 0,
    googleRating: 4.5,
    googleReviews: 219,
    distanceMeters: 980,
  },
  {
    id: "demo_bg_luma",
    name: "Luma Beauty",
    category: "SERVICE",
    description: "Beauty studio with appointment rewards and referral perks.",
    city: "Belgrade",
    country: "Serbia",
    address: "Njegoševa 42, Vračar",
    lat: 44.8047,
    lng: 20.4758,
    photos: [],
    isPartner: true,
    pointsPerCurrency: 0.006,
    currency: "RSD",
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: "BASIC",
    enableDiscount: true,
    maxDiscountPercent: 20,
    googleRating: 4.6,
    googleReviews: 144,
    distanceMeters: 1900,
  },
  {
    id: "demo_ns_mood",
    name: "Mood Coffee",
    category: "CAFE",
    description: "Soft espresso bar near the center with fast welcome rewards.",
    city: "Novi Sad",
    country: "Serbia",
    address: "Zmaj Jovina 8, Novi Sad",
    lat: 45.2568,
    lng: 19.8454,
    photos: [],
    isPartner: true,
    pointsPerCurrency: 0.007,
    currency: "RSD",
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: "FEATURED",
    enableDiscount: true,
    maxDiscountPercent: 25,
    googleRating: 4.7,
    googleReviews: 188,
    distanceMeters: 720,
  },
  {
    id: "demo_ns_sakura",
    name: "Sakura Novi Sad",
    category: "RESTAURANT",
    description: "Japanese bowls, sushi rewards and weekend bonus points.",
    city: "Novi Sad",
    country: "Serbia",
    address: "Dunavska 11, Novi Sad",
    lat: 45.2579,
    lng: 19.8499,
    photos: [],
    isPartner: false,
    pointsPerCurrency: null,
    currency: null,
    boostMultiplier: null,
    boostUntil: null,
    subscriptionTier: null,
    enableDiscount: false,
    maxDiscountPercent: 0,
    googleRating: 4.4,
    googleReviews: 96,
    distanceMeters: 1040,
  },
]

export function resolveCity(name: string | null | undefined): CityOption {
  return CITY_OPTIONS.find((city) => city.name.toLowerCase() === name?.toLowerCase()) ?? DEFAULT_CITY
}

export function nextCity(name: string | null | undefined): CityOption {
  const current = resolveCity(name)
  const currentIndex = CITY_OPTIONS.findIndex((city) => city.name === current.name)
  return CITY_OPTIONS[(currentIndex + 1) % CITY_OPTIONS.length] ?? DEFAULT_CITY
}

export function getDemoVenues(cityName: string | null | undefined, filter: VenueFilter = DEFAULT_VENUE_FILTER): DemoVenue[] {
  const city = resolveCity(cityName)
  return DEMO_VENUES
    .filter((venue) => venue.city === city.name)
    .filter((venue) => !filter.category || venue.category === filter.category)
    .filter((venue) => {
      if (filter.key === "japanese") return /japanese|sushi|sakura|torii/i.test(`${venue.name} ${venue.description}`)
      if (filter.key === "coffee") return /coffee|café|espresso/i.test(`${venue.name} ${venue.description}`)
      if (filter.key === "pizza") return /pizza/i.test(`${venue.name} ${venue.description}`)
      if (filter.key === "bar") return /bar/i.test(`${venue.name} ${venue.description}`)
      return true
    })
    .sort((a, b) => {
      if (a.isPartner !== b.isPartner) return a.isPartner ? -1 : 1
      return a.distanceMeters - b.distanceMeters
    })
}
