---
name: to-spec
description: Convierte una tarea refinada en una especificación verificable del workflow local; guarda el acuerdo en la issue y añade ready solo tras confirmación. No ejecuta si el encargo es solo especificar.
---

# To-spec

Entra después de la confirmación explícita de `abordar-tarea`. Usa la [plantilla](../../../docs/workflows/spec-template.md) para `docs/workflows/tasks/<id>/spec.md` y el [ejemplo ejecutable](../../../docs/workflows/examples/escape-search.json) para `spec.json`. La conversación y el código observado son la fuente; no inventes decisiones para rellenar secciones. Una tarea pequeña admite una especificación breve.

## Contrato que reciben los trabajadores

El schema de `scripts/local-workflow/contracts.ts` es la autoridad. Nuevas tareas usan `version: 2`. Conserva el mismo contenido relevante en Markdown y JSON: el workflow entrega el JSON completo a todos los roles, no solo el objetivo.

| Sección | Campo JSON |
|---|---|
| Contexto y problema | `context` |
| Objetivo y goals | `objective`, `goals` |
| Alcance y comportamiento | `scope` |
| Non-goals | `outOfScope` |
| Decisiones ya acordadas | `agreedDecisions` |
| Restricciones | `constraints` |
| Riesgos e impacto | `risks` (el alcance recoge superficies afectadas) |
| Entorno, comprobaciones y límites | `verification.environment`, `checks`, `limitations` |
| Preguntas bloqueantes | `decisions` (vacío para `ready`) |
| Issue consultada | `issue.url`, `issue.updatedAt` (omitir para petición local) |

Cada entrada de `acceptance` tiene `id` único AC1, AC2…, `criterion` (regla observable) y `scenario`: `kind` (`normal`, `edge` o `recovery`), `given`, `when`, `then`. **Un caso por AC**, para que cada uno reciba resultado y evidencia propios. Si una regla tiene varios casos independientes, repítela en diferentes AC; no escondas varios escenarios detrás de un único pass. Incluye caso normal y límites/recuperación relevantes, sin añadir pruebas de relleno.

La URL inicial solo prepara el escenario: para UI, el QA debe confirmar ese estado y ejecutar la interacción. Comprueba que los datos y entorno permiten reproducirlo: el QA ligero tiene tres hoteles, no los 180 de `bun dev`, ni Payload/PostgreSQL/SSR. Si un caso exige capacidades ausentes, resuelve el entorno con el usuario o deja un bloqueo; no rebajes el criterio. Los casos son el mínimo: review/QA también buscan errores pertinentes a la tarea fuera de los ejemplos, sin inventar requisitos.

No conviertas el plan técnico en especificación: el workflow investiga y planifica después. Conserva decisiones técnicas ya acordadas y sus motivos; deja al planificador los detalles reversibles. En tareas de UI precisa teclado/foco cuando importe y conserva referencias de diseño si existen.

Valida antes de publicar o consumir modelos:

```sh
bun run workflow validate --spec docs/workflows/tasks/<id>/spec.json
```

Comprueba además que Markdown y JSON expresan lo mismo y no quedan placeholders. La validación estructural no demuestra el acuerdo humano, la calidad de los requisitos ni que el entorno los pueda probar. Los specs históricos sin versión siguen funcionando, pero no sirven como formato de una nueva tarea `ready`.

## Guardar el acuerdo en GitHub

Solo después de la confirmación que autoriza guardar/etiquetar:

1. Vuelve a leer la issue y comentarios con `gh`. Si ha cambiado desde la consulta usada para acordarla, reconcilia los cambios antes de publicar. Si está cerrada, no la reabras ni la marques preparada sin aclararlo.
2. Publica **el contenido completo de `spec.md` en un comentario**, no solo una ruta local. Preserva la descripción original por defecto. Incluye las decisiones confirmadas y la relación con `spec.json`; no incluyas tokens de acceso al visor, secretos ni evidencia privada del juez. Si prefieren la descripción, conserva el contexto previo al actualizarla.
3. Verifica con `gh issue view` que el comentario quedó publicado, guarda su URL en la entrega, y después añade la etiqueta exacta `ready`. Nunca `factory:ready`: es un disparador distinto. Si falla la publicación, no etiquetes; si falla la etiqueta, informa del estado parcial, sin fingir que la tarea está lista.

Desde este repositorio, sustituyendo la URL y la ruta por valores comprobados:

```sh
gh issue comment 'URL_ISSUE' --body-file docs/workflows/tasks/<id>/spec.md
gh issue view 'URL_ISSUE' --json body,comments,labels,updatedAt
gh issue edit 'URL_ISSUE' --add-label ready
gh issue view 'URL_ISSUE' --json labels,url
```

No crear una issue nueva si no se ha pedido. Para una petición local basta con los archivos, sin etiqueta. Si después se encargan cambios de alcance en una issue `ready`, retira `ready`, revisa el acuerdo y vuelve a validar/publicar/etiquetar; conserva la versión anterior y señala qué comentario la sustituye. Un run empezado conserva su spec: cambiar el acuerdo requiere una ejecución nueva, nunca modificar el contrato a mitad.

`ready` no inicia modelos, no acredita implementación y no autoriza merge ni despliegue. Si el encargo era solo especificar, entrega el enlace y detente. Vuelve a [abordar-tarea](../abordar-tarea/SKILL.md) para ejecutar únicamente si también se confirmó ese paso.
