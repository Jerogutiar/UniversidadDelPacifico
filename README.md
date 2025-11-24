# Sistema de Carnet Digital - Universidad del Pacífico

Sistema completo de gestión de carnets digitales para estudiantes de la Universidad del Pacífico. Permite la creación, administración y validación de carnets estudiantiles con código de barras escaneable.

## 🎯 Características Principales

- **Gestión de Estudiantes**: Creación, edición y eliminación de carnets digitales
- **Panel de Funcionarios**: Dashboard administrativo completo con estadísticas en tiempo real
- **Validación de Carnets**: Escáner de códigos de barras para validación rápida
- **Sistema de Préstamos**: Gestión completa de préstamos de biblioteca y laboratorio
- **Exportación de Datos**: Descarga de estudiantes, funcionarios y préstamos en JSON y CSV
- **Tema Claro/Oscuro**: Interfaz adaptativa con modo oscuro y diseño moderno
- **Diseño Responsive**: Totalmente adaptado para móviles y tablets
- **PDF Generation**: Descarga de carnets en formato PDF con código de barras
- **Autenticación Segura**: Sistema de login con hash SHA-256 y sesiones persistentes

## 📋 Requisitos Previos

- Cuenta de Supabase
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Servidor web para desarrollo local (Live Server, etc.)

## 🚀 Instalación

1. Clonar o descargar el repositorio
2. Configurar las credenciales de Supabase en `js/api.js`
3. Ejecutar el script SQL en Supabase (ver sección Base de Datos)
4. Abrir `index.html` en un navegador o servidor local

## 🗄️ Base de Datos

### Script SQL para Supabase

Ejecutar el siguiente script en el editor SQL de Supabase:

```sql
-- ============================================
-- BASE DE DATOS - SISTEMA DE CARNET DIGITAL
-- Universidad del Pacífico
-- ============================================

-- Tabla de Estudiantes
CREATE TABLE IF NOT EXISTS students (
  code TEXT PRIMARY KEY,
  cedula TEXT NOT NULL,
  name TEXT NOT NULL,
  lastname TEXT NOT NULL,
  program TEXT NOT NULL,
  expiry TEXT NOT NULL,
  sede TEXT NOT NULL,
  rh TEXT,
  photo TEXT,
  password_hash TEXT NOT NULL,
  first_login BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  password_history JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Tabla de Funcionarios
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_history JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_students_code ON students(code);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(active);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- Tabla de Préstamos (Biblioteca y Laboratorio)
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT NOT NULL,
  student_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('biblioteca', 'laboratorio')),
  item_type TEXT NOT NULL,
  item_description TEXT,
  staff_email TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (student_code) REFERENCES students(code) ON DELETE CASCADE
);

-- Índices para préstamos
CREATE INDEX IF NOT EXISTS idx_loans_student_code ON loans(student_code);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_category ON loans(category);
CREATE INDEX IF NOT EXISTS idx_loans_borrowed_at ON loans(borrowed_at DESC);

-- Políticas de Seguridad (RLS)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer estudiantes (para validación pública)
CREATE POLICY "Estudiantes públicos" ON students
  FOR SELECT
  USING (true);

-- Política: Solo funcionarios pueden insertar/actualizar estudiantes
CREATE POLICY "Funcionarios pueden gestionar estudiantes" ON students
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = current_setting('request.jwt.claim.email', true)::text
    )
  );

-- Política: Funcionarios pueden leer su propia información
CREATE POLICY "Funcionarios pueden leer staff" ON staff
  FOR SELECT
  USING (true);

-- Política: Solo funcionarios pueden gestionar staff
CREATE POLICY "Funcionarios pueden gestionar staff" ON staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = current_setting('request.jwt.claim.email', true)::text
    )
  );

-- Política: Permitir lectura pública de préstamos
CREATE POLICY "Permitir lectura de préstamos" ON loans
  FOR SELECT
  USING (true);

-- Política: Permitir inserción de préstamos (validación en frontend)
CREATE POLICY "Permitir inserción de préstamos" ON loans
  FOR INSERT
  WITH CHECK (true);

-- Política: Permitir actualización de préstamos (validación en frontend)
CREATE POLICY "Permitir actualización de préstamos" ON loans
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Política: Permitir eliminación de préstamos (validación en frontend)
CREATE POLICY "Permitir eliminación de préstamos" ON loans
  FOR DELETE
  USING (true);
```

### Estructura de Tablas

