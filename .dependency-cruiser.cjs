/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-independiente',
      severity: 'error',
      comment:
        'El core solo puede depender de código del propio core. Conecta SDKs y frameworks mediante puertos y adaptadores.',
      from: { path: '^packages/core/src/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^packages/core/src/' },
    },
    {
      name: 'aplicacion-sin-adaptadores',
      severity: 'error',
      comment:
        'Los casos de uso del cliente solo dependen de aplicación y contratos compartidos. React y HTTP pertenecen a los adaptadores.',
      from: { path: '^apps/web/src/features/[^/]+/application/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['^apps/web/src/features/[^/]+/application/', '^packages/contracts/src/'] },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: require('node:path').resolve('tsconfig.architecture.json') },
    // Conserva las dependencias de salida sin recorrer SDKs ni tests de comportamiento.
    doNotFollow: { path: 'node_modules|\\.test\\.ts$' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'default'],
    },
  },
};
