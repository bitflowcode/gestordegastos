"use client"

// Barra de navegación inferior, SOLO en móvil (sm:hidden). En pantallas
// anchas sigue la barra de pestañas superior.
//
// FLOTANTE a propósito (estilo Revolut): despegada de los bordes, con
// esquinas redondeadas y sombra. No es estética nada más: al no tocar el
// borde inferior convive bien con la barra de gestos del iPhone, con la de
// gestos de Android y con la de tres botones, sin depender de que cada
// sistema reporte bien su safe-area. El margen inferior SUMA el safe-area
// cuando existe (iPhone) y se queda en el fijo cuando no (Android 3 botones).
// Requiere viewport-fit=cover en el layout; sin él, env() vale siempre 0.

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
      className="sm:hidden fixed z-40 inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
      aria-label="Navegación principal"
    >
      <div
        className="grid grid-cols-5 rounded-2xl border border-gray-200 dark:border-gray-800
                   bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg p-1"
      >
        {DESTINOS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-current={activeTab === value ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] transition-colors",
              activeTab === value
                ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium"
                : "text-muted-foreground"
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
