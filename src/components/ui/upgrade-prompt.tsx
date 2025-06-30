"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cloud, Smartphone, Shield, X, Sparkles } from "lucide-react"

interface UpgradePromptProps {
  expenseCount: number
  onCreateAccount: () => void
  onDismiss: () => void
  isAutomatic?: boolean // Si aparece automáticamente o por acción del usuario
}

export function UpgradePrompt({ expenseCount, onCreateAccount, onDismiss, isAutomatic = true }: UpgradePromptProps) {
  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 mb-6 relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg text-blue-900">
            {isAutomatic ? "¡Desbloquea Todo el Potencial!" : "Sincroniza Tus Datos"}
          </CardTitle>
        </div>
        <CardDescription className="text-blue-700">
          {isAutomatic ? (
            <>
              Tienes <Badge variant="secondary" className="mx-1 bg-blue-100 text-blue-800">
                {expenseCount} gastos
              </Badge> registrados. Crea tu cuenta y accede a tus datos desde cualquier dispositivo.
            </>
          ) : (
            <>
              Crea tu cuenta para sincronizar tus <Badge variant="secondary" className="mx-1 bg-blue-100 text-blue-800">
                {expenseCount} gastos
              </Badge> y acceder desde cualquier dispositivo cuando quieras.
            </>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 bg-white/60 rounded-lg">
            <Cloud className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-blue-900">Sincronización</p>
              <p className="text-xs text-blue-700">En todos tus dispositivos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-white/60 rounded-lg">
            <Smartphone className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-blue-900">Multiplataforma</p>
              <p className="text-xs text-blue-700">Móvil, tablet y web</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-white/60 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-blue-900">Seguridad</p>
              <p className="text-xs text-blue-700">Datos protegidos</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button 
            onClick={onCreateAccount}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Crear Cuenta Gratis
          </Button>
          {isAutomatic && (
            <Button 
              variant="outline" 
              onClick={onDismiss}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Recordar más tarde
            </Button>
          )}
          {!isAutomatic && (
            <Button 
              variant="outline" 
              onClick={onDismiss}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Cancelar
            </Button>
          )}
        </div>
        
        <p className="text-xs text-blue-600 text-center">
          🔒 Gratis para siempre • Solo toma 30 segundos • Tus datos se migran automáticamente
        </p>
      </CardContent>
    </Card>
  )
} 