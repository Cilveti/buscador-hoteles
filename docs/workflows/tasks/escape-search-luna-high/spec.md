# Borrar la búsqueda con Escape

Encargo de Iñigo: recorrer la simulación completa con Luna 5.6 en high y medir su duración. La tarea funcional ya está acordada; no quedan decisiones que requieran otra entrevista.

## Aceptación

- **AC1:** con Málaga aplicada y el campo enfocado, Escape vacía el campo y quita `q` de la URL; aparecen los resultados de los filtros restantes. Como el botón de borrado existente, vuelve a página 1.
- **AC2:** conserva España, orden por valoración y foco en el campo.
- **AC3:** con el campo vacío, Escape no modifica resultados, URL, foco o página ni inicia otra consulta.

Sin cambios de diseño, administración, dependencias o configuración del producto.

## Ejecución

Modo normal, sin pausa opcional del plan. Todos los trabajadores usan `gpt-5.6-luna` con `reasoningEffort: high`. El agente padre prepara la especificación y supervisa; el controlador mide el recorrido automático desde la spec.

```sh
bun run workflow start --spec docs/workflows/tasks/escape-search-luna-high/spec.json --agents docs/workflows/tasks/escape-search-luna-high/agents.json --mode normal
```

El candidato se genera en una copia aislada. La app del QA usa React, handlers HTTP y core reales con tres hoteles sintéticos, sin PostgreSQL ni SSR.
