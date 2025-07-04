# 🚀 Configuración para Desarrollo Local

## 📋 Requisitos Previos

- Node.js 18+ instalado
- NPM o Yarn instalado
- (Opcional) Cuenta de Supabase para autenticación

## ⚡ Configuración Rápida

### 1. Instalación de Dependencias

```bash
npm install
# o
yarn install
```

### 2. Configuración de Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
# .env.local

# ===========================================
# CONFIGURACIÓN MÍNIMA PARA DESARROLLO
# ===========================================

# Supabase (OPCIONAL - para autenticación)
# Si no configuras esto, la app funcionará en modo "guest"
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# N8N Webhook (OPCIONAL - para automatización)
N8N_WEBHOOK_SECRET=mi-secreto-super-seguro

# Configuración de desarrollo
LOG_LEVEL=debug
ENABLE_EXPERIMENTAL_FEATURES=true
```

### 3. Ejecutar la Aplicación

```bash
npm run dev
# o
yarn dev
```

La app estará disponible en `http://localhost:3000`

---

## 🎯 Funcionalidades Disponibles SIN Configuración

### ✅ Funcionan Inmediatamente:
- ✅ **Modo Guest**: Agregar gastos localmente
- ✅ **OCR de Recibos**: Usando Tesseract.js (gratis)
- ✅ **Batch Processing**: Procesamiento masivo de archivos
- ✅ **Informes Automáticos**: Generación de reportes (sin envío email)
- ✅ **Templates de Automatización**: Visualización de opciones
- ✅ **Exportación**: JSON, CSV, PDF
- ✅ **Tema Claro/Oscuro**: Funciona completamente
- ✅ **PWA**: Funciona offline
- ✅ **Gastos Recurrentes**: Almacenamiento local

### ⚠️ Requieren Configuración:
- 🔧 **Autenticación**: Necesita Supabase
- 🔧 **Sincronización**: Necesita Supabase
- 🔧 **Webhooks n8n**: Necesita N8N_WEBHOOK_SECRET
- 🔧 **Envío de Informes**: Necesita configuración de email

---

## 📊 Configuración Avanzada (Opcional)

### 🗄️ Supabase (Autenticación + Sincronización)

1. **Crear cuenta en Supabase**:
   - Ve a [supabase.com](https://supabase.com)
   - Crea un nuevo proyecto
   - Anota la URL y la anon key

2. **Configura las variables**:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```

3. **Crea las tablas** (opcional - se crean automáticamente):
   ```sql
   -- La app creará estas tablas automáticamente
   -- user_profiles, user_expenses, user_categories, user_recurring_expenses
   ```

### 🤖 N8N (Automatización)

1. **Instalar n8n**:
   ```bash
   npm install n8n -g
   # o usar n8n.cloud
   ```

2. **Configurar webhook**:
   ```bash
   N8N_WEBHOOK_SECRET=tu-secreto-super-seguro
   ```

### 📧 Email (Informes Automáticos)

```bash
# Ejemplo con Gmail
EMAIL_FROM=tu-email@gmail.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
```

---

## 🧪 Probando las Nuevas Funcionalidades

### 1. 📊 Informes Automáticos
1. Ve a **Configuración** → **Procesamiento**
2. Encuentra la sección **Informes Automáticos**
3. Selecciona un template (ej: "Resumen Mensual Completo")
4. Configura frecuencia y email
5. Haz clic en **Vista Previa** para generar un reporte

### 2. ⚡ Batch Processing
1. Ve a **Configuración** → **Procesamiento**
2. Encuentra la sección **Procesamiento Masivo**
3. Arrastra múltiples archivos (JPG, PNG, PDF)
4. Configura umbral de confianza
5. Haz clic en **Procesar Todos**
6. Revisa resultados y aprúebalos

### 3. 🤖 Templates de Automatización
1. Ve a **Configuración** → **Automatización**
2. Encuentra la sección **Templates de Automatización**
3. Selecciona un template (ej: "Auto-importar desde Gmail")
4. Descarga el template JSON
5. Ve instrucciones paso a paso

---

## 🔍 Debugging y Desarrollo

### Logs Útiles
```bash
# Ver logs de la app
npm run dev

# Los logs aparecerán en la consola del navegador
# y en la terminal donde ejecutas npm run dev
```

### Estructura de Archivos Nuevos
```
src/
├── components/ui/
│   ├── automatic-reports.tsx      # 📊 Informes automáticos
│   ├── batch-processor.tsx        # ⚡ Procesamiento masivo
│   └── automation-templates.tsx   # 🤖 Templates n8n
├── app/api/
│   ├── reports/generate/          # 📊 API de informes
│   └── webhooks/n8n/             # 🤖 Webhooks n8n
```

### Datos de Prueba
La app incluye datos de prueba automáticos para:
- ✅ Merchants aleatorios (Mercadona, Amazon, etc.)
- ✅ Categorías predefinidas
- ✅ Importes realistas
- ✅ Niveles de confianza variables

---

## 🐛 Problemas Comunes

### "Base de datos no configurada"
- **Solución**: Es normal si no has configurado Supabase
- **Alternativa**: Usa modo guest (funciona perfectamente)

### "Webhook no disponible"
- **Solución**: Es normal si no has configurado n8n
- **Alternativa**: Usa templates para ver la funcionalidad

### OCR no funciona
- **Verificación**: Asegúrate de que los archivos sean < 10MB
- **Alternativa**: Usa imágenes con buena calidad y contraste

### Errores de TypeScript
- **Solución**: Ejecuta `npm run lint` para ver errores
- **Alternativa**: Reinicia el servidor de desarrollo

---

## 🎯 Próximos Pasos

Una vez que tengas la app funcionando:

1. **Prueba el flujo completo** sin configuración
2. **Configura Supabase** si quieres autenticación
3. **Configura n8n** si quieres automatización
4. **Personaliza templates** según tus necesidades

¡Disfruta explorando las nuevas funcionalidades! 🚀 