import type { Access, CollectionConfig } from 'payload';

const administrator: Access = ({ req }) => Boolean(req.user);
const administrativeAccess = {
  read: administrator,
  create: administrator,
  update: administrator,
  delete: administrator,
};

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario', plural: 'Usuarios' },
  auth: true,
  admin: { useAsTitle: 'email' },
  access: administrativeAccess,
  fields: [{ name: 'name', type: 'text', label: 'Nombre' }],
};

export const Hotels: CollectionConfig = {
  slug: 'hotels',
  labels: { singular: 'Hotel', plural: 'Hoteles' },
  access: administrativeAccess,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'externalHotelId'],
    group: 'Catálogo',
  },
  fields: [
    {
      name: 'externalHotelId',
      type: 'text',
      required: true,
      unique: true,
      label: 'Identificador',
      admin: { readOnly: true },
      access: { update: () => false },
    },
    { name: 'name', type: 'text', required: true, label: 'Nombre' },
    { name: 'sourceName', type: 'text', label: 'Nombre en la fuente', admin: { readOnly: true } },
    { name: 'sourceUrl', type: 'text', label: 'Web externa (opcional)' },
    {
      name: 'sourceDescription',
      type: 'textarea',
      label: 'Descripción importada',
      admin: { readOnly: true },
    },
    {
      name: 'sourceRevision',
      type: 'text',
      label: 'Revisión del corpus',
      admin: { readOnly: true },
    },
    {
      name: 'sourceEvidence',
      type: 'json',
      label: 'Contenido de ejemplo',
      admin: { readOnly: true },
    },
    {
      name: 'sourceReviews',
      type: 'json',
      label: 'Valoraciones simuladas',
      admin: {
        readOnly: true,
        description: 'Datos inventados para formación; no proceden de huéspedes.',
      },
    },
    {
      name: 'editorialDescription',
      type: 'textarea',
      label: 'Descripción editorial',
      admin: { description: 'Complementa o corrige el contenido importado del hotel.' },
    },
    {
      name: 'capturedAt',
      type: 'date',
      label: 'Fecha del conjunto de datos',
      admin: { readOnly: true },
    },
  ],
};
