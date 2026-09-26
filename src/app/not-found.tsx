import Link from "next/link";
import { ArrowRight, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md text-center">
          <p className="font-heading text-sm font-semibold tracking-widest text-primary uppercase">
            404
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            This page didn&apos;t make it through permitting.
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved. Let&apos;s get you back on track.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/guides">
                Role guides
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LifeBuoy className="h-4 w-4" />
            <span>
              Already a customer? Sign in from{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                the login page
              </Link>
              .
            </span>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
