# 💰 Gestor de Gastos PWA

Una aplicación web progresiva (PWA) para gestión de gastos personales con sincronización multi-dispositivo y funcionalidad offline completa.

## ✨ Características Principales

### 🚀 Sistema Híbrido Inteligente
- **Modo Guest**: Uso inmediato sin registro, datos en localStorage
- **Modo Sincronizado**: Sincronización automática multi-dispositivo con Supabase
- **Migración automática**: Los datos locales se transfieren al crear cuenta
- **Fallback offline**: Funciona sin conexión, sincroniza cuando vuelve la conexión

### 📱 PWA Completa
- **Instalable**: Se puede instalar como app nativa
- **Offline**: Funciona completamente sin conexión
- **Service Worker**: Caché inteligente y actualizaciones automáticas
- **Responsive**: Diseño adaptativo para móvil, tablet y desktop

### 💸 Gestión de Gastos Avanzada
- **Categorías personalizables**: Crea y gestiona tus propias categorías
- **Gastos recurrentes**: Automatiza gastos fijos mensuales
- **Sugerencias inteligentes**: Detecta patrones y sugiere recurrentes
- **Filtros por mes**: Navega fácilmente entre diferentes períodos
- **Exportación de datos**: Descarga tus datos en formato JSON

### 🔍 OCR de Recibos
- **Escaneo automático**: Fotografía recibos y extrae datos automáticamente
- **Tesseract.js**: OCR completamente offline
- **Procesamiento inteligente**: Detecta montos, fechas y conceptos

### 🔐 Autenticación Robusta
- **Registro con email**: Confirmación por enlace de activación
- **Login seguro**: Autenticación con Supabase Auth
- **Recuperación de contraseña**: Sistema completo de reset
- **UX optimizada**: Modales intuitivos con validaciones en tiempo real

### 📊 Visualización de Datos
- **Gráficos interactivos**: Visualiza gastos por categoría
- **Resúmenes mensuales**: Totales y distribución de gastos
- **Historial completo**: Lista filtrable y editable
- **Indicadores visuales**: Estados de carga y sincronización

## 🛠️ Tecnologías Utilizadas

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **PWA**: next-pwa, Service Workers
- **OCR**: Tesseract.js
- **State**: Context API, localStorage
- **Icons**: Lucide React

## 🚀 Despliegue en Producción

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta el siguiente SQL en el Editor SQL de Supabase:

```sql
-- Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de categorías de usuario
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Crear tabla de gastos de usuario
CREATE TABLE IF NOT EXISTS user_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  note TEXT DEFAULT '',
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de gastos recurrentes
CREATE TABLE IF NOT EXISTS user_recurring_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own categories" ON user_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON user_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON user_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON user_categories
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own expenses" ON user_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses" ON user_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" ON user_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" ON user_expenses
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own recurring expenses" ON user_recurring_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring expenses" ON user_recurring_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring expenses" ON user_recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring expenses" ON user_recurring_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Función para crear categorías por defecto
CREATE OR REPLACE FUNCTION create_default_categories_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_categories (user_id, name, icon) VALUES
    (NEW.id, 'Alimentación', '🍔'),
    (NEW.id, 'Transporte', '🚗'),
    (NEW.id, 'Entretenimiento', '🎬'),
    (NEW.id, 'Salud', '🏥'),
    (NEW.id, 'Hogar', '🏠'),
    (NEW.id, 'Educación', '📚'),
    (NEW.id, 'Ropa', '👕'),
    (NEW.id, 'Otros', '💰');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear categorías automáticamente
CREATE OR REPLACE TRIGGER create_default_categories_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_categories_for_user();
```

### 2. Variables de Entorno

Crea un archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key_aqui
```

### 3. Desplegar

#### Vercel (Recomendado)
1. Conecta tu repositorio a [Vercel](https://vercel.com)
2. Agrega las variables de entorno en la configuración
3. Despliega automáticamente

#### Netlify
1. Conecta tu repositorio a [Netlify](https://netlify.com)
2. Comando de build: `npm run build`
3. Directorio de publicación: `.next`
4. Agrega las variables de entorno

#### Otros proveedores
- Railway
- Heroku
- DigitalOcean App Platform

## 🔧 Desarrollo Local

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/expense-tracker-pwa.git
cd expense-tracker-pwa

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Ejecutar en modo desarrollo
npm run dev

# Build de producción
npm run build
npm run start
```

## 📱 Uso de la Aplicación

### Para Usuarios Nuevos
1. **Uso inmediato**: Abre la app y comienza a registrar gastos
2. **Sin registro**: Todos los datos se guardan localmente
3. **Upgrade cuando quieras**: Crea cuenta para sincronizar en múltiples dispositivos

### Para Usuarios con Cuenta
1. **Inicia sesión**: Tus datos se sincronizan automáticamente
2. **Multi-dispositivo**: Accede desde cualquier dispositivo
3. **Backup automático**: Nunca pierdas tus datos

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🌟 Características Próximas

- [ ] Importación desde CSV/Excel
- [ ] Recordatorios push para gastos recurrentes
- [ ] Análisis de gastos con IA
- [ ] Modo oscuro/claro
- [ ] Exportación a PDF
- [ ] Múltiples monedas
- [ ] Presupuestos y metas de ahorro

---

**¡Desarrollado con ❤️ para hacer más fácil el control de gastos personales!**
