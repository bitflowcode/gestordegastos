"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { Download, Plus, Trash2, Zap } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"
import { ThemeToggle } from "./theme-toggle"
import { N8nIntegration } from "./n8n-integration"
import { AutomationTemplates } from "./automation-templates"
import { AutomaticReports } from "./automatic-reports"
import { BatchProcessor } from "./batch-processor"

interface SettingsViewProps {
  categories: string[]
  onAddCategory: (category: string) => void
  onRemoveCategory: (category: string) => void
  onExportData: () => void
}

export function SettingsView({ categories, onAddCategory, onRemoveCategory, onExportData }: SettingsViewProps) {
  const [newCategory, setNewCategory] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      onAddCategory(newCategory.trim())
      setNewCategory("")
    }
  }

  const handleDeleteCategory = () => {
    if (categoryToDelete) {
      onRemoveCategory(categoryToDelete)
      setCategoryToDelete(null)
    }
  }

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
        <TabsTrigger value="general" className="text-sm font-medium">General</TabsTrigger>
        <TabsTrigger value="automation" className="text-sm font-medium">
          <Zap className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Automatización</span>
          <span className="sm:hidden">Auto</span>
        </TabsTrigger>
        <TabsTrigger value="processing" className="text-sm font-medium">
          <Download className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Procesamiento</span>
          <span className="sm:hidden">Proc</span>
        </TabsTrigger>
        <TabsTrigger value="data" className="text-sm font-medium">Datos</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription className="text-base md:text-sm">Personaliza el aspecto visual de la aplicación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium mb-1">Tema</h4>
                <p className="text-base md:text-sm text-muted-foreground">
                  Selecciona entre tema claro, oscuro o el predeterminado del sistema
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorías de Gastos</CardTitle>
            <CardDescription className="text-base md:text-sm">Gestiona las categorías disponibles para clasificar tus gastos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Nueva categoría..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </div>
            <div className="grid gap-2">
              {categories.map((category) => (
                <div key={category} className="flex items-center justify-between p-2 rounded-lg border">
                  <span>{category}</span>
                  <Button variant="ghost" size="icon" onClick={() => setCategoryToDelete(category)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automation" className="mt-6">
        <AutomationTemplates />
        <N8nIntegration />
      </TabsContent>

      <TabsContent value="processing" className="mt-6">
        <div className="space-y-8">
          <AutomaticReports />
          <BatchProcessor onExpensesAdded={(expenses) => console.log('Expenses added:', expenses)} />
        </div>
      </TabsContent>

      <TabsContent value="data" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Datos</CardTitle>
            <CardDescription className="text-base md:text-sm">Realiza copias de seguridad de tus datos y restaura información anterior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Copia de Seguridad</h4>
                <p className="text-base md:text-sm text-muted-foreground mb-4">
                  Descarga todos tus datos (gastos y categorías) en formato JSON. Este archivo te permitirá restaurar toda
                  tu información en caso de cambiar de dispositivo o si necesitas recuperar tus datos.
                </p>
                <Button onClick={onExportData} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Copia de Seguridad
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Restaurar Datos</h4>
                <p className="text-base md:text-sm text-muted-foreground mb-4">
                  Restaura una copia de seguridad previa seleccionando el archivo JSON que descargaste anteriormente.
                </p>
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (e) => {
                        try {
                          const data = JSON.parse(e.target?.result as string)
                          // TODO: Implementar la restauración de datos
                          console.log("Datos a restaurar:", data)
                        } catch (error) {
                          console.error("Error al leer el archivo:", error)
                        }
                      }
                      reader.readAsText(file)
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-base md:text-sm">
              Esta acción no se puede deshacer. Los gastos asociados a esta categoría se mantendrán pero no podrás
              seleccionar esta categoría para nuevos gastos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}

