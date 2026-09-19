# E2E con Playwright

Usa navegador cuando la propiedad dependa de la experiencia real: interacción, navegación, permisos visibles, estado o recuperación. El test cuenta una tarea del usuario y comprueba su resultado; no replica cada combinación ya protegida en el dominio.

## Alcance y oráculo

- Mantén recorridos representativos con frontend y backend propios reales cuando quieras verificar su unión. Intercepta proveedores externos o respuestas no deterministas cuando haga falta controlar el escenario.
- Si interceptas la API propia para provocar un error o simular IA, declara que esa prueba verifica el comportamiento del navegador con una respuesta controlada. No demuestra que el backend produzca esa respuesta.
- Comparar pantalla y API puede probar que la UI representa la respuesta, pero no que ambos den el resultado correcto. Conserva expectativas de negocio independientes en los recorridos que deban comprobarlo.
- No actualices expectativa, snapshot o fixture tomando la interfaz actual como única autoridad. Primero determina si cambió el requisito, el selector o el producto tiene una regresión.

## Pruebas estables y legibles

Usa roles, nombres accesibles y labels; emplea un identificador estable cuando no exista una referencia semántica adecuada. Espera el estado que importa con assertions de Playwright, no tiempos arbitrarios ni `networkidle` como señal genérica de que todo terminó. Una respuesta de red no implica que la pantalla se haya actualizado.

Prepara el estado necesario dentro de cada prueba o fixture explícita, sin depender de que otra prueba se ejecute antes. Para administración, crea datos sintéticos propios y elimina solo esos registros. Reutiliza accesos y utilidades existentes; introduce helpers o Page Objects cuando aclaren repetición real, no por un umbral de líneas.

Selecciona los estados que cambia la tarea: éxito, vacío, rechazo, recuperación, cancelación o viewport relevante. No cubras todo el catálogo por defecto. No escondas una carrera o un bug con `skip`, `fixme`, reintentos o timeouts crecientes; diagnostica la condición que falta. Un timeout mayor solo se justifica por una espera legítima medida.

## Evidencia y entorno local

Consulta [playwright.config.ts](../../../../playwright.config.ts) y [desarrollo](../../../../README.md): Chrome local, scripts existentes y datos del laboratorio. Las trazas y capturas están desactivadas para evitar grabar credenciales. No las actives globalmente como rutina. Si necesitas evidencia visual, usa un recorrido acotado con datos sintéticos y sin secretos; revisa el artefacto antes de compartirlo.

El [catálogo](../../../../tests/e2e/catalog.spec.ts) contiene recorridos reales y recuperación HTTP controlada.. No impliques consumo de modelos en una prueba común.

Puedes explorar la página para verificar el desarrollo sin convertir cada inspección en un test permanente. Reporta qué interacción observaste y qué quedó sin comprobar.