#### Tabla: `students`
- `code` (TEXT, PK): Código único del estudiante
- `cedula` (TEXT): Cédula de identidad
- `name` (TEXT): Nombre del estudiante
- `lastname` (TEXT): Apellidos del estudiante
- `program` (TEXT): Programa académico
- `expiry` (TEXT): Fecha de expiración (formato español)
- `sede` (TEXT): Sede de la universidad
- `rh` (TEXT): Factor RH (opcional)
- `photo` (TEXT): Foto en Base64 (opcional)
- `password_hash` (TEXT): Hash SHA-256 de la contraseña
- `first_login` (BOOLEAN): Indica si es primer acceso
- `active` (BOOLEAN): Estado activo/inactivo del carnet
- `password_history` (JSONB): Historial de cambios de contraseña
- `created_at` (BIGINT): Timestamp de creación
- `updated_at` (BIGINT): Timestamp de última actualización

#### Tabla: `staff`
- `id` (TEXT, PK): Identificador único del funcionario
- `name` (TEXT): Nombre completo
- `email` (TEXT, UNIQUE): Email institucional
- `password_hash` (TEXT): Hash SHA-256 de la contraseña
- `password_history` (JSONB): Historial de cambios de contraseña
- `created_at` (BIGINT): Timestamp de creación
- `updated_at` (BIGINT): Timestamp de última actualización

#### Tabla: `loans`
- `id` (UUID, PK): Identificador único del préstamo
- `student_code` (TEXT, FK): Código del estudiante
- `student_name` (TEXT): Nombre completo del estudiante
- `category` (TEXT): Categoría del préstamo ('biblioteca' o 'laboratorio')
- `item_type` (TEXT): Tipo de ítem prestado
- `item_description` (TEXT): Descripción adicional (opcional)
- `staff_email` (TEXT): Email del funcionario que registró
- `staff_name` (TEXT): Nombre del funcionario
- `borrowed_at` (TIMESTAMPTZ): Fecha y hora del préstamo
- `returned_at` (TIMESTAMPTZ): Fecha y hora de devolución (opcional)
- `status` (TEXT): Estado ('active' o 'returned')
- `created_at` (TIMESTAMPTZ): Timestamp de creación

## 📁 Estructura del Proyecto

```
UniversidadDelPacifico/
├── assets/
│   └── images/
│       ├── udp.png          # Logo de la universidad
│       └── favicon.ico      # Favicon
├── css/
│   ├── admin.css            # Estilos del panel de administración
│   ├── form.css             # Estilos de formularios
│   ├── modal.css            # Estilos de modales
│   ├── styles.css           # Estilos del carnet y componentes
│   ├── theme.css            # Variables de tema y dashboard
│   └── validator.css        # Estilos del validador
├── html/
│   ├── index.html           # Página de login
│   ├── staff.html           # Panel de funcionarios
│   └── student.html         # Panel de estudiantes
├── js/
│   ├── api.js               # API centralizada de Supabase
│   ├── auth.js              # Gestión de autenticación y sesiones
│   ├── card.js              # Generación de carnet y código de barras
│   ├── loans.js             # API de préstamos (biblioteca/laboratorio)
│   ├── login.js             # Lógica de la página de login
│   ├── modal.js             # Sistema de modales personalizados
│   ├── staff.js             # Lógica del panel de funcionarios
│   ├── staffLoans.js        # Interfaz de préstamos para funcionarios
│   ├── student.js           # Lógica del panel de estudiantes
│   └── utils.js             # Utilidades compartidas
└── README.md                # Este archivo
```

## 🎨 Colores Institucionales

- **Azul Principal**: `#2596be`
- **Verde Principal**: `#37a372`
- **Azul Claro**: `#4db8d4`
- **Verde Claro**: `#5bb889`

## 🔐 Seguridad

- Contraseñas hasheadas con SHA-256
- Sanitización de inputs para prevenir XSS
- Row Level Security (RLS) en Supabase
- Validación de email institucional para funcionarios
- Sesiones con expiración de 7 días

## 🚀 Funcionalidades por Rol

### Estudiante
- Visualizar carnet digital
- Cambiar contraseña (primer acceso)
- Descargar PDF del carnet
- Toggle de tema claro/oscuro
- **Restricción**: No se puede descargar el carnet si tiene préstamos activos pendientes

### Funcionario
- **Dashboard con estadísticas en tiempo real**
  - Total de estudiantes
  - Carnets activos, expirados y por vencer
  - Préstamos activos
  - Gráficos y métricas visuales
