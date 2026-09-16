# Diseños reproducibles

Exportación real disponible: [`hotel-empty-v1`](hotel-empty-v1/manifest.json), creada y leída mediante MCP oficial el 16-09-2026. Incluye escritorio/móvil en SVG y PNG, tokens y estructura extraídos y estados de aceptación. Propuesta para la demo; no implica aprobación de un rediseño de producto.

Cada tarea visual selecciona un ID inmutable en el campo **Design snapshot** de la issue. El directorio `<id>/` contiene `manifest.json`, tokens, descripción de estados y recursos exportados. El controlador verifica los hashes antes de entregar el diseño al agente.

```json
{
  "schemaVersion": 1,
  "id": "hotel-filters-v1",
  "source": {
    "fileUrl": "https://design.penpot.app/#/workspace/IDENTIFICADOR-REAL",
    "revision": "REVISION-REAL",
    "exportedAt": "2026-09-16T00:00:00Z"
  },
  "files": [
    { "path": "tokens.json", "sha256": "SHA256-DEL-ARCHIVO" },
    { "path": "states.md", "sha256": "SHA256-DEL-ARCHIVO" },
    { "path": "desktop.png", "sha256": "SHA256-DEL-ARCHIVO" }
  ]
}
```

## Preparar el diseño con un agente

1. Abrir el archivo de Penpot y conectar su MCP remoto desde Integrations → MCP Server.
2. Pedir al agente que confirme archivo/página y extraiga componentes, tokens, estados y recursos utilizados. No darle permiso para alterar el diseño cuando solo necesita consultarlo.
3. Exportar los recursos; registrar URL del archivo sin credenciales, revisión y fecha. Nunca guardar la URL MCP con `userToken`.
4. Crear un ID nuevo para cada revisión aprobada, calcular hashes y validar el manifiesto.
5. Revisar la exportación y publicarla por el cauce humano del repositorio; la tarea apunta a ese ID.

Penpot queda como fuente editable. CI recibe una versión congelada para que ejecutar mañana la misma tarea no cambie silenciosamente sus requisitos visuales. El MCP actual necesita una pestaña con el plugin activo; esta exportación evita convertir esa pestaña en un servicio permanente de la fábrica.

Fuente: https://help.penpot.app/mcp/ (consulta 16-09-2026).
