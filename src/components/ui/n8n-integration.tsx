"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { Copy, Eye, EyeOff, ExternalLink, Zap, Mail, Folder, Bot } from "lucide-react"

export function N8nIntegration() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState<string>("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)

  // Generar API key cuando el usuario esté disponible
  useEffect(() => {
    if (user?.id) {
      // En un caso real, esto vendría del servidor
      const generatedKey = generateApiKey(user.id)
      setApiKey(generatedKey)
    }
  }, [user])

  const generateApiKey = (userId: string): string => {
    // Esta función debe coincidir con la del backend
    return Buffer.from(`${userId}:webhook-secret`).toString('base64')
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copiando al portapapeles:', err)
    }
  }

      const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/n8n` : 'https://gastoguru.com/api/webhooks/n8n'

  const examplePayload = {
    amount: 25.50,
    category: "Alimentación",
    date: "2024-01-15",
    note: "Compra en supermercado",
    merchant: "Mercadona",
    confidence: 85,
    source: "email",
    userId: user?.id || "tu-user-id",
    apiKey: apiKey
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Automatización con n8n
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Conecta tu app de gastos con n8n para automatizar la importación de facturas desde email, 
            carpetas de archivos y otros servicios.
          </p>
        </CardHeader>
      </Card>

      {/* Configuración API */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuración de API</CardTitle>
          <p className="text-sm text-muted-foreground">
            Usa estos datos para configurar webhooks en n8n
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex gap-2">
              <Input 
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tu API Key Personal</label>
            <div className="flex gap-2">
              <Input 
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(apiKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Mantén esta clave segura. Solo tú deberías tenerla.
            </p>
          </div>

          {copied && (
            <p className="text-sm text-green-600">✅ Copiado al portapapeles</p>
          )}
        </CardContent>
      </Card>

      {/* Ejemplos de Workflows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflows Sugeridos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ejemplos de automatizaciones que puedes crear con n8n
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Email Workflow */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Auto-importar desde Email</h3>
              <Badge variant="secondary">Recomendado</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Procesa automáticamente facturas que lleguen a tu email con archivos adjuntos PDF.
            </p>
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>1. <strong>Gmail Trigger:</strong> Nuevos emails con "factura" en asunto</div>
              <div>2. <strong>Filtro:</strong> Solo emails con archivos PDF adjuntos</div>
              <div>3. <strong>OpenAI:</strong> Extraer datos del PDF (importe, fecha, comercio)</div>
              <div>4. <strong>HTTP Request:</strong> Enviar datos a tu webhook</div>
            </div>
          </div>

          {/* Folder Monitoring */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Monitoreo de Carpetas</h3>
              <Badge variant="outline">Dropbox/Drive</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Vigila carpetas en Dropbox/Google Drive donde guardes facturas.
            </p>
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>1. <strong>Dropbox Trigger:</strong> Nuevos archivos en /Facturas/</div>
              <div>2. <strong>Filtro:</strong> Solo archivos PDF/imágenes</div>
              <div>3. <strong>OCR Service:</strong> Extraer texto del archivo</div>
              <div>4. <strong>HTTP Request:</strong> Crear gasto automáticamente</div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold">Análisis IA de Gastos</h3>
              <Badge variant="outline">Avanzado</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Análisis semanal de patrones de gasto con sugerencias de IA.
            </p>
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>1. <strong>Schedule:</strong> Cada domingo a las 9:00</div>
              <div>2. <strong>API Call:</strong> Obtener gastos de la última semana</div>
              <div>3. <strong>OpenAI:</strong> Analizar patrones y sugerir mejoras</div>
              <div>4. <strong>Email:</strong> Enviarte informe personalizado</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ejemplo de Payload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ejemplo de Datos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Formato JSON que n8n debe enviar a tu webhook
          </p>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-xs">
{JSON.stringify(examplePayload, null, 2)}
            </pre>
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <p><strong>amount:</strong> Cantidad del gasto (requerido)</p>
            <p><strong>category:</strong> Categoría del gasto (opcional, se sugiere automáticamente)</p>
            <p><strong>date:</strong> Fecha en formato YYYY-MM-DD (opcional, usa fecha actual)</p>
            <p><strong>source:</strong> 'email', 'folder' o 'manual' para tracking</p>
            <p><strong>userId y apiKey:</strong> Para autenticación y asociación</p>
          </div>
        </CardContent>
      </Card>

      {/* Links útiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recursos Útiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a 
            href="https://n8n.io" 
            target="_blank" 
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Descargar n8n (gratis y open source)
          </a>
          <a 
            href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/" 
            target="_blank" 
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Documentación de Webhooks en n8n
          </a>
          <a 
            href="https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/" 
            target="_blank" 
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Integración con Gmail
          </a>
        </CardContent>
      </Card>
    </div>
  )
} 