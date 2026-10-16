import { notFound } from 'next/navigation';

/** Any address of either language that matches no page: that language's own 404, inside the site's header and footer. */
export default function Missing() {
  notFound();
}
