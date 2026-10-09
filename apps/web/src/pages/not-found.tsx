import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { PublicTopBar } from '@/components/layout/Shell';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicTopBar />
      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6 py-20">
        <p className="font-mono text-[13px] text-muted-foreground">404</p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-tight text-foreground">Page Not Found</h1>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          Back to Tahaqqaq <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
}
