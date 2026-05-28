import type { Config } from "tailwindcss";

// Mirrors docs/design-system.md §11.2 exactly.
// Consumed by apps/web via `presets: [require('@teriac/ui/tailwind.preset')]`.

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
          900: "var(--primary-900)",
          DEFAULT: "var(--primary-500)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          2: "var(--paper-2)",
          3: "var(--paper-3)",
        },
        card: {
          DEFAULT: "var(--card)",
          2: "var(--card-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        rule: {
          DEFAULT: "var(--rule)",
          2: "var(--rule-2)",
        },
        vital: { fg: "var(--vital-fg)", bg: "var(--vital-bg)" },
        warn: { fg: "var(--warn-fg)", bg: "var(--warn-bg)" },
        alert: { fg: "var(--alert-fg)", bg: "var(--alert-bg)" },
        info: { fg: "var(--info-fg)", bg: "var(--info-bg)" },
      },
      fontFamily: {
        serif: ["var(--serif)"],
        sans: ["var(--sans)"],
        mono: ["var(--mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
      },
      screens: {
        sm: "640px",
        md: "820px",
        lg: "1100px",
        xl: "1320px",
        "2xl": "1480px",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        emphasized: "cubic-bezier(0.3, 0, 0, 1)",
        decel: "cubic-bezier(0, 0, 0, 1)",
        accel: "cubic-bezier(0.4, 0, 1, 1)",
      },
      transitionDuration: {
        1: "80ms",
        2: "150ms",
        3: "220ms",
        4: "320ms",
        5: "480ms",
      },
    },
  },
};

export default preset;
