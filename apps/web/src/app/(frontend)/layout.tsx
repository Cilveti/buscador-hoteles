import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
export const metadata: Metadata = {
  title: 'Buscador de hoteles',
  description: 'Catálogo ficticio para aprender desarrollo y búsquedas deterministas.',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
