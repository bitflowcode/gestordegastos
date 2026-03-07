"use client"

import * as pdfjsLib from 'pdfjs-dist'

// Configuración del worker para PDF.js
if (typeof window !== 'undefined') {
  // Usar CDN con la versión instalada (más confiable)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

export interface PdfToImageOptions {
  pageNumber?: number
  scale?: number
  format?: string
  quality?: number
}

export interface PdfConversionResult {
  file: File
  dataUrl: string
}

/**
 * Convierte una página de PDF a imagen
 */
export async function convertPdfToImage(
  pdfFile: File, 
  options: PdfToImageOptions = {}
): Promise<File> {
  const result = await convertPdfToImageWithDataUrl(pdfFile, options)
  return result.file
}

/**
 * Convierte una página de PDF a imagen y devuelve tanto el File como la data URL
 */
export async function convertPdfToImageWithDataUrl(
  pdfFile: File, 
  options: PdfToImageOptions = {}
): Promise<PdfConversionResult> {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is only available on the client side')
  }

  // Validar tamaño del archivo (máximo 10MB)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (pdfFile.size > maxSize) {
    throw new Error(`El PDF es demasiado grande (${(pdfFile.size / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB`)
  }

  const {
    pageNumber = 1,
    scale = 2.0,
    format = 'image/jpeg',
    quality = 0.85
  } = options

  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    
    // Cargar PDF con configuración optimizada y timeout
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
    })
    
    const pdf = await Promise.race([
      loadingTask.promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: El PDF tardó demasiado en cargar')), 30000)
      )
    ])
    
    if (pageNumber > pdf.numPages) {
      throw new Error(`La página ${pageNumber} no existe. El PDF tiene ${pdf.numPages} páginas.`)
    }
    
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    
    // Limitar resolución máxima para evitar problemas de memoria
    const maxDimension = 4000
    let finalScale = scale
    if (viewport.width > maxDimension || viewport.height > maxDimension) {
      finalScale = Math.min(maxDimension / viewport.width, maxDimension / viewport.height) * scale
    }
    
    const finalViewport = page.getViewport({ scale: finalScale })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    
    if (!context) {
      throw new Error('No se pudo crear el contexto del canvas')
    }
    
    canvas.width = finalViewport.width
    canvas.height = finalViewport.height
    
    // Fondo blanco para mejor OCR
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    const renderContext = {
      canvasContext: context,
      viewport: finalViewport,
    }
    
    await page.render(renderContext).promise
    
    // Limpiar recursos
    page.cleanup()
    
    // Obtener data URL del canvas
    const dataUrl = canvas.toDataURL(format, quality)
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo convertir el canvas a blob'))
            return
          }
          
          const imageFile = new File(
            [blob], 
            `${pdfFile.name.replace('.pdf', '')}-page${pageNumber}.jpg`,
            { type: format }
          )
          
          resolve({
            file: imageFile,
            dataUrl: dataUrl
          })
        },
        format,
        quality
      )
    })
    
  } catch (error) {
    console.error('Error procesando PDF:', error)
    throw new Error(`No se pudo procesar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Obtiene información básica del PDF
 */
export async function getPdfInfo(pdfFile: File) {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is only available on the client side')
  }
  
  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    
    return {
      numPages: pdf.numPages,
      fingerprints: pdf.fingerprints,
    }
  } catch (error) {
    console.error('Error obteniendo información del PDF:', error)
    throw new Error('No se pudo leer el archivo PDF')
  }
}

/**
 * Verifica si un archivo es un PDF válido
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
} 