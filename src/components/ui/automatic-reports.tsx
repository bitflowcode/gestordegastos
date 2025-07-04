"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import { 
  Calendar, 
  Mail, 
  Download, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  PieChart,
  FileText,
  Settings,
  Play,
  Pause,
  Eye
} from "lucide-react"

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  sections: string[]
  frequency: 'monthly' | 'weekly' | 'quarterly'
  estimatedSize: string
}

interface ReportConfig {
  id: string
  templateId: string
  name: string
  enabled: boolean
  frequency: 'monthly' | 'weekly' | 'quarterly'
  dayOfMonth: number
  email: string
  categories: string[]
  dateRange: number // meses hacia atrás
  lastRun?: Date
  nextRun?: Date
}

const templates: ReportTemplate[] = [
  {
    id: "monthly-summary",
    name: "Resumen Mensual Completo",
    description: "Informe detallado con gráficos de gastos, tendencias y comparaciones",
    icon: <BarChart3 className="h-6 w-6 text-blue-600" />,
    sections: ["Resumen ejecutivo", "Gastos por categoría", "Tendencias", "Comparación con meses anteriores", "Alertas y recomendaciones"],
    frequency: "monthly",
    estimatedSize: "2-3 páginas PDF"
  },
  {
    id: "category-breakdown",
    name: "Desglose por Categorías",
    description: "Análisis profundo de gastos por categoría con subcategorías y patrones",
    icon: <PieChart className="h-6 w-6 text-green-600" />,
    sections: ["Gastos por categoría", "Subcategorías", "Patrones de gasto", "Proyecciones"],
    frequency: "monthly",
    estimatedSize: "1-2 páginas PDF"
  },
  {
    id: "trend-analysis",
    name: "Análisis de Tendencias",
    description: "Identificación de patrones, tendencias y anomalías en los gastos",
    icon: <TrendingUp className="h-6 w-6 text-purple-600" />,
    sections: ["Tendencias de 6 meses", "Análisis estacional", "Detección de anomalías", "Predicciones"],
    frequency: "monthly",
    estimatedSize: "2-4 páginas PDF"
  },
  {
    id: "budget-performance",
    name: "Rendimiento del Presupuesto",
    description: "Comparación entre gastos reales y presupuesto planificado",
    icon: <FileText className="h-6 w-6 text-orange-600" />,
    sections: ["Cumplimiento de presupuesto", "Desviaciones", "Recomendaciones", "Ajustes sugeridos"],
    frequency: "monthly",
    estimatedSize: "1-2 páginas PDF"
  }
]

