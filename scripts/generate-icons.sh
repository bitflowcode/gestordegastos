#!/bin/bash

# 🎨 Script para generar iconos automáticamente
# Uso: ./scripts/generate-icons.sh tu-icono-original.png

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎨 Generador de Iconos - Expense Tracker PWA${NC}"
echo "=================================================="

# Verificar que se proporcionó un archivo
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Debes proporcionar la ruta del icono original${NC}"
    echo -e "${YELLOW}Uso: ./scripts/generate-icons.sh tu-icono-original.png${NC}"
    exit 1
fi

INPUT_FILE="$1"

# Verificar que el archivo existe
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ Error: El archivo '$INPUT_FILE' no existe${NC}"
    exit 1
fi

# Verificar que ImageMagick está instalado
if ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ Error: ImageMagick no está instalado${NC}"
    echo -e "${YELLOW}Instala ImageMagick:${NC}"
    echo "  - macOS: brew install imagemagick"
    echo "  - Ubuntu: sudo apt-get install imagemagick"
    echo "  - Windows: Descarga desde https://imagemagick.org/script/download.php"
    echo ""
    echo -e "${BLUE}💡 Alternativa: Usa herramientas online (ver ICON_SETUP.md)${NC}"
    exit 1
fi

# Crear directorio public si no existe
mkdir -p public

echo -e "${BLUE}📁 Generando iconos desde: $INPUT_FILE${NC}"
echo ""

# Generar favicon.ico (32x32)
echo -e "${YELLOW}🔄 Generando favicon.ico (32x32)...${NC}"
convert "$INPUT_FILE" -resize 32x32 public/favicon.ico
echo -e "${GREEN}✅ favicon.ico generado${NC}"

# Generar icon-192.png (192x192)
echo -e "${YELLOW}🔄 Generando icon-192.png (192x192)...${NC}"
convert "$INPUT_FILE" -resize 192x192 public/icon-192.png
echo -e "${GREEN}✅ icon-192.png generado${NC}"

# Generar icon-512.png (512x512)
echo -e "${YELLOW}🔄 Generando icon-512.png (512x512)...${NC}"
convert "$INPUT_FILE" -resize 512x512 public/icon-512.png
echo -e "${GREEN}✅ icon-512.png generado${NC}"

# Generar apple-touch-icon.png (180x180)
echo -e "${YELLOW}🔄 Generando apple-touch-icon.png (180x180)...${NC}"
convert "$INPUT_FILE" -resize 180x180 public/apple-touch-icon.png
echo -e "${GREEN}✅ apple-touch-icon.png generado${NC}"

echo ""
echo -e "${GREEN}🎉 ¡Todos los iconos generados exitosamente!${NC}"
echo ""
echo -e "${BLUE}📋 Archivos generados:${NC}"
echo "  📄 public/favicon.ico (32x32)"
echo "  📄 public/icon-192.png (192x192)"
echo "  📄 public/icon-512.png (512x512)"
echo "  📄 public/apple-touch-icon.png (180x180)"
echo ""
echo -e "${BLUE}🔄 Próximos pasos:${NC}"
echo "  1. Reinicia el servidor de desarrollo (npm run dev)"
echo "  2. Prueba el favicon en el navegador"
echo "  3. Prueba la PWA en móvil agregando a pantalla inicio"
echo ""
echo -e "${GREEN}✨ ¡Tu app ahora tiene tu icono personalizado!${NC}" 