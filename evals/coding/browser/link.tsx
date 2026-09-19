import type { ComponentProps } from 'react';

/** This harness exercises HTML navigation, not the Next router or server rendering. */
export default function Link(props: ComponentProps<'a'>) {
  return <a {...props} />;
}
