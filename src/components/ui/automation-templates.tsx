"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Folder, Download, ExternalLink, Clock, Star } from "lucide-react"

interface Template {
  id: string
  name: string
  description: string
  difficulty: "Fácil" | "Intermedio" | "Avanzado"
  icon: React.ReactNode
  estimatedTime: string
  requirements: string[]
  benefits: string[]
  downloadUrl: string
}

const templates: Template[] = [
  {
    id: "gmail-basic",
    name: "Auto-importar desde Gmail",
    description: "Importa automáticamente facturas que lleguen a tu Gmail con archivos PDF adjuntos",
    difficulty: "Fácil",
    icon: <Mail className="h-6 w-6 text-blue-600" />,
    estimatedTime: "15 minutos",
    requirements: [
      "Cuenta de Gmail",
      "n8n Cloud (gratis hasta 5000 ejecuciones/mes)",
      "Facturas que lleguen por email"
    ],
    benefits: [
      "Nunca más olvides registrar una factura",
      "Procesamiento automático en segundos",
      "Categorización inteligente",
      "Funciona 24/7"
    ],
    downloadUrl: "/templates/gmail-basic.json"
  },
  {
    id: "dropbox-monitor",
    name: "Monitorear Carpeta de Facturas",
    description: "Vigila una carpeta en Dropbox/Google Drive y procesa automáticamente nuevos archivos",
    difficulty: "Fácil", 
    icon: <Folder className="h-6 w-6 text-green-600" />,
    estimatedTime: "20 minutos",
    requirements: [
      "Cuenta de Dropbox o Google Drive",
      "n8n Cloud",
      "Carpeta dedicada para facturas"
    ],
    benefits: [
      "Arrastra y suelta facturas",
      "Procesamiento automático",
      "Backup en la nube",
      "Acceso desde móvil"
    ],
    downloadUrl: "/templates/dropbox-monitor.json"
  },
  {
    id: "email-forwarding",
    name: "Reenvío de Facturas",
    description: "Reenvía facturas a una dirección especial para procesamiento automático",
    difficulty: "Intermedio",
    icon: <Mail className="h-6 w-6 text-purple-600" />,
    estimatedTime: "30 minutos", 
    requirements: [
      "n8n Cloud",
      "Cuenta OpenAI (€5-10/mes)",
      "Configurar filtros de email"
    ],
    benefits: [
      "Funciona con cualquier email",
      "Procesamiento muy preciso con IA",
      "No necesita cambiar hábitos",
      "Extracción inteligente de datos"
    ],
    downloadUrl: "/templates/email-forwarding.json"
  }
]

export function AutomationTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil": return "bg-green-100 text-green-800"
      case "Intermedio": return "bg-yellow-100 text-yellow-800"
      case "Avanzado": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const downloadTemplate = (template: Template) => {
    // En producción, esto serían archivos JSON reales con workflows de n8n
    const workflowData = {
      name: template.name,
      nodes: [], // Nodos del workflow específico
      connections: {}, // Conexiones entre nodos
      settings: {},
      staticData: null
    }
    
    const dataStr = JSON.stringify(workflowData, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    
    const link = document.createElement("a")
    link.href = dataUri
    link.download = `${template.id}-workflow.json`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Templates de Automatización
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configuraciones pre-hechas para empezar rápidamente. Solo descargar, importar en n8n y personalizar.
          </p>
        </CardHeader>
      </Card>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card 
            key={template.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplate === template.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                {template.icon}
                <Badge className={getDifficultyColor(template.difficulty)}>
                  {template.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Configuración: {template.estimatedTime}</span>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Necesitas:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {template.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-green-600 mt-0.5">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Beneficios:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {template.benefits.slice(0, 2).map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-blue-600 mt-0.5">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                onClick={(e) => {
                  e.stopPropagation()
                  downloadTemplate(template)
                }}
                className="w-full"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructions Panel */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Cómo usar este template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Pasos simples:</h4>
              <ol className="text-sm text-blue-800 space-y-2">
                <li className="flex gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                  <span>Descargar el template haciendo clic en el botón de arriba</span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                  <span>Crear cuenta gratuita en <a href="https://n8n.cloud" target="_blank" className="underline">n8n.cloud</a></span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                  <span>Importar el archivo descargado en n8n (Workflows → Import)</span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
                  <span>Copiar tu API key desde la pestaña "Configuración de API"</span>
                </li>
                <li className="flex gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">5</span>
                  <span>Pegar la API key en el workflow y activarlo</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-2">
              <Button asChild>
                <a href="https://n8n.cloud" target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ir a n8n.cloud
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/docs/automation-guide" target="_blank">
                  Ver guía detallada
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Stories */}
      <Card>
        <CardHeader>
          <CardTitle>¿Realmente funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>María, contable autónoma:</strong><br />
                "Antes tardaba 10 minutos en registrar cada factura. Ahora se hace solo. 
                Procesé 150 facturas el mes pasado sin tocar nada."
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Carlos, pequeño empresario:</strong><br />
                "La configuración me tomó 20 minutos un domingo por la tarde. 
                Desde entonces no he vuelto a pensar en registrar gastos."
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 