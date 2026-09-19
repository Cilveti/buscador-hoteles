# Guardar búsquedas para volver a ellas

En el buscador convencional quiero poder guardar una búsqueda con un nombre y recuperarla más tarde en este mismo navegador. Añade una sección accesible de búsquedas guardadas en la interfaz existente. No depende de login ni de backend: es una preferencia local, identificada como tal en la UI. No modifiques `/explore` ni el buscador agéntico.

- Guardar conserva texto, filtros y ordenación, pero recuperar empieza en la página 1. Actualiza la URL y los controles de búsqueda como en una búsqueda normal; la recarga y atrás/adelante siguen funcionando.
- Permite como máximo diez búsquedas. El nombre se recorta y debe tener entre 1 y 60 caracteres. Si el usuario repite un nombre sin distinguir mayúsculas/minúsculas, ofrece sustituir explícitamente la búsqueda anterior o cancelar; no sobrescribas silenciosamente.
- El usuario puede renombrar y eliminar búsquedas, con las mismas reglas de nombres. El estado vacío y el límite alcanzado se entienden sin abrir la consola.
- Persiste entre recargas. Un contenido almacenado corrupto o de formato desconocido no bloquea el buscador ni ejecuta código. Valida al leer. Si el almacenamiento está bloqueado o lleno, la búsqueda normal sigue funcionando y se explica que no se ha podido guardar; no anuncies persistencia exitosa.
- Las búsquedas antiguas no deben introducir parámetros inválidos en la API. Restaura únicamente estado válido según el contrato actual y comunica una entrada que no pueda recuperarse.

Respeta la separación entre lógica, persistencia del navegador y React. Los tests deben cubrir transiciones y casos de error reales; evita tests que solo comprueban llamadas a `localStorage` o la estructura interna del estado. La interacción debe funcionar con teclado y en el panel móvil.

Esta tarea se revisa con los checks generales y el juez; no tiene una batería de aceptación específica preescrita. El juez debe justificar los criterios de arriba con código y evidencia, no asumir cobertura por un verde de la suite base.
