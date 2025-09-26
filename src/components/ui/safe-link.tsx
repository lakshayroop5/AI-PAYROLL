'use client';

import Link from 'next/link';
import { ComponentProps } from 'react';

/**
 * A type-safe wrapper around Next.js Link component
 * that works properly with React 19 and TypeScript strict mode
 */
interface SafeLinkProps extends Omit<ComponentProps<typeof Link>, 'children'> {
  children: React.ReactNode;
}

// Simple wrapper function to avoid React 19 + TypeScript forwardRef issues
export function SafeLink({ children, ...props }: SafeLinkProps) {
  const LinkComponent = Link as any; // Type assertion for React 19 compatibility
  return (
    <LinkComponent {...props}>
      {children}
    </LinkComponent>
  );
}

export default SafeLink;
