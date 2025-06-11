"use client"

import { useState } from "react"
import { CameraCapture } from "./camera-capture"
import { OCRProgress } from "./ocr-progress"
import { useTesseractOCR } from "@/hooks/use-tesseract-ocr"
import { ExpenseForm } from "./expense-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Scan, ArrowLeft } from "lucide-react"

interface ReceiptScannerProps {
  categories: string[]
  onSubmit: (values: any) => void
  onClose: () => void
}

interface ScannedData {
  amount?: number
  description?: string
  date?: Date
  merchant?: string
  category?: string
  confidence: number
  rawText: string
  imageDataUrl?: string
}

export function ReceiptScanner({ categories, onSubmit, onClose }: ReceiptScannerProps) {
  const [currentStep, setCurrentStep] = useState<"capture" | "processing" | "review">("capture")
  const [scannedData, setScannedData] = useState<ScannedData | null>(null)
  const [showRawText, setShowRawText] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  
  const { processImage, isProcessing, progress, error } = useTesseractOCR()

  const handleImageCapture = async (imageFile: File) => {
    // Crear URL temporal para mostrar durante el procesamiento
    const imageUrl = URL.createObjectURL(imageFile)
    setCapturedImage(imageUrl)
    
    setCurrentStep("processing")
    
    try {
      const extractedData = await processImage(imageFile)
      
      // Usar la data URL de los datos extraídos o mantener la temporal
      if (extractedData.imageDataUrl) {
        // Si tenemos una data URL del PDF, usarla y limpiar la temporal
        URL.revokeObjectURL(imageUrl)
        setCapturedImage(extractedData.imageDataUrl)
      } else {
        // Si es una imagen normal, mantener la URL temporal
        setCapturedImage(imageUrl)
      }
      
      setScannedData(extractedData)
      setCurrentStep("review")
    } catch (err) {
      console.error("Error processing image:", err)
      // El error ya se maneja en el hook
    }
  }

  const handleFormSubmit = (formValues: any) => {
    // Limpiar el URL de la imagen solo si es un blob URL
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage)
    }
    onSubmit(formValues)
  }

  const goBack = () => {
    if (currentStep === "review") {
      setCurrentStep("capture")
      setScannedData(null)
      if (capturedImage && capturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(capturedImage)
      }
      setCapturedImage(null)
    } else {
      onClose()
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-800"
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 80) return "Alta confianza"
    if (confidence >= 60) return "Confianza media"
    return "Baja confianza"
  }

  if (currentStep === "capture") {
    return (
      <CameraCapture
        onImageCapture={handleImageCapture}
        onClose={onClose}
      />
    )
  }

  if (currentStep === "processing") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
        
        {capturedImage && (
          <Card className="max-w-sm mx-auto">
            <CardContent className="p-4">
              <img 
                src={capturedImage} 
                alt="Recibo capturado" 
                className="w-full h-auto rounded border"
              />
            </CardContent>
          </Card>
        )}
        
        <OCRProgress 
          status={progress.status} 
          progress={progress.progress} 
          error={error}
        />
      </div>
    )
  }

  if (currentStep === "review" && scannedData) {
    const initialValues = {
      amount: scannedData.amount || 0,
      category: scannedData.category || "",
      date: scannedData.date || new Date(),
      note: scannedData.description || ""
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Badge className={getConfidenceColor(scannedData.confidence)}>
            <Scan className="h-3 w-3 mr-1" />
            {getConfidenceText(scannedData.confidence)} ({scannedData.confidence}%)
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Imagen capturada */}
          {capturedImage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Imagen Escaneada</CardTitle>
              </CardHeader>
              <CardContent>
                <img 
                  src={capturedImage} 
                  alt="Recibo escaneado" 
                  className="w-full h-auto rounded border"
                />
              </CardContent>
            </Card>
          )}

          {/* Formulario con datos extraídos */}
          <Card>
            <CardHeader>
              <CardTitle>Verificar y Corregir Datos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revisa los datos extraídos y corrígelos si es necesario
              </p>
            </CardHeader>
            <CardContent>
              <ExpenseForm
                onSubmit={handleFormSubmit}
                categories={categories}
                initialValues={initialValues}
              />
            </CardContent>
          </Card>
        </div>

        {/* Texto extraído (opcional) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Texto Extraído</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawText(!showRawText)}
              >
                {showRawText ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver texto
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showRawText && (
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap overflow-auto max-h-32">
                {scannedData.rawText}
              </pre>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  return null
} 