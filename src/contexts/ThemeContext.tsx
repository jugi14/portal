import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<
  ThemeContextType | undefined
>(undefined);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem("teifi_dark_mode");
    if (stored !== null) {
      return stored === "true";
    }

    // Check system preference
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)")
        .matches;
    }

    return false;
  });

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Save to localStorage
    localStorage.setItem(
      "teifi_dark_mode",
      isDarkMode.toString(),
    );

    console.log(
      `[Theme] Mode switched to: ${isDarkMode ? "DARK" : "LIGHT"}`,
    );
  }, [isDarkMode]);

  // Listen to system theme changes
  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set preference
      const userPreference = localStorage.getItem(
        "teifi_dark_mode_manual",
      );
      if (!userPreference) {
        setIsDarkMode(e.matches);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () =>
        mediaQuery.removeEventListener("change", handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
    localStorage.setItem("teifi_dark_mode_manual", "true");
  };

  const setDarkMode = (value: boolean) => {
    setIsDarkMode(value);
    localStorage.setItem("teifi_dark_mode_manual", "true");
  };

  return (
    <ThemeContext.Provider
      value={{ isDarkMode, toggleDarkMode, setDarkMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      "useTheme must be used within a ThemeProvider",
    );
  }
  return context;
}