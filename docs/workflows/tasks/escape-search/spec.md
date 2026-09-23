# Borrar la búsqueda con Escape

Issue: [Cilveti/buscador-hoteles#15](https://github.com/Cilveti/buscador-hoteles/issues/15). Actualizada el 2026-09-20T18:56:27Z (consulta de `gh issue view`).

## Decisiones confirmadas

- Escape, con el campo enfocado, vacía el texto y quita la búsqueda aplicada, igual que el botón Borrar texto de búsqueda. Conserva país, marca, valoración mínima y orden; el foco permanece en el campo. Al borrar una consulta activa se vuelve a la página 1.
- Si el texto escrito es distinto al aplicado y todavía no se ha pulsado Buscar, Escape también borra la consulta aplicada; no restaura el texto anterior.
- Con el campo ya vacío, Escape no cambia estado ni dispara otra petición. Solo actúa dentro del campo. Sin cambios de diseño, administración, dependencias ni arnés.

## Aceptación

Criterios Dado/Cuando/Entonces en `spec.json`. La URL `/?q=M%C3%A1laga&country=Spain&sort=rating` prepara el estado; hay que pulsar Escape y observar campo, URL, foco, resultados y peticiones.

## Ejecución

Modo normal, sin pausa del plan. Trabajadores con Codex Luna high:

```sh
bun run workflow start --spec docs/workflows/tasks/escape-search/spec.json --agents docs/workflows/tasks/escape-search-luna-high/agents.json --mode normal
```

El candidato queda aislado. La app del QA usa React, handlers HTTP y core reales con catálogo sintético, sin PostgreSQL ni SSR.
