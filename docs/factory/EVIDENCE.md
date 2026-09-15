# Evidencia y estado de implantación

Última actualización: 16-09-2026. **La fábrica completa aún no ha superado el ensayo con modelos e integraciones externas.**

## Baseline local

- Aplicación congelada: `67e61d3a73b94dd8eeb2dadc7d6207d736cf0e5e`.
- Checkout desechable y tres contenedores nuevos, sin red durante ejecución de código.
- Unitarios, lint y tipos: pasan.
- E2E real de Next/Payload/PostgreSQL: 10 pasan, 21,2 segundos. Incluye búsqueda, filtros, móvil, detalle, autenticación y persistencia administrativa.
- Build: pasa tras corregir la ruta de Next para el monorepo Bun.
- Instalación: 32 segundos con caché fría; 25 con caché caliente. Ambas medidas son Docker local sobre macOS/ARM, no GitHub/Linux x64 ni un benchmark general.
- Primera baseline: PostgreSQL 16.15. Corrección posterior: imagen con PostgreSQL 17.11, igual que compose local, servidor y cliente fijados a `17.11-1.pgdg24.04+2`. Los 10 E2E pasan localmente en 20,5 s con esta versión; su baseline remota también pasa.

## GitHub

- Infraestructura inicial: commit `a1280ab`.
- [Primera baseline sin modelo](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030226539): falló antes de los tests: Bun no podía escribir en el volumen Linux (`tempdir: EACCES`). Se corrige ejecutando la instalación con el UID/GID del propietario y caché explícita. No hubo consumo de modelos.
- [Baseline corregida](https://github.com/Cilveti/buscador-hoteles/actions/runs/35030817082), commit `8d5ff06`: **verde**, 64 tests / 302 aserciones, 10 E2E reales y build. Instalación fría 15 s; job total 308 s (6 minutos redondeados). Logs, trazas y reportes en el artefacto del run.
- [Baseline con caché](https://github.com/Cilveti/buscador-hoteles/actions/runs/35031262510), `509c349`: **verde**, 295 s totales. Instalación 8 s y restauración de caché ~10 s (243 MB). La primera instalación fría tardó 15 s; son dos observaciones, no un benchmark repetido ni una mejora neta de 7 s garantizada.
- [Baseline PostgreSQL 17.11](https://github.com/Cilveti/buscador-hoteles/actions/runs/35031693837), `2b1749d`: **verde**, 289 s totales. Misma versión de servidor que compose local.
- Etiquetas de configuración y rama `factory-state` creadas por el instalador.
- Creación de PR desde Actions desactivada; conexión del modelo y Sonar pendientes de autorización/configuración.
- Penpot: contrato de exportación y validación por hashes implementados; consulta/exportación real pendiente.

## Controles probados localmente

- Presupuesto máximo de tres intentos; no se reinicia por aprobación.
- Eventos duplicados, aprobación repetida o de actor no autorizado y respuesta tardía tras cancelar.
- Validación de parches Git reales: rutas protegidas, manifiestos y symlinks.
- Claves y URLs de diseño: rechazo de exportaciones alteradas y URLs que contienen credenciales.
- 15 tests del arnés / 51 aserciones verdes localmente. Incluyen comprobación externa del índice y rechazo de modificaciones o archivos inesperados tras verificar. Contratos TypeScript y YAML validados. Estas pruebas son deterministas, no ejecuciones de modelos.

## Pendiente para acreditar el objetivo

Conexión real del modelo, Sonar y Penpot; tarea que termina en draft con todos los gates; corrección por feedback; pausa y reanudación humana; cancelación remota; ensayo limpio del instalador y comparación de una mejora del arnés.
