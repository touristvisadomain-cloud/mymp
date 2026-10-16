'use client';

import NextLink from 'next/link';
import { useT } from './client';

/**
 * next/link that keeps the reader in their language: on an English page
 * "/mp/x" goes to "/en/mp/x". Links to other sites, files, the API and the
 * admin are left as written. Use it for every link inside the public site.
 */
export default function Link(props: React.ComponentProps<typeof NextLink>) {
  const t = useT();
  const href = typeof props.href === 'string' ? t.href(props.href) : props.href;
  return <NextLink {...props} href={href} />;
}
