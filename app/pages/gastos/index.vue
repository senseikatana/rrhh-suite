<template>
  <ModulePlaceholder
    title="Gastos"
    phase="F3"
    description="Notas de gasto con foto del ticket, validación y reembolso."
    :features="[
      'Alta de gasto con foto o reenvío de recibo por email',
      'Estados: borrador, enviado, en validación, aprobado, reembolsado',
      'Imputación analítica a departamento, marca o evento',
      'Reembolso por nómina o transferencia',
      'Exportación contable en Excel',
    ]"
  />
</template>
