"use client"

// Barra de navegación inferior, SOLO en móvil (sm:hidden). En pantallas
// anchas sigue la barra de pestañas superior. Cinco destinos con icono y
// etiqueta corta: con texto solo, las cinco etiquetas no caben y se solapan,
// que es justo el fallo que motivó esta barra.

import { CreditCard, History, Home, PlusCircle, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const DESTINOS = [
  { value: "dashboard", label: "Inicio", icon: Home },
  { value: "add-expense", label: "Agregar", icon: PlusCircle },
  { value: "history", label: "Historial", icon: History },
  { value: "cards", label: "Tarjetas", icon: CreditCard },
  { value: "settings", label: "Ajustes", icon: Settings },
] as const

interface BottomNavProps {
  activeTab: string
  onChange: (tab: string) => void
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t
                 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-5">
        {DESTINOS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-current={activeTab === value ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[11px]",
              activeTab === value ? "text-blue-600 font-medium" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