- **Gestión de estudiantes**
  - Crear, editar y eliminar estudiantes
  - Lista con filtros avanzados (búsqueda, programa, sede, estado)
  - Vista previa de carnet con información completa
  - Restablecer contraseñas individuales
- **Gestión de funcionarios**
  - Registrar nuevos funcionarios
  - Lista de funcionarios con búsqueda
  - Restablecer contraseñas de funcionarios
- **Validación de carnets**
  - Escáner de códigos de barras
  - Verificación de estado y vigencia
- **Sistema de préstamos (biblioteca/laboratorio)**
  - Registrar préstamos con fecha/hora personalizada
  - Campo de búsqueda en préstamos activos
  - Ver préstamos activos (muestra 3 por vista con scroll)
  - Marcar devoluciones
  - Historial completo con filtros múltiples
  - Préstamos de biblioteca (ítems predefinidos) y laboratorio (texto libre)
- **Exportación de datos completa**
  - **Estudiantes**: JSON y CSV con toda la información
  - **Funcionarios**: JSON y CSV con datos de acceso
  - **Préstamos Activos**: Préstamos en curso
  - **Historial de Préstamos**: Préstamos devueltos
  - **Todos los Préstamos**: Exportación completa
  - Formatos compatibles con Excel y herramientas de análisis

## 📊 Exportación de Datos

El sistema incluye un módulo completo de exportación que permite descargar toda la información en formatos JSON y CSV:

### Formatos Disponibles

#### JSON
- Incluye todos los datos completos
- Fotos codificadas en Base64
- Estructura completa de objetos
- Ideal para backups y migración de datos
- Fácil de procesar programáticamente

#### CSV
- Compatible con Microsoft Excel y Google Sheets
- Tablas separadas por comas
- Referencias de fotos por URL/placeholder
- Perfecto para análisis de datos y reportes
- Formato universal para importación

### Tipos de Exportación

| Tipo | JSON | CSV | Descripción |
|------|------|-----|-------------|
| **Estudiantes** | ✅ | ✅ | Todos los datos de estudiantes incluyendo fotos, programa, sede, estado |
| **Funcionarios** | ✅ | ✅ | Lista de funcionarios con correos y roles |
| **Préstamos Activos** | ✅ | ✅ | Préstamos en curso con información del estudiante y funcionario |
| **Historial de Préstamos** | ✅ | ✅ | Préstamos devueltos con fechas y duración |
| **Todos los Préstamos** | ✅ | ✅ | Exportación completa de todos los préstamos (activos y devueltos) |

### Datos Incluidos en Exportaciones

**Estudiantes**: Código, cédula, nombre, apellido, programa, sede, RH, fecha de expiración, estado, foto

**Funcionarios**: ID, nombre, email, fecha de creación

**Préstamos**: ID, código y nombre del estudiante, categoría (biblioteca/laboratorio), ítem, descripción, fecha de préstamo, fecha de devolución, días prestado, estado, funcionario responsable

## 📱 Responsive Design

El sistema está completamente optimizado para:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL)
- **Librerías**:
  - JsBarcode: Generación de códigos de barras
  - html2canvas: Captura de elementos
  - jsPDF: Generación de PDFs
  - Html5Qrcode: Escáner de códigos

## 📝 Notas de Desarrollo

- Las fotos se almacenan en Base64 en la base de datos
- Los códigos de barras usan formato CODE128
- El formato de fecha es español legible (ej: "15 ENERO 2025")
- Las contraseñas por defecto para nuevos estudiantes son su cédula
- El sistema valida automáticamente carnets expirados
- Los préstamos tienen eliminación en cascada (al eliminar estudiante se eliminan sus préstamos)
- Las exportaciones JSON incluyen fotos en Base64, las CSV solo referencias
- El sistema de búsqueda en préstamos activos filtra en tiempo real
- Los colores de los botones son: Verde (Ver), Naranja (Editar), Rojo (Eliminar)
- La lista de préstamos activos muestra 3 elementos completos antes de requerir scroll

## 🔧 Configuración

### Variables de Entorno

Configurar en `js/api.js`:

```javascript
const SUPABASE_CONFIG = {
  url: 'TU_URL_DE_SUPABASE',
  anonKey: 'TU_ANON_KEY'
};
```

## 📄 Licencia

Este proyecto fue desarrollado para la Universidad del Pacífico.

## 👥 Soporte

Para soporte técnico, contactar al equipo de desarrollo de la Universidad del Pacífico.

---

**Desarrollado para Universidad del Pacífico** 🎓

