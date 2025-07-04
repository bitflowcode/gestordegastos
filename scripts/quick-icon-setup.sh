#!/bin/bash

# 🎨 Setup Rápido de Iconos - Expense Tracker PWA
# Uso: ./scripts/quick-icon-setup.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎨 Setup Rápido de Iconos - Expense Tracker PWA${NC}"
echo "========================================================="
echo ""

# Verificar si existe el icono original
if [ -f "icon-original.png" ]; then
    echo -e "${GREEN}✅ Encontrado: icon-original.png${NC}"
    INPUT_FILE="icon-original.png"
elif [ -f "logo.png" ]; then
    echo -e "${GREEN}✅ Encontrado: logo.png${NC}"
    INPUT_FILE="logo.png"
elif [ -f "icono.png" ]; then
    echo -e "${GREEN}✅ Encontrado: icono.png${NC}"
    INPUT_FILE="icono.png"
else
    echo -e "${RED}❌ No se encontró el archivo de icono${NC}"
    echo -e "${YELLOW}📋 Opciones:${NC}"
    echo "  1. Guarda tu icono como 'icon-original.png' en la raíz del proyecto"
    echo "  2. O especifica el archivo: ./scripts/quick-icon-setup.sh tu-icono.png"
    echo ""
    echo -e "${BLUE}💡 Herramientas Online Alternativas:${NC}"
    echo "  - Favicon.io: https://favicon.io/favicon-converter/"
    echo "  - RealFaviconGenerator: https://realfavicongenerator.net/"
    exit 1
fi

# Verificar ImageMagick
if ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ ImageMagick no está instalado${NC}"
    echo -e "${YELLOW}📦 Instalación:${NC}"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo ""
    echo -e "${BLUE}💡 Alternativa: Usa herramientas online${NC}"
    echo "  1. Ve a https://favicon.io/favicon-converter/"
    echo "  2. Sube tu icono"
    echo "  3. Descarga el paquete"
    echo "  4. Copia los archivos a public/"
    exit 1
fi

echo -e "${BLUE}🔄 Generando iconos desde: $INPUT_FILE${NC}"
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

# Verificar archivos generados
echo ""
echo -e "${BLUE}🔍 Verificando archivos generados:${NC}"
for file in "public/favicon.ico" "public/icon-192.png" "public/icon-512.png" "public/apple-touch-icon.png"; do
    if [ -f "$file" ]; then
        size=$(du -h "$file" | cut -f1)
        echo -e "${GREEN}✅ $file ($size)${NC}"
    else
        echo -e "${RED}❌ $file (no encontrado)${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 ¡Iconos generados exitosamente!${NC}"
echo ""
echo -e "${BLUE}🔄 Próximos pasos:${NC}"
echo "  1. Reinicia el servidor: npm run dev"
echo "  2. Verifica el favicon en el navegador (Ctrl+F5 para forzar recarga)"
echo "  3. Prueba en móvil: Agregar a pantalla de inicio"
echo ""
echo -e "${GREEN}✨ ¡Tu app ahora tiene tu icono personalizado!${NC}" 