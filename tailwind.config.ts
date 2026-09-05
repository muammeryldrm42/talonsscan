import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1220",
        panel: "#131a2b",
        line: "#1f2a44",
        mist: "#8a97b8",
        paper: "#e8ecf7",
        arc: "#4f8cff",
        up: "#35c98d",
        down: "#ff5c7a",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
