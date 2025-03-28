// SECTION: Tailwind CSS Configuration
// This section sets up the configuration for Tailwind CSS, which is a utility-first CSS framework. 
// Configuration parameters define design aspects such as dark mode support, content paths for processing, 
// theme customization, and various design tokens like colors and border-radius values.

module.exports = {
  // Dark mode settings: allows toggling between dark and light mode via a CSS class.
  darkMode: ["class"],

  // Ensures that style definitions take precedence over any other CSS styling.
  important: true,

  // Content paths: Specifies which files Tailwind should scan for class names.
  content: [
    './src/**/*.{js,jsx}', // Includes all JavaScript and JSX files in the src directory.
    './src/components/**/*.{js,jsx}', // Ensures inclusion of all JavaScript and JSX files in components dir.
  ],

  // SECTION: Theme Customization
  // This section customizes the theme settings, including container design, font families, colors, and radius.

  theme: {

    // FUNCTION: Container Configuration
    // Aligns the main content to the center with specific padding and screen size constraints.
    container: {
      center: true, // Ensures containers are centered by default.
      padding: "1rem", // Adds padding around the content within the container.
      screens: {
        "2xl": "1400px", // Sets a max-width for extra large screens.
      },
    },

    // FUNCTION: Font Family
    // Defines the font families used, falling back through multiple system fonts for broad compatibility.
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
    },

    // SECTION: Theme Extensions
    // Extends the default theme with custom colors and properties. Uses CSS variable syntax for dynamic theming.

    extend: {
      // FUNCTION: Custom Colors
      // Defines a range of colors using HSL values based on CSS variables to support dynamic theming.
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Additional color definitions for secondary, destructive, muted, accent, popover, and card.
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },

      // FUNCTION: Border Radius
      // Sets different border-radius sizes using CSS variables, allowing for flexible component styling.
      borderRadius: {
        lg: "var(--radius)", // Large border-radius
        md: "calc(var(--radius) - 2px)", // Medium border-radius, slightly smaller than large
        sm: "calc(var(--radius) - 4px)", // Small border-radius, smallest of all options
      },
    },
  },
}
