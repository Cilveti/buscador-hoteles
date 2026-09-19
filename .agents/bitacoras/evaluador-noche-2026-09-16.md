# Bitácora — Evaluador nocturno, 16 de septiembre de 2026

## Objetivo y alcance

Estabilizar evaluador, toggles, sandbox y Chrome; ejecutar múltiples tareas Luna high con juez Sol 5.6 high y notas/10, mediante controladores deterministas. Trabajo autorizado hasta 08:00 Europe/Madrid, informe antes 08:30. Skill explícita `/Users/cilveti/.codex/skills/bitacora/SKILL.md`.

Repositorio: `/Users/cilveti/work/master-ia/proyectos/buscador-hoteles`. No se trasladaron soluciones candidatas al producto ni se tocó producción, DB cotidiana, factory/.github o repositorio antiguo.

## Estado final — 08:00 Madrid

- **Terminado.** 47 intentos: 46 entregas evaluadas, 29 pass, 17 fail, 1 error de infraestructura antes del modelo. Cuatro tareas, candidatos Luna high y juez Sol 5.6high.
- Ningún worker nocturno activo. Controlador final completed. Heartbeat `evaluador-nocturno-luna` pausado. **No reanudar campañas ni lanzar modelos sin un nuevo encargo.**
- UI `http://127.0.0.1:3415/` responde 200; pestaña 3 autenticada y marcada entregable. Vista con nota/resultado/estado. No imprimir credencial privada de acceso.
- Texto original de testing restaurado en inglés y castellano: la revisión no demostró beneficio. Ambas versiones y decisión quedan archivadas. Resultados originales y fallos se conservan.

## Artefactos y verificación

- Informe: `.agent-evals/night-summary-20260916/informe.md`; datos `runs.json` y `runs.csv`; captura `laboratorio-final.png`.
- Registro detallado anterior: `.agent-evals/night-summary-20260916/bitacora-detallada.md`. Scripts auxiliares de análisis en `.tmp/night-summary.py` y `.tmp/write-night-report.py`.
- Full verify final verde: `.tmp/verification/2026-09-16T05-41-31.602Z-2e05a8a1/verification.json` (lint, tipos, tests, navegador); `git diff --check` limpio. UI 8/8, incluida autenticación y separación de puertos.
- SDK real all/none con Chrome protegido y preflight privado. Prueba de restauración externa tras desactivar todos los checks verde; detalles y rutas en registro detallado.
- Sonda Chrome revisada: tests de denegación obligatoria y cuatro arranques simultáneos pasan; `.tmp/protected-four-probe.log`.
- Cambios de implementación y estado documentados en skill evaluadora EN/ES. Dossiers privados futuros `dossier-night-v2` de filtros, guardadas y ordenación fuera del checkout; no aplicados retroactivamente.

## Reparaciones y decisiones

1. Separar tests Bun/Playwright; conservar metadatos legítimos de paquetes y restaurar auxiliares de tests/arquitectura al verificar entregas. Correcciones ligadas por hash, sin reescribir originales.
2. Probar Node, Bun, Chrome y checks habilitados con permisos reales antes del candidato. Worktrees/Git/dependencias separados; permisos privados de shell y navegador; no incorporar instrucciones personales.
3. API autenticada con Authorization limitado a origen/puerto, sin cookies compartidas entre puertos. Chrome deniega archivos del controlador/privados/historial y prueba un sentinel por arranque. No es certificación contra exploits o código hostil.
4. Una sonda agotó 5 segundos en la segunda tanda de cuatro. Bloqueó el intento antes de Luna; no hubo evidencia de lectura privada. Se reparó esperando commit hasta 30 s y reintentando una sola vez sólo TimeoutError; sigue exigiendo denegación explícita. El reemplazo y filtros finales pasan; cambio de protocolo/concurrencia registrado.
5. Notas 0–10 por dimensiones y gates separados. Resultado funcional, fallo de formato, falta de ejecución y error de infraestructura no se confunden.
6. Sin promoción automática de una skill por ser más explícita. Original/revisión archivadas en `testing-skill-experiment/` junto al informe; original por defecto.

## Resultados e interpretación

- Matriz principal: 24 entregas, 3 tareas × 4 variantes × 2; sólo V2/V3/V4. Idioma afecta skills, no traducción de la tarea. V1preliminar y V5suplementario se conservan aparte.
- ControlV5b: ordenación9,9/9,7/9,8/9,9pass; filtros9,3/9,2pass; guardadas8,4pass/7,5fail.
- RevisiónV6ycontinuaciones: ordenación10/9,3/9,8/10pass; filtros9,4/9,2pass; guardadas7,2/7,9fail. No prueba causalidad: pocas repeticiones y reparación ambiental intermedia.
- Cuatro simultáneos completaron una tanda con todos los controles verdes. Pico de RSS sumado de 3,98 GiB en máquina de 24 GiB; mínimo 40% de memoria libre según memory_pressure. RSS incluye compartida; no es RAM física exclusiva.
- Equivalente API estimado: 41,01 USD para 46 entregas, más 4,46 USD de rejuicios correctivos recogidos. No factura de suscripción; excluye diagnósticos SDK/Astra.
- Inyectar/leer instrucciones no demuestra cumplirlas. Bugs de recuperación de estado, recarga y capacidad se reprodujeron independientemente con tests propios/generales verdes.
- Aceptación privada de filtros durante runs; confianza de opiniones suplementaria: 8/8 en 8 entregas, tres mutaciones dirigidas detectadas; ordenación: 5 checks privados. No cobertura exhaustiva de UI/móvil ni mutation score completo.
- Sin conclusión sobre legacy/clean o compactaciones: no ejecutados/cobertura parcial, respectivamente. No inferir que quitar skills mejora con dos observaciones.

## Próximos pasos propuestos, no ejecución pendiente

Aceptación privada reutilizable para transiciones de estado; comparar una mejora pequeña del proceso con tareas reservadas; después legacy/clean y compactaciones. Mantener evidencia por tipo de tarea/gravedad para ajustar autonomía; una nota no autoriza merge ni despliegue.
