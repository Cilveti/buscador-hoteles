# Elegir cuántos hoteles mostrar por página

Issue: [Cilveti/buscador-hoteles#18](https://github.com/Cilveti/buscador-hoteles/issues/18). Actualizada el 2026-09-23T11:15:48Z (consulta de `gh issue view`).

## Decisiones confirmadas

- Desplegable «Hoteles por página», junto a «Ordenar por», con 12 y 24. El máximo de la búsqueda sigue en 24.
- La elección va en el parámetro `pageSize` de la URL de esa búsqueda. No se recuerda en el navegador.
- Al cambiar el tamaño se vuelve a la página 1 y se conservan búsqueda, filtros y orden.

## Aceptación

Criterios Dado/Cuando/Entonces en `spec.json`. El catálogo del QA tiene tres hoteles sintéticos, así que 12 y 24 muestran el mismo listado; lo observable es el control, la URL, la petición y el regreso desde una página vacía. `/?country=Spain&sort=rating&page=2` prepara esa página vacía. `/?pageSize=24` prepara el tamaño 24.

## Ejecución

Modo normal, sin pausa del plan. Trabajadores con la configuración por defecto de `workflow.agents.json` (Codex, modelo predeterminado del CLI):

```sh
bun run workflow start --spec docs/workflows/tasks/page-size/spec.json --mode normal
```

El candidato queda aislado. La app del QA usa React, handlers HTTP y core reales con catálogo sintético, sin PostgreSQL ni SSR.
