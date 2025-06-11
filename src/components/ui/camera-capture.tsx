"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, Upload, X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface CameraCaptureProps {
  onImageCapture: (imageFile: File) => void
  onClose: () => void
}

export function CameraCapture({ onImageCapture, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCamera = useCallback(async () => {
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso a la cámara")
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Cámara trasera preferida
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsStreaming(true)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      
      let errorMessage = "No se pudo acceder a la cámara. "
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
            errorMessage += "Permiso denegado. Ve a la configuración de tu navegador y permite el acceso a la cámara para este sitio."
            break
          case "NotFoundError":
            errorMessage += "No se encontró ninguna cámara en tu dispositivo."
            break
          case "NotReadableError":
            errorMessage += "La cámara está siendo usada por otra aplicación."
            break
          default:
            errorMessage += "Error desconocido. Por favor, usa la opción de subir archivo."
        }
      } else {
        errorMessage += "Por favor, usa la opción de subir archivo."
      }
      
      alert(errorMessage)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      setIsStreaming(false)
    }
  }, [stream])

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8)
        setCapturedImage(imageDataUrl)
        stopCamera()
      }
    }
  }, [stopCamera])

  const confirmImage = useCallback(() => {
    if (capturedImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { 
            type: "image/jpeg" 
          })
          onImageCapture(file)
        }
      }, "image/jpeg", 0.8)
    }
  }, [capturedImage, onImageCapture])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    startCamera()
  }, [startCamera])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      onImageCapture(file)
    }
  }, [onImageCapture])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Escanear Recibo</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Vista previa de imagen capturada */}
          {capturedImage && (
            <div className="relative">
              <img 
                src={capturedImage} 
                alt="Captured receipt" 
                className="w-full h-auto rounded-lg border"
              />
              <div className="flex gap-2 mt-4">
                <Button onClick={confirmImage} className="flex-1">
                  Usar esta imagen
                </Button>
                <Button variant="outline" onClick={retakePhoto}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Repetir
                </Button>
              </div>
            </div>
          )}

          {/* Vista de la cámara */}
          {!capturedImage && isStreaming && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto rounded-lg border"
              />
              <Button 
                onClick={captureImage}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
                size="lg"
              >
                <Camera className="h-5 w-5 mr-2" />
                Capturar
              </Button>
            </div>
          )}

          {/* Opciones iniciales */}
          {!capturedImage && !isStreaming && (
            <div className="space-y-3">
              <Button onClick={startCamera} className="w-full" size="lg">
                <Camera className="h-5 w-5 mr-2" />
                Abrir Cámara
              </Button>
              
              <div className="text-center text-sm text-muted-foreground">o</div>
              
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                size="lg"
              >
                <Upload className="h-5 w-5 mr-2" />
                Subir Imagen o PDF
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Canvas oculto para procesar la imagen */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>💡 Consejos para mejores resultados:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Asegúrate de que el recibo esté bien iluminado</li>
            <li>Mantén el recibo plano y sin arrugas</li>
            <li>Coloca todo el recibo dentro del marco</li>
            <li>Soporta JPG, PNG, WebP (PDF con limitaciones)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 