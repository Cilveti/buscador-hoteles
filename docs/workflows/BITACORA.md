# Workflow agéntico local

## Objetivo
Grill-me → spec → research/plan → implementación normal o Ralph → verificación externa → revisión adversarial → QA agéntico de navegador. Reproducible en el buscador, sin depender de GitHub Actions.

## Estado actual
Completado y probado con agentes reales (20/09/2026). Rama `codex/local-agentic-workflows`. Claude y Codex autenticados. Trabajo local.

## Progreso
- CLI normal/Ralph, skills y guía implementados.
- 7 tests del controlador; 191 tests en la suite general. Lint, tipos, suite y navegador verdes: `.tmp/verification/2026-09-20T12-59-50.249Z-4814274c/verification.json`.
- Skills validadas con quick_validate usando uv + PyYAML.
- Ralph: dos subtareas implementadas y verificadas en sesiones distintas. La review encontró que la ayuda desplazaba iconos; el controlador inició la corrección automáticamente.
- QA negativo sobre producto sin la mejora: detectó que Escape no borraba la consulta. Evidencia: `.tmp/local-qa-negative/qa.json`.
- Plan opcional probado: pausa sin editar producto; reanudación explícita registrada por el operador de la prueba, no atribuida a Iñigo.
- Normal completado de extremo a extremo: `2026-09-20T12-59-29-636Z-escape-search-normal`; 191 tests, 9 recorridos de navegador, review sin hallazgos y QA con 3 criterios comprobados.
- Ralph completado: `2026-09-20T13-03-27-877Z-search-keyboard-hint-ralph`; dos subtareas, 191 tests, 10 recorridos de navegador, review sin hallazgos y QA con 4 criterios comprobados. El ensayo anterior `12-50-31` queda fallido por el contrato antiguo de nombres de evidencias, aunque demostró la corrección de un hallazgo real.

## Decisiones
- Aprobación del plan opcional; bloqueo obligatorio ante decisiones pendientes.
- CLI Bun/TypeScript; Claude implementa y Codex revisa/QA, usando autenticación local.
- Cada ejecución trabaja sobre un snapshot Git aislado. Integración posterior fuera del workflow.
- QA interactivo mediante Playwright dirigido por decisiones estructuradas de Codex; capturas, acciones y veredictos por criterio.
- Ralph acotado: contexto nuevo por subtarea/intento, progreso persistente y comprobaciones externas.
- Default sin PostgreSQL: componentes/handlers reales con catálogo sintético. No acredita persistencia/SSR.

## Aprendizajes confirmados
- La skill de proceso también se usa en evaluaciones: se conserva el procedimiento original como modo de trabajador para evitar recursión.
- El QA necesita conservar observaciones previas junto a acciones; sin ellas repite escenarios y puede confundir estados. Se guardan URL, foco, árbol accesible y contador de peticiones, además de capturas.
- El snapshot debe vivir fuera de carpetas ignoradas y usar la ruta canónica del temporal en macOS.

## Errores y correcciones
- JSON Schema draft-2020-12 rechazado por Claude: usar draft-7.
- Alias sonnet heredaba un modelo retirado desde el entorno: ID explícito claude-sonnet-5, sin modificar configuración personal.
- Investigadores confundieron dudas reversibles con bloqueos: el planificador las reconcilia contra la spec; las decisiones pendientes siguen bloqueando.
- El plan devolvió explicaciones donde se esperaban IDs: patrón AC en el contrato y cobertura validada externamente.
- Biome ignoraba worktrees bajo `.tmp`: mover al temporal del sistema; comprobar baseline antes de consumir modelos.
- Enlaces relativos incorrectos por `/var` frente a `/private/var`: canonicalizar con realpath.
- Un veredicto QA añadió comentarios a nombres de capturas: el gate rechazó la entrega. Se reforzó el schema para exigir nombres exactos, sin debilitar la validación. Esa ejecución sigue fallida.

## Entrega
Ambos recorridos completados. Guía en README.md y enlaces auditables en EVIDENCIAS.md. El siguiente paso de Iñigo es abrir el buscador en Claude Code e invocar abordar-tarea; puede elegir normal/Ralph y revisión opcional del plan. Ningún candidato se ha aplicado al checkout original.
