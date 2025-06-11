"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, ArrowRight } from "lucide-react"
import { getPdfInfo, convertPdfToImage } from "@/lib/pdf-utils"

interface PdfPageSelectorProps {
  pdfFile: File
  onPageSelected: (imageFile: File, pageNumber: number) => void
  onCancel: () => void
}

export function PdfPageSelector({ pdfFile, onPageSelected, onCancel }: PdfPageSelectorProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [selectedPage, setSelectedPage] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPdfInfo = async () => {
      try {
        const info = await getPdfInfo(pdfFile)
        setNumPages(info.numPages)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando PDF")
      }
    }

    loadPdfInfo()
  }, [pdfFile])

  const handleProcessPage = async () => {
    if (!selectedPage || selectedPage > numPages) return

    setIsProcessing(true)
    setError(null)

    try {
      const imageFile = await convertPdfToImage(pdfFile, {
        pageNumber: selectedPage,
        scale: 2.0,
        quality: 0.9
      })

      onPageSelected(imageFile, selectedPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando página")
    } finally {
      setIsProcessing(false)
    }
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-destructive">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Error procesando PDF</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={onCancel} variant="outline" className="w-full">
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Seleccionar Página
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Este PDF tiene {numPages} página{numPages !== 1 ? 's' : ''}. 
          Selecciona cuál procesar con OCR.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Página a procesar:</label>
          <Select 
            value={selectedPage.toString()} 
            onValueChange={(value) => setSelectedPage(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                <SelectItem key={page} value={page.toString()}>
                  Página {page}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={onCancel} 
            variant="outline" 
            className="flex-1"
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleProcessPage} 
            className="flex-1"
            disabled={isProcessing || selectedPage > numPages}
          >
            {isProcessing ? (
              "Procesando..."
            ) : (
              <>
                Procesar
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          💡 Normalmente los recibos están en la primera página
        </div>
      </CardContent>
    </Card>
  )
} 