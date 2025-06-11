"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react"

interface OCRProgressProps {
  status: string
  progress: number
  error?: string | null
}

export function OCRProgress({ status, progress, error }: OCRProgressProps) {
  if (error) {
    // Detectar si es un mensaje informativo sobre PDF
    const isPdfInfoMessage = error.includes('📄') || error.includes('Procesamiento de PDF temporalmente deshabilitado')
    
    if (isPdfInfoMessage) {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-blue-600">
                <FileText className="h-5 w-5" />
                <div>
                  <p className="font-medium">Información sobre PDF</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800 whitespace-pre-line">
                  {error}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }
    
    // Error normal
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Error en el procesamiento</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getIcon = () => {
    if (progress === 100) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    }
    if (progress > 0) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />
  }

  const getStatusColor = () => {
    if (progress === 100) return "text-green-600"
    if (progress > 0) return "text-blue-600"
    return "text-muted-foreground"
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Procesando Recibo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          {getIcon()}
          <div className="flex-1">
            <p className={`font-medium ${getStatusColor()}`}>
              {progress === 100 ? "¡Completado!" : status}
            </p>
            <Progress value={progress} className="mt-2" />
          </div>
        </div>
        
        <div className="text-center text-sm text-muted-foreground">
          {progress}% completado
        </div>

        {progress > 0 && progress < 100 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 Esto puede tomar unos segundos...</p>
            <p>El procesamiento se realiza localmente en tu dispositivo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 