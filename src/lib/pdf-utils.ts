"use client"

import * as pdfjsLib from 'pdfjs-dist'

// Configuración del worker para PDF.js
if (typeof window !== 'undefined') {
  // En producción, usar CDN con la misma versión que el paquete instalado
  if (process.env.NODE_ENV === 'production') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.mjs'
  } else {
    // En desarrollo, intentar usar el worker local, con fallback a CDN
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString()
    } catch (error) {
      console.warn('No se pudo cargar worker local, usando CDN')
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.mjs'
    }
  }
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

  const {
    pageNumber = 1,
    scale = 2.0,
    format = 'image/jpeg',
    quality = 0.8
  } = options

  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    
    // Cargar PDF con configuración básica
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    
    if (pageNumber > pdf.numPages) {
      throw new Error(`La página ${pageNumber} no existe. El PDF tiene ${pdf.numPages} páginas.`)
    }
    
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      throw new Error('No se pudo crear el contexto del canvas')
    }
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    }
    
    await page.render(renderContext).promise
    
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