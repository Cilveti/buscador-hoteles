# Penpot → especificación reproducible

## Integración comprobada el 16-09-2026

[Archivo de la demo](https://design.penpot.app/#/workspace?team-id=d8ac01df-6646-81d2-8008-a5887a33b3fe&file-id=d8ac01df-6646-81d2-8008-a5899521b02a&page-id=d8ac01df-6646-81d2-8008-a5899521b02b). Página «Sin resultados · especificación v1», versión guardada «hotel-empty-v1 · referencia fábrica».

Se ha conectado el MCP oficial, leído el archivo, creado dos tableros y nueve tokens y exportado SVG/PNG, tokens y geometría. Las dos imágenes se han inspeccionado visualmente: escritorio y móvil sin texto cortado. El manifiesto y todos sus hashes pasan `readDesign`. La integración de estas entradas con un candidato real está pendiente de E2E.

## Repetir con cualquier agente compatible con MCP

1. Iniciar sesión en Penpot y crear un archivo vacío para la demo.
2. Arrancar el servidor oficial local con `npx --yes @penpot/mcp@2.15.4`. Mantenerlo abierto durante la preparación. Esa versión era `stable` y `latest` al verificar; la app alojada usa 2.18.0 y muestra un aviso de versiones distintas. Lectura, creación, tokens, versión guardada y exportación funcionan en el ensayo; no se ha demostrado compatibilidad de todas las funciones.
3. En Penpot → Extensiones, instalar `http://localhost:4400/manifest.json`, abrir el plugin oficial y conectar. Chrome puede pedir acceso a servicios locales. El plugin solicita permisos de escritura y comentarios; esta demo usa solamente contenido y recursos, nunca publica comentarios.
4. Conectar el cliente MCP a `http://localhost:4401/mcp`. Para evitar una clave nueva, esta demo utiliza el servidor local. El MCP remoto de Penpot también sirve, pero requiere generar y guardar su clave personal; no guardarla en Git.
5. Verificar mediante una llamada de lectura el nombre/ID del archivo y que la página esté vacía. Leer `high_level_overview` y la documentación de API que corresponda. Ejecutar el bloque JavaScript de `factory/penpot/create-demo.md` usando `execute_code` en ese archivo.
6. Exportar PNG con `export_shape` y SVG con `penpot.generateMarkup([board], {type: "svg"})` mediante `execute_code`. En esta combinación de versiones, `export_shape` anunció éxito para SVG pero guardó dos bytes inválidos; se detectó y sustituyó por SVG generado y validado como XML. No basta el mensaje de éxito de la herramienta. Extraer `penpot.library.local.tokens.sets` y la estructura/estilos del archivo real. Guardar una versión con nombre y registrar su etiqueta, URL y fecha en un nuevo manifiesto. Revisar imágenes y hashes.
7. Copiar el snapshot al repo por el cauce humano y usar su ID en **Design snapshot** de la issue, con `factory:visual`. Los candidatos reciben solo esos archivos verificados bajo `context/design/`.
8. Desconectar el plugin y detener el servidor local al terminar. La fábrica conserva el snapshot y ya no depende del navegador ni del MCP.

## Qué garantiza

La exportación fija los requisitos que recibió cada intento. El worker y el revisor pueden leer texto, tokens y SVG incluso sin visión. Las capturas son evidencia visual. Los checks funcionales no prueban por sí solos la fidelidad visual: requiere inspección o un oráculo visual específico.

[Documentación oficial de Penpot MCP](https://help.penpot.app/mcp/).
