import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#3632FF",
          tint: "#EEEEFF",
          light: "#C5C4FF",
        },
        grey: {
          50:  "#F4F4F6",
          100: "#E5E7EB",
          400: "#6B7280",
          900: "#1F1F1F",
          950: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
