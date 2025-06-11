"use client"

import { useState, useCallback } from "react"
import Tesseract from "tesseract.js"
import { convertPdfToImageWithDataUrl, isPdfFile } from "@/lib/pdf-utils"

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

interface OCRProgress {
  status: string
  progress: number
}

export function useTesseractOCR() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<OCRProgress>({ status: "", progress: 0 })
  const [error, setError] = useState<string | null>(null)

  const extractDataFromText = useCallback((text: string): ScannedData => {
    const cleanText = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
    
    // Patrones para extraer información
    const amountPatterns = [
      /total[:\s]*€?\s*(\d+[.,]\d{2})/gi,
      /importe[:\s]*€?\s*(\d+[.,]\d{2})/gi,
      /€\s*(\d+[.,]\d{2})/g,
      /(\d+[.,]\d{2})\s*€/g,
      /(\d+[.,]\d{2})(?=\s*(?:€|eur|euros?))/gi
    ]

    // Patrones para fechas (mejorados)
    const datePatterns = [
      // Formato dd/mm/aaaa o dd-mm-aaaa o dd.mm.aaaa
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g,
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})/g,
      // Formato aaaa/mm/dd o aaaa-mm-dd
      /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g,
      // Formato mm/dd/aaaa
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g,
      // Fechas en texto (ej: "12 de enero de 2024", "enero 12, 2024")
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi,
      /(\d{1,2})[\/\-\s]+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[\/\-\s]+(\d{2,4})/gi,
      // Fechas con formato europeo común
      /(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{2,4})/g
    ]

    // Patrones para comercios (palabras en mayúsculas al inicio)
    const merchantPatterns = [
      /^([A-Z\s]{3,30})/m,
      /(SUPERMERCADO|FARMACIA|RESTAURANTE|CAFE|BAR|TIENDA|SHOP|STORE)\s+([A-Z\s]+)/i
    ]

    let amount: number | undefined
    let date: Date | undefined
    let merchant: string | undefined
    let category: string | undefined

    // Extraer cantidad (buscar el mayor número, probablemente el total)
    let maxAmount = 0
    for (const pattern of amountPatterns) {
      const matches = Array.from(cleanText.matchAll(pattern))
      for (const match of matches) {
        const value = parseFloat(match[1].replace(",", "."))
        if (value > maxAmount) {
          maxAmount = value
        }
      }
    }
    if (maxAmount > 0) {
      amount = maxAmount
    }

    // Extraer fecha (lógica mejorada)
    const parseDate = (text: string): Date | null => {
      // Mapas para meses en español
      const monthsMap: { [key: string]: number } = {
        'enero': 0, 'ene': 0,
        'febrero': 1, 'feb': 1,
        'marzo': 2, 'mar': 2,
        'abril': 3, 'abr': 3,
        'mayo': 4, 'may': 4,
        'junio': 5, 'jun': 5,
        'julio': 6, 'jul': 6,
        'agosto': 7, 'ago': 7,
        'septiembre': 8, 'sep': 8,
        'octubre': 9, 'oct': 9,
        'noviembre': 10, 'nov': 10,
        'diciembre': 11, 'dic': 11
      }

      for (const pattern of datePatterns) {
        const matches = Array.from(text.matchAll(pattern))
        for (const match of matches) {
          try {
            const [, part1, part2, part3] = match
            
            // Si hay texto de mes, procesarlo
            if (isNaN(Number(part2)) && monthsMap[part2.toLowerCase()]) {
              const day = parseInt(part1)
              const month = monthsMap[part2.toLowerCase()]
              const year = parseInt(part3) < 100 ? 2000 + parseInt(part3) : parseInt(part3)
              
              const testDate = new Date(year, month, day)
              if (testDate.getFullYear() >= 2020 && testDate.getFullYear() <= 2030) {
                return testDate
              }
            } else {
              // Parsing numérico
              const num1 = parseInt(part1)
              const num2 = parseInt(part2)  
              const num3 = parseInt(part3)
              
              // Determinar año, mes, día
              let year, month, day
              
              // Si algún número es claramente un año (> 2000)
              if (num1 > 2000) {
                year = num1
                month = num2
                day = num3
              } else if (num3 > 2000 || (num3 >= 20 && num3 <= 30)) {
                // Formato dd/mm/aa o dd/mm/aaaa
                day = num1
                month = num2
                year = num3 < 100 ? 2000 + num3 : num3
              } else if (num3 < 20) {
                // Formato dd/mm/aa (asumiendo 20xx)
                day = num1
                month = num2
                year = 2000 + num3
              } else {
                // Por defecto, asumir dd/mm/aaaa
                day = num1
                month = num2
                year = num3
              }
              
              // Validar fecha
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                const testDate = new Date(year, month - 1, day) // month - 1 porque Date usa 0-based months
                if (testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day) {
                  return testDate
                }
              }
            }
          } catch (e) {
            // Continuar con el siguiente patrón
            continue
          }
        }
      }
      return null
    }

    date = parseDate(cleanText) || undefined

    // Extraer comercio
    for (const pattern of merchantPatterns) {
      const match = cleanText.match(pattern)
      if (match) {
        merchant = match[1] || match[2]
        merchant = merchant.trim().toLowerCase()
        merchant = merchant.charAt(0).toUpperCase() + merchant.slice(1)
        break
      }
    }

    // Determinar categoría basada en palabras clave
    const categoryKeywords = {
      "Alimentación": ["supermercado", "mercado", "alimentación", "comida", "carrefour", "mercadona", "dia", "lidl", "aldi"],
      "Restaurante": ["restaurante", "bar", "cafe", "cafeteria", "McDonald", "burger", "pizza"],
      "Farmacia": ["farmacia", "medicina", "medicamento", "salud"],
      "Transporte": ["gasolina", "combustible", "metro", "bus", "taxi", "uber", "parking"],
      "Ropa": ["moda", "ropa", "zara", "h&m", "tienda"],
      "Hogar": ["ferreteria", "bricomart", "ikea", "decoración", "muebles"]
    }

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => cleanText.toLowerCase().includes(keyword))) {
        category = cat
        break
      }
    }

    // Calcular confianza basada en datos extraídos
    let confidence = 0
    if (amount) confidence += 40
    if (date) confidence += 30
    if (merchant) confidence += 20
    if (category) confidence += 10

    return {
      amount,
      description: merchant || "Gasto escaneado",
      date,
      merchant,
      category,
      confidence,
      rawText: cleanText
    }
  }, [])

  const processImage = useCallback(async (inputFile: File): Promise<ScannedData> => {
    setIsProcessing(true)
    setError(null)
    setProgress({ status: "Inicializando...", progress: 0 })

    try {
      let imageFile = inputFile
      let imageDataUrl: string | undefined

      // Si es un PDF, convertirlo a imagen primero
      if (isPdfFile(inputFile)) {
        setProgress({ status: "Convirtiendo PDF a imagen...", progress: 10 })
        
        try {
          const pdfResult = await convertPdfToImageWithDataUrl(inputFile, {
            scale: 2.0, // Alta resolución para mejor OCR
            quality: 0.9 // Alta calidad
          })
          imageFile = pdfResult.file
          imageDataUrl = pdfResult.dataUrl
          setProgress({ status: "PDF convertido, iniciando OCR...", progress: 20 })
        } catch (pdfError) {
          throw new Error(`Error procesando PDF: ${pdfError instanceof Error ? pdfError.message : 'Error desconocido'}`)
        }
      } else {
        // Para imágenes normales, no necesitamos crear data URL aquí
        // ya que se maneja en el componente
        imageDataUrl = undefined
      }

      const result = await Tesseract.recognize(
        imageFile,
        "spa+eng", // Español e inglés
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              // Ajustar progreso si venimos de PDF (20-90% para OCR)
              const baseProgress = isPdfFile(inputFile) ? 20 : 0
              const ocrProgress = Math.round(m.progress * (isPdfFile(inputFile) ? 70 : 100))
              setProgress({
                status: "Reconociendo texto...",
                progress: baseProgress + ocrProgress
              })
            } else {
              const baseProgress = isPdfFile(inputFile) ? 20 : 0
              setProgress({
                status: m.status || "Procesando...",
                progress: baseProgress + Math.round(m.progress * (isPdfFile(inputFile) ? 70 : 100))
              })
            }
          },
          errorHandler: (err) => {
            console.error("Tesseract error:", err)
          }
        }
      )

      setProgress({ status: "Extrayendo datos...", progress: 90 })

      const extractedData = extractDataFromText(result.data.text)
      
      // Agregar la data URL al resultado
      extractedData.imageDataUrl = imageDataUrl
      
      setProgress({ status: "Completado", progress: 100 })
      
      return extractedData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(`Error al procesar la imagen: ${errorMessage}`)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [extractDataFromText])

  return {
    processImage,
    isProcessing,
    progress,
    error
  }
} 