"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { Download, Plus, Trash2, Zap, AlertCircle, CheckCircle2, Loader2, Lock, User } from "lucide-react"
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
import { GmailIntegration } from "./gmail-integration"
import { AutomaticReports } from "./automatic-reports"
import { BatchProcessor } from "./batch-processor"
import { supabase } from "@/lib/supabase"

interface SettingsViewProps {
  categories: string[]
  onAddCategory: (category: string) => void
  onRemoveCategory: (category: string) => void
  onExportData: () => void
  userId: string
  userEmail?: string
}

export function SettingsView({ categories, onAddCategory, onRemoveCategory, onExportData, userId, userEmail }: SettingsViewProps) {
  const [newCategory, setNewCategory] = useState("")
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")

  // Estados para cambio de contraseña
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!newPassword || !confirmPassword) {
      setPasswordError("Por favor completa todos los campos")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden")
      return
    }
    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (!supabase) {
      setPasswordError("Servicio no disponible temporalmente")
      return
    }

    setPasswordLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess(true)
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setPasswordSuccess(false), 5000)
      }
    } catch {
      setPasswordError("Error inesperado. Inténtalo de nuevo.")
    } finally {
      setPasswordLoading(false)
    }
  }

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
        <TabsTrigger value="general" className="text-sm font-medium">General</TabsTrigger>
        <TabsTrigger value="account" className="text-sm font-medium">
          <User className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Cuenta</span>
        </TabsTrigger>
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

      <TabsContent value="account" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Información de la Cuenta
            </CardTitle>
            <CardDescription className="text-base md:text-sm">
              Gestiona los datos de acceso a tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {userEmail && (
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <span className="text-sm text-muted-foreground flex-1">{userEmail}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  El email no se puede cambiar desde aquí. Contacta con soporte si necesitas modificarlo.
                </p>
              </div>
            )}

            <div className="border-t pt-6">
              <h4 className="font-medium mb-1">Cambiar Contraseña</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Introduce una nueva contraseña para tu cuenta. Debe tener al menos 6 caracteres.
              </p>

              {passwordSuccess ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">¡Contraseña actualizada correctamente!</p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-9"
                        disabled={passwordLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirmar nueva contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-new-password"
                        type="password"
                        placeholder="Repite tu nueva contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9"
                        disabled={passwordLoading}
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-800">{passwordError}</p>
                    </div>
                  )}

                  <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
                    {passwordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      "Cambiar Contraseña"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automation" className="mt-6 space-y-6">
        <GmailIntegration userId={userId} />
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

