// Your actual fleet. Each vehicle is identified by plate + vehicle number —
// not just make/model — since several vehicles share the same make/model
// (e.g. three Mitsubishi Canters). That uniqueness matters: this name is
// what's stored on requests/movements and what availability tracking keys
// off, so two different physical vehicles must never share a `name`.
//
// `image` maps to the closest generic icon by vehicle type — these are
// placeholder icons, not real photos. Swap in real photos any time by
// dropping files into /public/vehicles and updating the path below.
// `category` groups vehicles into labeled sections on the selection grid.
export const AVAILABLE_VEHICLES = [
  {
    name: "Mitsubishi Canter — Plate G — #97603",
    subtitle: "White/Blue",
    image: "/vehicles/pickup-truck.svg",
    category: "Pick-up - 3 Ton",
  },
  {
    name: "Volvo FH 460 — Plate X — #87086",
    subtitle: "Red/White",
    image: "/vehicles/semi-truck.svg",
    category: "Unit",
  },
  {
    name: "Mitsubishi Canter — Plate U — #43559",
    subtitle: "White",
    image: "/vehicles/pickup-truck.svg",
    category: "Pick-up - 3 Ton",
  },
  {
    name: "Volkswagen Caddy — Plate Z — #76009",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Volvo FH — Plate Z — #89256",
    subtitle: "White",
    image: "/vehicles/semi-truck.svg",
    category: "Unit",
  },
  {
    name: "Toyota Lite Ace — Plate Z — #85021",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Nissan Urvan — Plate E — #66754",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 3 Ton",
  },
  {
    name: "Mitsubishi Canter — Plate H — #78596",
    subtitle: "White",
    image: "/vehicles/pickup-truck.svg",
    category: "Pick-up - 3 Ton",
  },
  {
    name: "Nissan Urvan — Plate Y — #48580",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Toyota Hiace — Plate Q — #55372",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Volvo FH — Plate W — #31408",
    subtitle: "White",
    image: "/vehicles/semi-truck.svg",
    category: "Unit (Massive Unit)",
  },
  {
    name: "Volvo FH — Plate B — #52480",
    subtitle: "White/Red/Blue",
    image: "/vehicles/semi-truck.svg",
    category: "20ft (smaller 20ft)",
  },
  {
    name: "Volvo FMX330 — Plate P — #65166",
    subtitle: "White",
    image: "/vehicles/semi-truck.svg",
    category: "20ft",
  },
  {
    name: "Toyota Hiace — Plate DD — #44158",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Nissan Urvan — Plate DD — #46268",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
  {
    name: "Nissan Urvan — Plate DD — #21814",
    subtitle: "White",
    image: "/vehicles/van.svg",
    category: "Van - 1 Ton",
  },
];
