# Simulación local: borrar la búsqueda con Escape

## Primero, ver el punto de partida

Abre http://127.0.0.1:3182/. Es la interfaz del buscador con tres hoteles sintéticos, sin PostgreSQL ni administración. Busca «Málaga» y, con el campo enfocado, pulsa Escape: actualmente la búsqueda permanece. La mejora será poder borrarla con esa tecla.

## Tu petición al agente

> Usa abordar-tarea. Quiero que pulsar Escape dentro del campo de búsqueda borre la búsqueda y actualice los resultados, conservando los filtros, la ordenación y el foco. Si el campo está vacío, no debe hacer nada. Prepara la especificación y ejecuta el workflow normal. Al acabar, abre la app del candidato y enséñame la revisión y las capturas de QA.

Si quieres ver la pausa humana, añade: «Quiero revisar el plan antes de implementar». Es opcional.

## Cómo comprobar el resultado

1. Selecciona España, ordena por valoración y busca Málaga.
2. Pulsa Escape dentro del campo: se vacía y vuelven los hoteles de España, manteniendo orden y foco.
3. Pulsa Escape otra vez: nada cambia ni se lanza otra consulta.

El cambio reutiliza el comportamiento del botón de borrado existente. No requiere nuevos controles, textos, dependencias ni cambios de base de datos.

## Qué irás viendo

1. Petición → aclaraciones necesarias → especificación.
2. Exploración y plan → pausa solo si has pedido revisarlo.
3. Implementación → checks → revisión → QA con navegador.
4. Resultado y capturas en la copia aislada. La página inicial sigue mostrando el punto de partida hasta que se integre el cambio.

La spec de ejemplo ya disponible es `docs/workflows/examples/escape-search.json`. La petición anterior permite recorrer el proceso desde la conversación. La tarea está preparada para que tú inicies la simulación.

## Volver a arrancar esta vista

Desde la raíz del buscador:

```sh
TEST_BROWSER_PORT=3182 TEST_BROWSER_OUTPUT=.tmp/simulacion-local bun tests/browser/server.ts
```

Este servidor compila al arrancar; no tiene recarga automática de código. El workflow abre su propia app del candidato en otro puerto.