export function AutomaticReports() {
  const { user } = useAuth()
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [newConfig, setNewConfig] = useState<Partial<ReportConfig>>({
    name: "",
    frequency: "monthly",
    dayOfMonth: 1,
    email: "",
    categories: [],
    dateRange: 6
  })

  // Simular carga de configuraciones existentes
  useEffect(() => {
    if (user?.email) {
      setNewConfig(prev => ({ ...prev, email: user.email }))
    }
  }, [user])

  const handleCreateReport = () => {
    if (!selectedTemplate || !newConfig.name || !newConfig.email) return

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return

    const config: ReportConfig = {
      id: Date.now().toString(),
      templateId: selectedTemplate,
      name: newConfig.name,
      enabled: true,
      frequency: newConfig.frequency || "monthly",
      dayOfMonth: newConfig.dayOfMonth || 1,
      email: newConfig.email,
      categories: newConfig.categories || [],
      dateRange: newConfig.dateRange || 6,
      nextRun: calculateNextRun(newConfig.frequency || "monthly", newConfig.dayOfMonth || 1)
    }

    setReportConfigs(prev => [...prev, config])
    setIsCreating(false)
    setSelectedTemplate("")
    setNewConfig({
      name: "",
      frequency: "monthly",
      dayOfMonth: 1,
      email: user?.email || "",
      categories: [],
      dateRange: 6
    })
  }

  const toggleReportEnabled = (reportId: string) => {
    setReportConfigs(prev =>
      prev.map(config =>
        config.id === reportId
          ? { ...config, enabled: !config.enabled }
          : config
      )
    )
  }

  const calculateNextRun = (frequency: string, dayOfMonth: number): Date => {
    const now = new Date()
    const nextRun = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)
    
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1)
    }
    
    return nextRun
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const generatePreviewReport = async (configId: string) => {
    // En producción, esto haría una llamada al API
    console.log("Generando preview para:", configId)
    // Simular generación de reporte
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Crear PDF de muestra
          if (typeof window === 'undefined') return
      const element = document.createElement('a')
    element.href = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO...' // PDF base64 mockup
    element.download = `preview-reporte-${configId}.pdf`
    element.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Informes Automáticos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recibe informes detallados de tus gastos automáticamente por email. 
            Configura la frecuencia y el contenido según tus necesidades.
          </p>
        </CardHeader>
      </Card>

      {/* Active Reports */}
      {reportConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Mis Informes Configurados</span>
              <Button 
                onClick={() => setIsCreating(true)}
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Nuevo Informe
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportConfigs.map((config) => {
                const template = templates.find(t => t.id === config.templateId)
                return (
                  <div key={config.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {template?.icon}
                        <div>
                          <h4 className="font-medium">{config.name}</h4>
                          <p className="text-sm text-muted-foreground">{template?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={() => toggleReportEnabled(config.id)}
                        />
                        <Badge variant={config.enabled ? "default" : "secondary"}>
                          {config.enabled ? "Activo" : "Pausado"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Frecuencia:</span>
                        <p className="font-medium capitalize">{config.frequency}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Día del mes:</span>
                        <p className="font-medium">{config.dayOfMonth}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{config.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Próximo envío:</span>
                        <p className="font-medium">
                          {config.nextRun ? formatDate(config.nextRun) : "No programado"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePreviewReport(config.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Vista Previa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Report */}
      {(isCreating || reportConfigs.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {reportConfigs.length === 0 ? "Crear tu Primer Informe Automático" : "Nuevo Informe Automático"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template Selection */}
            <div className="space-y-4">
              <h4 className="font-medium">1. Selecciona un template</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate === template.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {template.icon}
                        <div className="flex-1">
                          <h5 className="font-medium">{template.name}</h5>
                          <p className="text-sm text-muted-foreground mb-2">
                            {template.description}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Incluye:</span> {template.sections.join(", ")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Tamaño:</span> {template.estimatedSize}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Configuration */}
            {selectedTemplate && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">2. Configura tu informe</h4>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nombre del informe</label>
                    <Input
                      placeholder="Ej: Informe mensual de gastos"
                      value={newConfig.name}
                      onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Email de destino</label>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      value={newConfig.email}
                      onChange={(e) => setNewConfig(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Frecuencia</label>
                    <Select 
                      value={newConfig.frequency} 
                      onValueChange={(value) => setNewConfig(prev => ({ ...prev, frequency: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      Día del mes (1-28)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="28"
                      value={newConfig.dayOfMonth}
                      onChange={(e) => setNewConfig(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      Rango de datos (meses hacia atrás)
                    </label>
                    <Select
                      value={newConfig.dateRange?.toString()}
                      onValueChange={(value) => setNewConfig(prev => ({ ...prev, dateRange: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                        <SelectItem value="24">24 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsCreating(false)
                      setSelectedTemplate("")
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateReport}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Crear Informe Automático
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>¿Por qué usar informes automáticos?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                Ahorro de tiempo
              </h4>
              <p className="text-sm text-muted-foreground">
                No necesitas recordar generar informes manualmente. Se crean y envían automáticamente.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Análisis consistente
              </h4>
              <p className="text-sm text-muted-foreground">
                Mantén un seguimiento regular de tus finanzas con informes consistentes y comparables.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Detección temprana
              </h4>
              <p className="text-sm text-muted-foreground">
                Identifica tendencias y anomalías antes de que se conviertan en problemas.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-600" />
                Siempre informado
              </h4>
              <p className="text-sm text-muted-foreground">
                Recibe tus informes directamente en tu email, sin necesidad de abrir la app.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 