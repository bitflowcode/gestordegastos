"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"

interface SettingsViewProps {
  onExportData: () => void
  categories: string[]
  onAddCategory: (category: string) => void
  onRemoveCategory: (category: string) => void
}

export function SettingsView({ onExportData, categories, onAddCategory, onRemoveCategory }: SettingsViewProps) {
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState(false)
  const [newCategory, setNewCategory] = useState("")

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim())
      setNewCategory("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="theme-toggle">Tema Oscuro</Label>
          <Switch
            id="theme-toggle"
            checked={theme === "dark"}
            onCheckedChange={(checked: boolean) => setTheme(checked ? "dark" : "light")}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="notifications-toggle">Notificaciones</Label>
          <Switch
            id="notifications-toggle"
            checked={notifications}
            onCheckedChange={(checked: boolean) => setNotifications(checked)}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Categorías de Gastos</h3>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category} className="flex items-center justify-between">
                <span>{category}</span>
                <Button variant="destructive" size="sm" onClick={() => onRemoveCategory(category)}>
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex mt-4">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nueva categoría"
              className="mr-2"
            />
            <Button onClick={handleAddCategory}>Agregar</Button>
          </div>
        </div>
        <Button onClick={onExportData} className="w-full">
          Exportar Datos
        </Button>
      </CardContent>
    </Card>
  )
}

