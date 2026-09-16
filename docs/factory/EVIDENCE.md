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
- PR desde Actions habilitadas y `OPENCODE_API_KEY` configurada tras autorización explícita. Conexión OpenCode comprobada con el ensayo real #1. Sonar seleccionado únicamente para este repo; instalación pendiente de la confirmación de identidad (sudo/passkey) de GitHub y configuración de proyecto/token.
- Penpot: conexión MCP, lectura/escritura y exportación reales comprobadas. [Snapshot `hotel-empty-v1`](../../factory/designs/hotel-empty-v1/manifest.json), dos tableros y nueve tokens; PNG inspeccionados y SVG XML válido. [Reproducción](PENPOT.md).

- [Baseline de integridad del candidato](https://github.com/Cilveti/buscador-hoteles/actions/runs/35032213155), `d0721fd`: **verde**, 293 s totales.

## Resolución de dependencias

Prueba local real con Docker y registro npm: una copia desechable de los manifiestos añade `is-number@7.0.0`; el resolver conserva los manifiestos, ignora un postinstall que fallaría y mantiene estable el lock al repetir. No se ejecutó el modelo. La [baseline con resolver](https://github.com/Cilveti/buscador-hoteles/actions/runs/35032865550), commit `a2afa28`, terminó **verde**: resolver 11 s, job completo 313 s, con las comprobaciones de aplicación, navegador y build. No se ejecutó ningún modelo.

## Controles probados localmente

- Presupuesto máximo de tres intentos; no se reinicia por aprobación.
- Eventos duplicados, aprobación repetida o de actor no autorizado y respuesta tardía tras cancelar.
- Validación de parches Git reales: rutas protegidas, manifiestos y symlinks.
- Claves y URLs de diseño: rechazo de exportaciones alteradas y URLs que contienen credenciales.
- 15 tests del arnés / 51 aserciones verdes localmente. Incluyen comprobación externa del índice y rechazo de modificaciones o archivos inesperados tras verificar. Contratos TypeScript y YAML validados. Estas pruebas son deterministas, no ejecuciones de modelos.

## Pendiente para acreditar el objetivo

Sonar conectado y analizado; tarea que termina en draft con todos los gates; corrección por feedback; decisión y reanudación humanas; instalación completa en otro destino y comparación de una mejora del arnés. La pausa, cancelación por operador, Penpot y arranque desde clone limpio ya tienen evidencia; no equivalen al objetivo completo.

## Primer ensayo con modelo y pausa · 16-09-2026

[Issue #1](https://github.com/Cilveti/buscador-hoteles/issues/1) → [run 35068794419](https://github.com/Cilveti/buscador-hoteles/actions/runs/35068794419): run verde y estado **waiting-human**, intento 1/3 con `opencode-go/glm-5.3-flash`. Sin cambios de código, sin verificación de candidato y sin PR, porque el modelo pidió permiso antes de editar dependencias.

El agente detectó además un error de la tarea de ensayo: situaba la biblioteca en el core, cuya regla externa prohíbe imports ajenos. Conceder permiso de dependencias no resuelve esa incompatibilidad. El operador automatizado canceló #1 mediante el comando de control; [run de cancelación 35069157210](https://github.com/Cilveti/buscador-hoteles/actions/runs/35069157210) verde. Esta cancelación ejercita el evento autenticado y estado remoto; **no se presenta como una decisión humana real**. El ensayo corregido usa el adaptador web en #2.

[Medición del primer run](evidence/hitl-request-35068794419.json): 194 s de runners sumados; 5 minutos redondeados (admisión 9 s, generación 139 s, cierre 46 s). La espera humana sucede tras finalizar los jobs y no mantiene un runner ocupado. Tokens y factura desconocidos. La clave del modelo no aparece en el log completo descargado y contrastado sin imprimir su valor.

## Clone limpio

Clone nuevo desde GitHub en `/tmp/hoteles-factory-replay-20260916`, commit `4cbef21`: `bun test factory` pasa 15 tests / 51 aserciones sin copiar cambios locales; `bun factory/setup.ts` confirma identidad, PR habilitadas y secreto de modelo. El checkout queda limpio. Esta prueba valida arranque/contratos; no demuestra todavía instalar las integraciones en otra cuenta ni completa el E2E de producto.

## Corrección de integración del diseño

[Baseline 35068777827](https://github.com/Cilveti/buscador-hoteles/actions/runs/35068777827), sobre `3b378d3`, detecta errores de lint en los SVG crudos de Penpot; E2E y build pasan. Se separan las referencias SVG del código mediante una configuración limitada a `factory/designs/`. No se cambia el SVG congelado ni su hash ni se excluye código de aplicación.

La revisión descubre además que la política admitía `apps/web/src/biome.json`: una configuración anidada podía desactivar lint. Corregido en la política externa y en los permisos de edición. Prueba con índices Git reales: Biome, tsconfig y ESLint anidados se rechazan en ambos perfiles, mientras los JSON de datos siguen admitidos. Suite local actual: **16 tests / 60 aserciones**, tipos y lint del arnés verdes.

El ensayo #2 se cancela por el operador antes de una aprobación: su base congelada contiene el error de integración SVG. No reescribir esa base para hacer pasar el ensayo ni presentar la cancelación como decisión humana. Una nueva tarea debe partir de la baseline corregida.

[Propuesta de mejora generada desde el historial real #1](https://github.com/Cilveti/buscador-hoteles/issues/4): permanece como propuesta sin ejecución automática; comparación con casos congelados y aprobación humana aún pendientes.
