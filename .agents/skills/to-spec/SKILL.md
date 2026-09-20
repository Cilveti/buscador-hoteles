---
name: to-spec
description: Convierte requisitos ya refinados en el contrato ejecutable del workflow local del buscador, conservando decisiones pendientes y aceptación observable.
---

# To-spec

Parte de la conversación y del código observado, no de supuestos sobre lo que suele querer un usuario. Guarda `docs/workflows/tasks/<id>/spec.json` y un `spec.md` corto con la misma intención. Usa el ejemplo [Escape en búsqueda](../../../docs/workflows/examples/escape-search.json) y el schema real en `scripts/local-workflow/contracts.ts`.

El contrato contiene `id`, `title`, `objective`, `scope`, `outOfScope`, `acceptance` (IDs únicos AC1, AC2… y `criterion`) y `decisions`. Cada criterio describe una situación inicial, acción y resultado observable. Añade un caso límite o recuperación pertinente; no redactes una lista de archivos como sustituto de la intención.

Las decisiones que todavía requieren al usuario van en `decisions`: el controlador no empieza mientras existan. No uses el plan como especificación: el workflow investiga y decide la implementación. En tareas de interfaz indica comportamiento de teclado/foco si importa; en cambios visuales conserva una referencia de diseño accesible y explícita.

Valida el contrato antes de consumir modelos:

```sh
bun -e 'import {specSchema} from "./scripts/local-workflow/contracts"; console.log(specSchema.parse(await Bun.file(process.argv[1]).json()))' docs/workflows/tasks/<id>/spec.json
```

No implica publicar una issue, instalar dependencias ni dar permisos de integración. Vuelve a [abordar-tarea](../abordar-tarea/SKILL.md) para ejecutar si está encargado.
