'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon: LucideIcon;
}

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  icon: Icon,
}: EmptyStateProps) {
  return (
    <Card className="border-border/80 bg-card/90 shadow-sm">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ className: 'mt-5 rounded-full px-5' }))}
          >
            {ctaLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
