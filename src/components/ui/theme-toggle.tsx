"use client"

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme("light")}
        className={`${theme === "light" ? "bg-accent" : ""}`}
        title="Tema Claro"
      >
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Tema Claro</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme("dark")}
        className={`${theme === "dark" ? "bg-accent" : ""}`}
        title="Tema Oscuro"
      >
        <Moon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Tema Oscuro</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme("system")}
        className={`${theme === "system" ? "bg-accent" : ""}`}
        title="Tema del Sistema"
      >
        <Monitor className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Tema del Sistema</span>
      </Button>
    </div>
  )
} 