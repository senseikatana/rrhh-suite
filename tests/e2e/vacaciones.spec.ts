import { expect, test, type Page } from '@playwright/test'

async function goto(page: Page, path: string) {
  await page.goto(path)
  await page.locator('html[data-hydrated="true"]').waitFor()
}

async function login(page: Page, email: string, password: string) {
  await goto(page, '/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
}

test('un empleado solicita vacaciones y las ve en su lista', async ({ page }) => {
  await login(page, 'empleado@hotelmarina.test', 'Empleado1234!')

  await expect(page.getByRole('heading', { name: /Hola, Nuria/ })).toBeVisible()

  await goto(page, '/vacaciones')
  await expect(page.getByRole('heading', { name: 'Vacaciones y ausencias' })).toBeVisible()

  const start = new Date()
  start.setDate(start.getDate() + 60)
  const end = new Date(start)
  end.setDate(end.getDate() + 4)

  const iso = (date: Date) => date.toISOString().slice(0, 10)

  await page.locator('input[type="date"]').first().fill(iso(start))
  await page.locator('input[type="date"]').nth(1).fill(iso(end))
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()

  await expect(page.getByText('Solicitud enviada', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible()
})

test('un mando aprueba una solicitud pendiente', async ({ page }) => {
  await login(page, 'manager@hotelmarina.test', 'Manager1234!')

  await goto(page, '/vacaciones/aprobaciones')
  await expect(page.getByRole('heading', { name: 'Aprobaciones' })).toBeVisible()

  const approve = page.getByRole('button', { name: 'Aprobar' }).first()

  if (await approve.count()) {
    await approve.click()
    await expect(page.getByText('Solicitud aprobada', { exact: true })).toBeVisible()
  }
})

test('el calendario anual muestra la rejilla de empleados y meses', async ({ page }) => {
  await login(page, 'manager@hotelmarina.test', 'Manager1234!')

  await goto(page, '/vacaciones/calendario')
  await expect(page.getByRole('heading', { name: 'Calendario anual' })).toBeVisible()
  await expect(page.getByText('Empleado').first()).toBeVisible()
  await expect(page.getByText('Total').first()).toBeVisible()
})

test('la plantilla Excel se descarga', async ({ page }) => {
  await login(page, 'admin@hotelmarina.test', 'Admin1234!')

  await goto(page, '/empleados')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Plantilla Excel' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toContain('.xlsx')
})

test('la administración ve y guarda los ajustes', async ({ page }) => {
  await login(page, 'admin@hotelmarina.test', 'Admin1234!')

  await goto(page, '/ajustes')
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()
  await expect(page.getByText('Devengo de vacaciones')).toBeVisible()

  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Configuración guardada')).toBeVisible()
})

test('un usuario nuevo puede registrarse', async ({ page }) => {
  await goto(page, '/signup')

  const email = `nuevo.${Date.now()}@hotelmarina.test`

  await page.getByLabel('Nombre').fill('Nuevo Usuario')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByLabel('Repite la contraseña').fill('Password123!')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /Hola, Nuevo Usuario/ })).toBeVisible()
  await expect(page.getByText('Tu usuario no tiene ficha de empleado')).toBeVisible()
})

test('la recuperación de contraseña responde con un mensaje genérico', async ({ page }) => {
  await goto(page, '/forgot-password')

  await page.getByLabel('Email').fill('empleado@hotelmarina.test')
  await page.getByRole('button', { name: 'Enviar enlace' }).click()

  await expect(page.getByText('Revisa tu correo')).toBeVisible()
})

test('la cuenta muestra perfil, contraseña y sesiones', async ({ page }) => {
  await login(page, 'empleado@hotelmarina.test', 'Empleado1234!')

  await goto(page, '/cuenta')
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sesiones abiertas' })).toBeVisible()
})

test('un empleado ficha la entrada y la salida', async ({ page }) => {
  await login(page, 'empleado@hotelmarina.test', 'Empleado1234!')

  await goto(page, '/fichaje')
  await expect(page.getByRole('heading', { name: 'Fichaje y jornada' })).toBeVisible()
  await expect(page.getByText(/Horario contractual 07:20–14:50/)).toBeVisible()
  await expect(page.getByText('Fuera').first()).toBeVisible()

  await page.getByRole('button', { name: 'Fichar entrada' }).click()
  await expect(page.getByText('Entrada registrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Trabajando').first()).toBeVisible()

  await page.getByRole('button', { name: 'Fichar salida' }).click()
  await expect(page.getByText('Salida registrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Fuera').first()).toBeVisible()
})

test('un mando ve el equipo, corrige un fichaje y exporta el registro', async ({ page }) => {
  await login(page, 'manager@hotelmarina.test', 'Manager1234!')

  await goto(page, '/fichaje')
  await expect(page.getByRole('heading', { name: 'Equipo ahora' })).toBeVisible()
  await expect(page.getByText('Corregir').first()).toBeVisible()

  await page.getByRole('button', { name: 'Corregir' }).first().click()
  await expect(page.getByRole('button', { name: 'Guardar corrección' })).toBeVisible()

  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`

  await page.locator('input[type="date"]').fill(localDate)
  await page.locator('input[type="time"]').fill('00:00')
  await page.getByRole('button', { name: 'Guardar corrección' }).click()

  await expect(page.getByText('Fichaje corregido', { exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar registro' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toContain('.xlsx')
})
