import "jspdf"

declare module "jspdf" {
  interface AutoTableOptions {
    head: string[][]
    body: string[][]
    startY?: number
    styles?: {
      fontSize?: number
    }
    headStyles?: {
      fillColor?: number[]
    }
    alternateRowStyles?: {
      fillColor?: number[]
    }
  }

  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF
  }
}

