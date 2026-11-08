# RRHH Suite

Software de gestión de personas para hoteles y empresas de servicios. Nace del análisis de
[astrohms.com/hr](https://astrohms.com/hr) y prioriza **vacaciones y ausencias**, con el resto de
módulos HR planificados sobre la misma base.

**Estado:** F0 (núcleo), F1 (vacaciones y ausencias), F2 (fichaje y jornada) y autenticación
completa funcionando sobre **PostgreSQL/Neon**. F3–F4 tienen la navegación, el modelo de datos y la
especificación listos.

## Por qué una app y no solo Excel/Sheets

Una hoja de cálculo es más fácil para una empresa pequeña con un único gestor, y por eso la app la
usa como **interfaz**, no como base de datos:

- **Importación** guiada desde `.xlsx` (empleados, saldos iniciales, festivos).
- **Exportación** a Excel con hojas de empleados, saldos, solicitudes, calendario y festivos.
- **PostgreSQL** como fuente de verdad: transacciones, permisos por rol, auditoría y backups
  gestionados por Neon.

Google Apps Script se descartó como núcleo por las cuotas de ejecución, la ausencia de
transacciones y la dificultad de testear y revender el resultado.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Nuxt 4 + Vue 3 + TypeScript |
| UI | Tailwind CSS 4 + Nuxt UI 4 |
| Runtime | Bun (desarrollo) / Node 22 (Docker) |
| Base de datos | PostgreSQL 17 · Neon (producción) |
| ORM | Drizzle ORM + `pg` |
| Auth | better-auth: registro, verificación, reset, sesiones y roles |
| Validación | Zod |
| Excel | ExcelJS |
| Tests | Vitest + Playwright |

## Arranque rápido

```bash
bun install
cp .env.example .env      # configura DATABASE_URL y BETTER_AUTH_SECRET
bun run db:migrate
bun run db:seed
bun run dev               # http://localhost:3000
```

### Opción A · Neon (producción)

1. Crea un proyecto en [Neon](https://neon.tech) y copia la cadena **pooled**:
   `postgresql://usuario:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
2. Ponla en `.env` como `DATABASE_URL`.
3. Ejecuta `bun run db:migrate` y, si quieres datos de demo, `bun run db:seed`.
4. Define `BETTER_AUTH_URL` con la URL pública real (por ejemplo `https://rrhh.miempresa.com`).

Neon gestiona backups con point-in-time restore y branching desde su consola.

### Opción B · PostgreSQL local

```bash
docker compose -f docker-compose.dev.yml up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/rrhh
bun run db:migrate && bun run db:seed
```

### Cuentas de demostración

| Rol | Email | Contraseña |
|---|---|---|
| Administración | `admin@hotelmarina.test` | `Admin1234!` |
| Mando | `manager@hotelmarina.test` | `Manager1234!` |
| Empleado | `empleado@hotelmarina.test` | `Empleado1234!` |

El seed crea **Hotel Marina Salou** con 25 empleados en Recepción, Cocina y Pisos, festivos de dos
años, derechos calculados con antigüedad, solicitudes pendientes y bolsa de horas.

## Autenticación

Rutas:

| Ruta | Función |
|---|---|
| `/signin` | Inicio de sesión |
| `/signup` | Registro con nombre, email y contraseña |
| `/forgot-password` | Solicitud de enlace de recuperación |
| `/reset-password?token=…` | Nueva contraseña desde el enlace del correo |
| `/verify-email?token=…` | Verificación de email |
| `/cuenta` | Perfil, cambio de contraseña, sesiones abiertas y cierre global |

Reglas:

- **Primera cuenta de una instalación nueva → rol administración**; el resto entra como empleado.
- Si ya existe una ficha de empleado con el mismo email, el registro la **vincula
  automáticamente** (`employees.userId`).
- Roles: `admin`, `manager`, `employee`. La autorización se comprueba en cada endpoint.
- Contraseñas con mínimo 8 caracteres, hash gestionado por better-auth.
- Sesiones de 7 días con renovación diaria; se pueden listar y revocar desde `/cuenta`.
- Recuperación de contraseña con token de 1 hora; al cambiarla se revocan las demás sesiones.
- Verificación de email opcional: `AUTH_REQUIRE_EMAIL_VERIFICATION=true` bloquea el login hasta
  confirmar el correo. Requiere SMTP configurado.
- **Sin SMTP**, los correos de auth se escriben en la consola del servidor (`[auth:mail]`), lo que
  permite copiar el enlace en desarrollo.

Variables relacionadas:

| Variable | Uso |
|---|---|
| `BETTER_AUTH_SECRET` | Firma de sesiones y tokens (obligatoria en producción) |
| `BETTER_AUTH_URL` | URL pública de la app; debe coincidir con el origen real |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Orígenes extra separados por coma |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `true` exige email verificado para entrar |
| `AUTH_SEND_VERIFICATION_ON_SIGNUP` | `true` envía verificación al registrarse |

## Scripts

| Comando | Qué hace |
|---|---|
| `bun run dev` | Servidor de desarrollo |
| `bun run build` / `preview` | Build de producción |
| `bun run test` | Tests unitarios del dominio |
| `bun run test:e2e` | Playwright (usa una base `rrhh_e2e` local) |
| `bun run typecheck` | Typecheck de Nuxt y Vue |
| `bun run lint` | ESLint |
| `bun run db:generate` | Genera migración desde el esquema |
| `bun run db:migrate` | Aplica migraciones |
| `bun run db:seed` | Siembra datos de demo |
| `bun run db:reset` | Vacía el esquema y vuelve a migrar y sembrar |
| `bun run backup:dump` | Copia lógica con `pg_dump` y retención |

## Reglas de vacaciones

Configurables por empresa en **Ajustes**:

- **Cómputo**: 30 días naturales o 22 laborables (se excluyen fines de semana y festivos).
- **Prorrateo** por alta y baja dentro del año.
- **Arrastre** máximo de días al año siguiente.
- **Antigüedad**: días extra por tramos (por ejemplo, +1 día cada 5 años, con tope).
- **Antelación mínima** para solicitar.
- **Bolsa de horas**: movimientos de horas extra, conversión a días (`8 h = 1 día` por defecto).
- **Cobertura mínima por departamento**: bloquea solicitudes que dejarían el área bajo mínimos.
- **Solapes**: una persona no puede tener dos ausencias activas en las mismas fechas.
- **Estados**: pendiente → aprobada/rechazada → cancelada, con auditoría de cada cambio.

El motor vive en `server/services/leave/` y es lógica pura, sin acceso a base de datos:

```
working-days.ts  → días naturales/laborables, festivos, solapes, concurrencia
accrual.ts       → devengo anual, prorrateo, antigüedad
balance.ts       → saldo (derecho, disfrutado, reservado, disponible), bolsa de horas
validation.ts    → reglas de negocio de una solicitud
```

## Fichaje y jornada

Cada persona ficha su entrada y salida desde `/fichaje` o desde el widget del panel principal.

- **Un botón**: alterna entrada/salida según el último fichaje abierto; el servidor rechaza una
  entrada si ya hay una sesión abierta.
- **Sesiones**: empareja entradas y salidas en orden; admite turnos partidos y turnos de noche
  (el turno completo se imputa al día en que empieza).
- **Horario contractual**: por empresa (Ajustes) o por empleado (importación Excel). Ejemplo:
  07:20–14:50 = 7 h 30 min. La jornada prevista sale de ese horario; si no está definido, de
  `horas semanales / días laborables`.
- **Retraso y salida anticipada**: la primera entrada y la última salida se comparan con el horario
  contractual y se muestran por día y en el export.
- **Horas trabajadas**: suma de sesiones cerradas; la sesión abierta de hoy suma en vivo.
- **Balance diario**: trabajado − previsto, con **tolerancia configurable** (5 min por defecto)
  para no marcar excesos o defectos irrelevantes.
- **Días sin fichaje**: no generan déficit, para que vacaciones, bajas o descansos no ensucien el
  balance.
- **Incidencias**: entradas duplicadas, salidas sin entrada y sesiones antiguas sin cerrar se
  señalan y no inflan las horas.
- **Correcciones** (mando/admin): alta manual de un fichaje con motivo, marcada como corregida y
  auditada.
- **Bolsa de horas**: las horas extra de un día se pueden acreditar en la bolsa con un clic
  (`attendance.credit_overtime`), sin duplicar si ya se hizo.
- **Registro exportable**: Excel con `Registro` (entrada/salida por sesión), `Jornada diaria` y
  `Resumen`, con fechas y horas en la zona horaria de la empresa.

El motor vive en `server/services/attendance/` y es lógica pura:

```
time.ts       → zona horaria, claves de día, duraciones y semanas
sessions.ts   → emparejado, resumen diario/rango, estado en vivo
```

Pendiente para completar el RD-ley 8/2019 al 100 %: kiosco con PIN, huella y firma del registro.
La base actual ya guarda IP, user-agent, origen, corrección y auditoría.

Ejemplo con el horario de la demo (07:20–14:50): si alguien ficha 07:30–14:30, el día muestra
7 h trabajadas, 7 h 30 previstas, 10 min de retraso, 20 min de salida anticipada y −30 min de saldo.
Si esa salida está autorizada por el mando, se puede ampliar la tolerancia en Ajustes o añadir una
autorización por día en una iteración siguiente.

## Estructura

```
app/
  pages/          signin, signup, forgot-password, reset-password, verify-email,
                  cuenta, dashboard, vacaciones, calendario, aprobaciones,
                  fichaje, empleados, ajustes y esqueletos de módulos futuros
  components/     AuthShell, layout, tarjetas, badges, estados vacíos
  composables/    useSession, useAttendance
  utils/          formato de fechas, preview de días y tiempos de jornada
server/
  api/            auth, me, leave, attendance, employees, departments, settings,
                  exports, imports, audit
  database/       esquema Drizzle, migraciones, seed, reset y cliente PostgreSQL
  services/       dominio puro testeable (leave y attendance)
  plugins/        migración automática al arrancar
  utils/          db, auth, auth-email, sesión, auditoría, email, vacaciones y jornada
tests/unit/       devengo, festivos, saldos, solapes, validación y fichajes
tests/e2e/        flujos completos de auth, vacaciones y fichaje
```

## API principal

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/sign-up/email` | Registro |
| POST | `/api/auth/sign-in/email` | Login |
| POST | `/api/auth/sign-out` | Cierre de sesión |
| POST | `/api/auth/forget-password` | Enviar enlace de recuperación |
| POST | `/api/auth/reset-password` | Cambiar contraseña con token |
| GET | `/api/auth/verify-email` | Verificar email con token |
| POST | `/api/auth/change-password` | Cambiar contraseña con la actual |
| GET | `/api/auth/list-sessions` | Sesiones abiertas |
| POST | `/api/auth/revoke-session` / `revoke-other-sessions` / `revoke-sessions` | Revocar sesiones |
| GET | `/api/me` | Usuario, empleado, empresa y ajustes |
| GET | `/api/leave/balance?year=` | Saldos y bolsa de horas |
| GET | `/api/leave/types` | Tipos de permiso |
| GET | `/api/leave/holidays?year=` | Festivos |
| GET | `/api/leave/calendar?year=&departmentId=` | Eventos del calendario |
| GET | `/api/leave/requests?scope=mine\|team\|all&status=&year=` | Solicitudes |
| POST | `/api/leave/requests` | Crear solicitud (valida saldo, solape y cobertura) |
| POST | `/api/leave/requests/:id/decision` | Aprobar o rechazar |
| POST | `/api/leave/requests/:id/cancel` | Cancelar |
| GET/POST | `/api/leave/overtime` | Bolsa de horas |
| POST | `/api/attendance/clock` | Fichar entrada/salida (automático o `direction`) |
| GET | `/api/attendance/status?employeeId=` | Estado en vivo, marcas de hoy y balance |
| GET | `/api/attendance/summary?from=&to=&employeeId=` | Resumen diario y totales |
| GET | `/api/attendance/team` | Equipo ahora (mando/admin) |
| POST | `/api/attendance/correction` | Alta manual de fichaje auditada |
| POST | `/api/attendance/credit` | Acreditar horas extra en la bolsa |
| GET | `/api/exports/attendance.xlsx?from=&to=` | Registro de jornada en Excel |
| GET | `/api/employees` | Plantilla (mando/admin) |
| GET | `/api/departments` | Departamentos y headcount |
| GET/PUT | `/api/settings` | Configuración (admin) |
| GET | `/api/audit` | Auditoría (admin) |
| GET | `/api/exports/leave.xlsx?year=` | Exportación Excel |
| GET | `/api/imports/template` | Plantilla Excel |
| POST | `/api/imports/employees` | Importación de empleados y festivos |

## Excel

- **Plantilla** con hojas `Empleados`, `Festivos` e `Instrucciones`.
- **Importación** idempotente: el email identifica al empleado; si existe se actualiza.
- Los departamentos nuevos se crean automáticamente.
- Si se indica «Vacaciones disponibles», ese valor manda; si se deja vacío se calcula con el
  convenio configurado.
- **Exportación** con formato, cabeceras fijas y hojas listas para filtrar.

## Datos y backups

- **Neon** ofrece point-in-time restore y branching desde su consola; es la vía recomendada en
  producción.
- **Copia lógica** propia:

  ```bash
  DATABASE_URL="postgresql://…" bun run backup:dump
  # Restaurar:
  pg_restore --clean --if-exists -d "$DATABASE_URL" backups/rrhh-20261108-030000.dump
  ```

  El script usa `pg_dump` si está instalado y, si no, el contenedor `postgres:17-alpine`.
- Cron sugerido:

  ```cron
  0 3 * * * cd /srv/rrhh-suite && set -a && . ./.env && set +a && bun run backup:dump
  ```

Prueba la restauración al menos una vez al trimestre. Un backup que nunca se ha restaurado no es
un backup.

## Docker

```bash
cp .env.example .env       # DATABASE_URL de Neon + secretos
docker compose up -d --build
```

La app aplica las migraciones al arrancar. Para desarrollo con PostgreSQL local:

```bash
docker compose -f docker-compose.dev.yml up -d
```

## Módulos siguientes

| Fase | Módulo | Estado |
|---|---|---|
| F2 | Fichaje y jornada | Completado |
| F2 | Turnos y cuadrantes | Modelo y navegación listos |
| F3 | Gastos y nóminas (importación/distribución) | Modelo y navegación listos |
| F4 | Reclutamiento y canal de denuncias | Modelo y navegación listos |
| F5 | Espejo en Google Sheets, multi-centro | Planificado |

## Decisiones y límites conocidos

- **No se calcula la nómina legal española** (IRPF, SS, convenios). Se importan y distribuyen
  nóminas; el cálculo queda fuera del alcance.
- **No hay sincronización multi-sede** en esta versión: una base central y una app por empresa.
- El fichaje es **por sesión web**; el kiosco con PIN/huella y la firma del registro quedan como
  siguiente paso del bloque F2.
- El portal móvil es una **PWA responsive**, no una app nativa.
- El registro está abierto por defecto y la primera cuenta es administración. Si la instalación
  es pública, considera desplegar tras VPN o limitar el registro en el proxy.
- No hay login social (Google/Microsoft): el ciclo email/contraseña está completo y se puede
  añadir un proveedor en better-auth cuando haya credenciales.
- `data/`, `.env` y `backups/` están fuera de git. No subas secretos ni dumps al repositorio.

## Licencia

Uso privado. Añade la licencia que corresponda antes de distribuirlo.
