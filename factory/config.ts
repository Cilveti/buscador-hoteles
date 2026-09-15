/** Portable installation inputs. The controller reads this from the trusted base commit. */
export const config = {
  schemaVersion: 1,
  repository: 'Cilveti/buscador-hoteles',
  baseBranch: 'main',
  operators: ['Cilveti'],
  runtime: { bun: '1.4.2', node: '22', playwright: '1.63.0' },
  worker: {
    version: '1.18.30',
    integrity:
      'sha512-oLcOLQE4XzDKy6T5L5d1RdVJvXHXwVlD4hRF5V317JbUQorrl2EyDdGZk5kbgv675J9FXp8usg92MZbEWhh6gQ==',
    models: ['opencode-go/glm-5.3-flash', 'opencode-go/glm-5.3-flash', 'opencode-go/glm-5.3'],
    reviewer: 'opencode-go/glm-5.3',
  },
  limits: { attempts: 3, patchBytes: 200_000, modelMinutes: 10, verificationMinutes: 25 },
  sonar: { mode: 'required', projectKey: 'Cilveti_buscador-hoteles', organization: 'cilveti' },
  design: { directory: 'factory/designs', requireSnapshotForVisualTasks: true },
} as const;
