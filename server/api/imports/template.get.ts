import ExcelJS from 'exceljs'
import { getContext } from '../../utils/hr'
import { isManagerOrAdmin } from '../../utils/session'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
  })
}

export default defineEventHandler(async (event) => {
  const { user } = await getContext(event)

  if (!isManagerOrAdmin(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permisos' })
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RRHH Suite'

  const employees = workbook.addWorksheet('Empleados')
  employees.columns = [
    { header: 'Nombre', key: 'firstName', width: 18 },
    { header: 'Apellidos', key: 'lastName', width: 22 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Departamento', key: 'department', width: 18 },
    { header: 'Puesto', key: 'position', width: 24 },
    { header: 'Fecha alta', key: 'startDate', width: 14 },
    { header: 'Horas/semana', key: 'weeklyHours', width: 14 },
    { header: 'Hora entrada', key: 'scheduleStart', width: 14 },
    { header: 'Hora salida', key: 'scheduleEnd', width: 14 },
    { header: 'PIN', key: 'pin', width: 10 },
    { header: 'Vacaciones disponibles', key: 'available', width: 22 },
  ]
  styleHeader(employees.getRow(1))
  employees.addRow({
    firstName: 'Ana',
    lastName: 'Ejemplo',
    email: 'ana.ejemplo@miempresa.com',
    department: 'Recepción',
    position: 'Recepcionista',
    startDate: '2024-03-01',
    weeklyHours: 37.5,
    scheduleStart: '07:20',
    scheduleEnd: '14:50',
    pin: '2001',
    available: 22,
  })
  employees.addRow({
    firstName: 'Luis',
    lastName: 'Muestra',
    email: 'luis.muestra@miempresa.com',
    department: 'Cocina',
    position: 'Cocinero',
    startDate: '2022-09-15',
    weeklyHours: 37.5,
    scheduleStart: '07:20',
    scheduleEnd: '14:50',
    pin: '2002',
    available: 26,
  })

  const holidays = workbook.addWorksheet('Festivos')
  holidays.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Nombre', key: 'name', width: 30 },
    { header: 'Ámbito', key: 'scope', width: 16 },
  ]
  styleHeader(holidays.getRow(1))
  holidays.addRow({ date: '2026-01-01', name: 'Año Nuevo', scope: 'nacional' })
  holidays.addRow({ date: '2026-12-25', name: 'Navidad', scope: 'nacional' })

  const instructions = workbook.addWorksheet('Instrucciones')
  instructions.getColumn(1).width = 110
  instructions.addRow(['Cómo importar'])
  instructions.getRow(1).font = { bold: true, size: 14 }
  instructions.addRow(['1. Rellena la hoja Empleados. El email identifica al empleado: si ya existe, se actualiza.'])
  instructions.addRow(['2. Las fechas usan el formato AAAA-MM-DD (por ejemplo 2026-03-01).'])
  instructions.addRow(['3. "Vacaciones disponibles" es el saldo inicial del año en curso; déjalo vacío para calcularlo automáticamente.'])
  instructions.addRow(['4. "Hora entrada" y "Hora salida" definen el horario contractual del empleado (HH:mm). Si se dejan vacías, se usa el horario por defecto de Ajustes.'])
  instructions.addRow(['5. La hoja Festivos añade días no laborables al calendario de la empresa.'])
  instructions.addRow(['6. Guarda el archivo y súbelo en RRHH → Importar.'])
  instructions.addRow([])
  instructions.addRow(['Nota: los departamentos que no existan se crean automáticamente.'])

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rrrh-plantilla-importacion.xlsx"',
    },
  })
})
