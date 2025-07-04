"use client"

import { useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Eye, 
  Download,
  RefreshCw,
  Trash2,
  Settings,
  Zap,
  Clock,
  AlertTriangle
} from "lucide-react"

interface FileItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  result?: {
    amount?: number
    merchant?: string
    category?: string
    date?: string
    confidence?: number
  }
  error?: string
  preview?: string
}

interface BatchProcessorProps {
  onExpensesAdded: (expenses: any[]) => void
}

export function BatchProcessor({ onExpensesAdded }: BatchProcessorProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [processingSettings, setProcessingSettings] = useState({
    autoApprove: false,
    defaultCategory: "",
    skipLowConfidence: true,
    confidenceThreshold: 0.7
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      return validTypes.includes(file.type) && file.size < 10 * 1024 * 1024 // 10MB
    })

    const fileItems: FileItem[] = validFiles.map(file => ({
      id: Date.now() + Math.random().toString(),
      file,
      status: 'pending',
      progress: 0
    }))

    setFiles(prev => [...prev, ...fileItems])
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const processFile = async (fileItem: FileItem): Promise<FileItem> => {
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 30
        if (progress > 100) progress = 100
        
        setFiles(prev => 
          prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, progress, status: progress >= 100 ? 'processing' : 'pending' }
              : f
          )
        )
        
        if (progress >= 100) {
          clearInterval(interval)
          
          // Simular procesamiento OCR
          setTimeout(() => {
            // Simular resultados aleatorios
            const merchants = ['Mercadona', 'Carrefour', 'Amazon', 'Zara', 'Gasolinera Shell', 'Farmacia', 'Restaurante Casa Pepe']
            const categories = ['Alimentación', 'Transporte', 'Ropa', 'Salud', 'Ocio', 'Hogar']
            
            const mockResult = {
              amount: Math.random() * 200 + 10,
              merchant: merchants[Math.floor(Math.random() * merchants.length)],
              category: categories[Math.floor(Math.random() * categories.length)],
              date: new Date().toISOString().split('T')[0],
              confidence: Math.random() * 0.4 + 0.6 // 0.6 - 1.0
            }
            
            const success = Math.random() > 0.1 // 90% success rate
            
            const updatedFile: FileItem = {
              ...fileItem,
              status: success ? 'completed' : 'error',
              progress: 100,
              result: success ? mockResult : undefined,
              error: success ? undefined : 'No se pudo extraer información del archivo'
            }
            
            setFiles(prev => 
              prev.map(f => f.id === fileItem.id ? updatedFile : f)
            )
            
            resolve(updatedFile)
          }, 1000 + Math.random() * 2000)
        }
      }, 200)
    })
  }

  const startBatchProcessing = async () => {
    if (files.length === 0) return
    
    setIsProcessing(true)
    setGlobalProgress(0)
    
    // Resetear archivos a pending
    setFiles(prev => 
      prev.map(f => ({ ...f, status: 'pending' as const, progress: 0, result: undefined, error: undefined }))
    )
    
    const batchSize = 3 // Procesar 3 archivos en paralelo
    const batches = []
    
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize))
    }
    
    let completedFiles = 0
    
    for (const batch of batches) {
      const promises = batch.map(processFile)
      await Promise.all(promises)
      
      completedFiles += batch.length
      setGlobalProgress((completedFiles / files.length) * 100)
    }
    
    setIsProcessing(false)
  }

  const approveResults = () => {
    const successfulFiles = files.filter(f => f.status === 'completed' && f.result)
    
    if (processingSettings.skipLowConfidence) {
      const filteredFiles = successfulFiles.filter(f => 
        f.result!.confidence! >= processingSettings.confidenceThreshold
      )
      onExpensesAdded(filteredFiles.map(f => f.result))
    } else {
      onExpensesAdded(successfulFiles.map(f => f.result))
    }
    
    setFiles([])
  }

  const getStatusIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = (status: FileItem['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
    }
  }

  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const lowConfidenceCount = files.filter(f => 
    f.status === 'completed' && f.result && f.result.confidence! < processingSettings.confidenceThreshold
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Procesamiento Masivo de Archivos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sube múltiples recibos y facturas para procesarlos automáticamente con OCR. 
            Arrastra y suelta archivos o haz clic para seleccionar.
          </p>
        </CardHeader>
      </Card>

      {/* Processing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Procesamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría por defecto</label>
              <Input
                placeholder="Ej: Varios"
                value={processingSettings.defaultCategory}
                onChange={(e) => setProcessingSettings(prev => ({ ...prev, defaultCategory: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Umbral de confianza</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={processingSettings.confidenceThreshold}
                onChange={(e) => setProcessingSettings(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={processingSettings.skipLowConfidence}
                onChange={(e) => setProcessingSettings(prev => ({ ...prev, skipLowConfidence: e.target.checked }))}
              />
              <span className="text-sm">Omitir resultados con baja confianza</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={processingSettings.autoApprove}
                onChange={(e) => setProcessingSettings(prev => ({ ...prev, autoApprove: e.target.checked }))}
              />
              <span className="text-sm">Aprobar automáticamente resultados con alta confianza</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">
              Arrastra y suelta archivos aquí
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Soporta JPG, PNG, WebP y PDF hasta 10MB cada uno
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Seleccionar Archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Progress Overview */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Progreso del Procesamiento</span>
              <div className="flex gap-2">
                <Button
                  onClick={startBatchProcessing}
                  disabled={isProcessing || files.length === 0}
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Procesar Todos
                    </>
                  )}
                </Button>
                
                {completedCount > 0 && (
                  <Button
                    onClick={approveResults}
                    size="sm"
                    variant="outline"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprobar Resultados ({completedCount})
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={globalProgress} className="h-2" />
              </div>
              <span className="text-sm font-medium">{Math.round(globalProgress)}%</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{files.length}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                <div className="text-muted-foreground">Completados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                <div className="text-muted-foreground">Errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{lowConfidenceCount}</div>
                <div className="text-muted-foreground">Baja confianza</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archivos en Cola</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <h4 className="font-medium">{fileItem.file.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {(fileItem.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(fileItem.status)}
                      <Badge className={getStatusColor(fileItem.status)}>
                        {fileItem.status === 'pending' && 'Pendiente'}
                        {fileItem.status === 'processing' && 'Procesando'}
                        {fileItem.status === 'completed' && 'Completado'}
                        {fileItem.status === 'error' && 'Error'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(fileItem.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {fileItem.status !== 'pending' && (
                    <Progress value={fileItem.progress} className="h-1" />
                  )}
                  
                  {fileItem.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Error:</span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">{fileItem.error}</p>
                    </div>
                  )}
                  
                  {fileItem.result && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="font-medium">Importe:</span>
                          <p className="text-green-700">€{fileItem.result.amount?.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="font-medium">Comercio:</span>
                          <p className="text-green-700">{fileItem.result.merchant}</p>
                        </div>
                        <div>
                          <span className="font-medium">Categoría:</span>
                          <p className="text-green-700">{fileItem.result.category}</p>
                        </div>
                        <div>
                          <span className="font-medium">Confianza:</span>
                          <p className={`font-medium ${
                            fileItem.result.confidence! >= 0.8 ? 'text-green-600' :
                            fileItem.result.confidence! >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {Math.round(fileItem.result.confidence! * 100)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Consejos para Mejores Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">📱 Calidad de Imagen</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Usa buena iluminación</li>
                <li>• Mantén el recibo plano</li>
                <li>• Evita sombras y reflejos</li>
                <li>• Centra el recibo en la imagen</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">📄 Tipos de Archivo</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• JPG, PNG, WebP: Máx 10MB</li>
                <li>• PDF: Máx 10MB</li>
                <li>• Múltiples páginas soportadas</li>
                <li>• Resolución mínima: 300x300px</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 