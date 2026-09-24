# Especificación: título de la tarea

<!-- Completar tras aclarar la tarea con el usuario. Eliminar estas indicaciones al publicar.
No hay una extensión mínima: una tarea pequeña merece una spec pequeña.
Usar «No aplica» con motivo donde corresponda; no inventar riesgos o decisiones para rellenar.
No marcar ready mientras queden decisiones que cambien la aceptación.
-->

## Contexto y problema

<!-- Situación actual, a quién afecta y por qué hace falta el cambio. -->

## Objetivo

<!-- Resultado observable que se quiere conseguir, no una lista de archivos. -->

## Goals: qué debe conseguir

- <!-- Resultado concreto. -->

## Non-goals: qué queda fuera

- <!-- Exclusión explícita para evitar ampliar la tarea. -->

## Alcance y comportamiento

<!-- Qué se añade, cambia o elimina; pantallas, contratos o flujos afectados.
Qué comportamiento existente debe conservarse. -->

## Decisiones acordadas y restricciones

<!-- Decisiones de producto confirmadas y su motivo. Restricciones de compatibilidad,
datos, accesibilidad, permisos o rendimiento relevantes. No imponer un diseño técnico
que el planificador pueda decidir; si es imprescindible, explicar por qué y la alternativa descartada. -->

## Criterios y casos de aceptación

<!-- Cada AC es un caso verificable con resultado propio. Repetir el bloque para
cada caso normal, límite o recuperación relevante, con IDs AC1, AC2... únicos.
Si una regla tiene varios escenarios independientes, dar un AC distinto a cada uno:
el QA actual informa por AC, no por subescenarios ocultos dentro del mismo criterio.
-->

### AC1 — Nombre del caso

- **Criterio:** regla observable que debe cumplirse.
- **Tipo:** normal / límite / recuperación.
- **Dado:** estado inicial y datos necesarios; URL de preparación si procede.
- **Cuando:** acción concreta del usuario o del sistema.
- **Entonces:** resultado observable, incluidos los efectos que no deben ocurrir.

## Verificación

- **Entorno y datos:** <!-- Dónde se comprobará y qué datos permiten reproducir todos los casos. -->
- **Comprobaciones y evidencia:** <!-- Tests, recorrido en navegador, petición/respuesta, capturas… por AC. -->
- **Límites:** <!-- Qué no acredita ese entorno. Si impide comprobar un AC, resolver antes de ready. -->

## Riesgos e impacto

<!-- Riesgos concretos, compatibilidad, dependencias o migración. Indicar «No se prevén»
si se ha comprobado; no afirmar que no hay riesgos por no haberlos investigado.
Añadir despliegue/reversión solo cuando el cambio lo necesite. -->

## Decisiones pendientes

<!-- Preguntas aún abiertas. Para ready: «Ninguna». -->

## Acuerdo y trazabilidad

- **Issue:** <!-- URL y fecha de actualización consultada, o «Petición local». -->
- **Confirmación:** <!-- Qué acordó el usuario en la conversación y cuándo. No inventar aprobación. -->
- **Archivos:** <!-- docs/workflows/tasks/<id>/spec.md y spec.json. -->

<!-- ready significa «acordada y comprobable», no implementada ni aprobada por QA.
Esta etiqueta no lanza Actions y no sustituye la autorización para ejecutar el workflow.
Los casos son el mínimo de aceptación: review/QA también buscan errores pertinentes
fuera de esta lista, sin ampliar los requisitos del producto.
-->
