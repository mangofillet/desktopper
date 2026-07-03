// Resolve root-absolute asset paths against Vite's base URL so the site works
// both at "/" (dev) and under "/desktopper/" (GitHub Pages).
export const asset = (p) =>
  typeof p === "string" && p.startsWith("/")
    ? import.meta.env.BASE_URL + p.slice(1)
    : p;
