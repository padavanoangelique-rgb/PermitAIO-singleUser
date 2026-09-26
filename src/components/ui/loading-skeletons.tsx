import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for detail-style panels that load into a stack of cards
 * (Forms Generator, HOA job panel, etc.) once their data arrives.
 */
export function PanelSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }).map((_, cardIndex) => (
        <Card key={cardIndex} className="gap-2 py-4">
          <CardHeader className="px-5 py-0">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="grid gap-4 px-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton for stage/board-style lists (Permit Inventory pipeline, HOA
 * Tracker) that render a stack of collapsible stage cards once loaded.
 */
export function BoardSkeleton({ stages = 4 }: { stages?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: stages }).map((_, stageIndex) => (
        <Card key={stageIndex} className="gap-0 py-0">
          <div className="flex items-center justify-between rounded-xl px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <CardContent className="space-y-2 p-3">
            {Array.from({ length: 2 }).map((_, rowIndex) => (
              <Skeleton key={rowIndex} className="h-14 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
