# Sistema de Carnet Digital - Universidad del Pacífico

Sistema completo de gestión de carnets digitales para estudiantes de la Universidad del Pacífico. Permite la creación, administración y validación de carnets estudiantiles con código de barras escaneable.

## 🎯 Características Principales

- **Gestión de Estudiantes**: Creación y edición de carnets digitales
- **Panel de Funcionarios**: Dashboard administrativo completo
- **Validación de Carnets**: Escáner de códigos de barras para validación
- **Exportación de Datos**: Descarga de información en formato JSON y CSV
- **Tema Claro/Oscuro**: Interfaz adaptativa con modo oscuro
- **Diseño Responsive**: Totalmente adaptado para móviles y tablets
- **PDF Generation**: Descarga de carnets en formato PDF
- **Autenticación Segura**: Sistema de login con hash SHA-256

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

-- Políticas de Seguridad (RLS)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

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
│   ├── login.js             # Lógica de la página de login
│   ├── modal.js             # Sistema de modales personalizados
│   ├── staff.js             # Lógica del panel de funcionarios
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

### Funcionario
- Dashboard con estadísticas
- Crear/editar estudiantes
- Lista de estudiantes con filtros
- Restablecer contraseñas
- Gestionar funcionarios
- Validar carnets con escáner
- Exportar datos (JSON/CSV)

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

