import { createRoot } from 'react-dom/client';
import { CatalogSearch } from '../../apps/web/src/features/catalog/adapters/catalog-search';
import { HotelDetailPage } from '../../apps/web/src/features/catalog/adapters/hotel-detail-page';

const element = document.getElementById('root');
if (!element) throw new Error('Missing root element');
const id = window.location.pathname.match(/^\/hotels\/([^/]+)$/)?.[1];
createRoot(element).render(
  id ? <HotelDetailPage hotelId={decodeURIComponent(id)} /> : <CatalogSearch />,
);
