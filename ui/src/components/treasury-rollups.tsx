import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  Empty,
  EmptyTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type ApiClient, useApiClient } from "@/lib/api";
import { formatTokenAmount } from "@/lib/format-amount";

type Rollup = Awaited<ReturnType<ApiClient["treasury"]["getRollups"]>>["rollups"][number];

const STAGE_DEFS = [
  { key: "remaining", color: "var(--muted-foreground)" },
  { key: "allocated", color: "var(--chart-3)" },
  { key: "committed", color: "var(--chart-1)" },
  { key: "paid", color: "var(--chart-4)" },
] as const;

type StageKey = (typeof STAGE_DEFS)[number]["key"];

const chartConfig = Object.fromEntries(
  STAGE_DEFS.map((s) => [s.key, { label: s.key, color: s.color }]),
) satisfies ChartConfig;

type ChartRow = {
  tokenId: string;
  remaining: number;
  allocated: number;
  committed: number;
  paid: number;
  remainingRaw: string;
  allocatedRaw: string;
  committedRaw: string;
  paidRaw: string;
  budgetedRaw: string;
};

function rollupHasActivity(r: Rollup): boolean {
  return (
    BigInt(r.paid) !== 0n ||
    BigInt(r.committed) !== 0n ||
    BigInt(r.allocated) !== 0n ||
    BigInt(r.remaining) !== 0n
  );
}

function rollupToChartRow(r: Rollup): ChartRow {
  const remaining = BigInt(r.remaining);
  const allocated = BigInt(r.allocated);
  const committed = BigInt(r.committed);
  const paid = BigInt(r.paid);
  const budgeted = BigInt(r.budgeted);

  const posRemaining = remaining > 0n ? remaining : 0n;
  const denom = budgeted > 0n ? budgeted : posRemaining + allocated + committed + paid;
  const toPct = (v: bigint) => (denom === 0n ? 0 : Number((v * 10000n) / denom) / 100);

  return {
    tokenId: r.tokenId,
    remaining: toPct(posRemaining),
    allocated: toPct(allocated),
    committed: toPct(committed),
    paid: toPct(paid),
    remainingRaw: r.remaining,
    allocatedRaw: r.allocated,
    committedRaw: r.committed,
    paidRaw: r.paid,
    budgetedRaw: r.budgeted,
  };
}

export function TreasuryRollupsChart() {
  const apiClient = useApiClient();
  const rollupsQuery = useQuery({
    queryKey: ["treasury", "rollups"],
    queryFn: () => apiClient.treasury.getRollups(),
    staleTime: 30_000,
    retry: false,
  });

  if (rollupsQuery.isLoading) {
    return (
      <div className="border border-border p-4 space-y-4">
        <ChartLegend />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <ChartRowSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (rollupsQuery.isError) {
    return null;
  }

  const rows = (rollupsQuery.data?.rollups ?? []).filter(rollupHasActivity).map(rollupToChartRow);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border border-border p-4 space-y-4">
      <ChartLegend />
      <div className="grid grid-cols-[minmax(80px,160px)_1fr_minmax(80px,auto)] items-center gap-x-3 gap-y-2">
        {rows.map((row) => (
          <Fragment key={row.tokenId}>
            <div className="font-mono text-[11px] truncate text-foreground" title={row.tokenId}>
              {row.tokenId}
            </div>
            <ChartContainer config={chartConfig} className="h-6 w-full">
              <BarChart
                data={[row]}
                layout="vertical"
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="tokenId" hide />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name, item) => {
                        const r = (item?.payload ?? {}) as ChartRow;
                        const key = String(name) as StageKey;
                        const raw = r[`${key}Raw` as keyof ChartRow] as string | undefined;
                        const pct = Number(value);
                        if (raw === undefined || pct === 0) return null;
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 border border-border"
                                style={{ backgroundColor: `var(--color-${key})` }}
                              />
                              <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                                {key}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] tabular-nums">
                              {formatTokenAmount(raw, r.tokenId)} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="remaining" stackId="x" fill="var(--color-remaining)" />
                <Bar dataKey="allocated" stackId="x" fill="var(--color-allocated)" />
                <Bar dataKey="committed" stackId="x" fill="var(--color-committed)" />
                <Bar dataKey="paid" stackId="x" fill="var(--color-paid)" />
              </BarChart>
            </ChartContainer>
            <div className="font-mono text-[11px] tabular-nums text-right whitespace-nowrap text-foreground">
              {formatTokenAmount(row.budgetedRaw, row.tokenId)}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {STAGE_DEFS.map((stage, i) => (
        <div key={stage.key} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground/60" aria-hidden>
              →
            </span>
          )}
          <span
            className="inline-block h-3 w-3 border border-border"
            style={{ backgroundColor: stage.color }}
          />
          <span>{stage.key}</span>
        </div>
      ))}
      <span className="ml-auto text-muted-foreground/70">flow</span>
    </div>
  );
}

function ChartRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TreasuryRollups() {
  const apiClient = useApiClient();
  const rollupsQuery = useQuery({
    queryKey: ["treasury", "rollups"],
    queryFn: () => apiClient.treasury.getRollups(),
    staleTime: 30_000,
    retry: false,
  });

  if (rollupsQuery.isLoading) {
    return (
      <div className="border border-border">
        <Table>
          <RollupsTableHeader />
          <TableBody>
            {[0, 1].map((i) => (
              <RollupRowSkeleton key={i} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  if (rollupsQuery.isError) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        could not load — try again
      </p>
    );
  }
  const rollups = rollupsQuery.data?.rollups ?? [];
  if (rollups.length === 0) {
    return (
      <Empty className="border-2 border-dashed border-border/40">
        <EmptyTitle className="font-mono text-sm font-normal text-muted-foreground">
          No activity yet. Budget funds, attach NEARN listings, or record billings to see the
          rollup.
        </EmptyTitle>
      </Empty>
    );
  }
  return (
    <div className="border border-border">
      <Table>
        <RollupsTableHeader />
        <TableBody>
          {rollups.map((r) => (
            <RollupRow key={r.tokenId} rollup={r} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RollupsTableHeader() {
  const cols = ["balance", "budgeted", "allocated", "committed", "paid", "remaining", "available"];
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="font-mono text-[10px] uppercase tracking-[0.18em]">token</TableHead>
        {cols.map((c) => (
          <TableHead
            key={c}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-right"
          >
            {c}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function RollupRow({ rollup }: { rollup: Rollup }) {
  const isNeg = (s: string) => s.trim().startsWith("-");
  return (
    <TableRow>
      <TableCell className="font-mono text-xs break-all">{rollup.tokenId}</TableCell>
      <TableCell className="font-mono tabular-nums text-right whitespace-nowrap">
        {formatTokenAmount(rollup.balance, rollup.tokenId)}
      </TableCell>
      <TableCell className="font-mono tabular-nums text-right whitespace-nowrap">
        {formatTokenAmount(rollup.budgeted, rollup.tokenId)}
      </TableCell>
      <TableCell className="font-mono tabular-nums text-right whitespace-nowrap">
        {formatTokenAmount(rollup.allocated, rollup.tokenId)}
      </TableCell>
      <TableCell className="font-mono tabular-nums text-right whitespace-nowrap">
        {formatTokenAmount(rollup.committed, rollup.tokenId)}
      </TableCell>
      <TableCell className="font-mono tabular-nums text-right whitespace-nowrap">
        {formatTokenAmount(rollup.paid, rollup.tokenId)}
      </TableCell>
      <TableCell
        className={`font-mono tabular-nums text-right whitespace-nowrap ${
          isNeg(rollup.remaining) ? "text-destructive" : ""
        }`}
      >
        {formatTokenAmount(rollup.remaining, rollup.tokenId)}
      </TableCell>
      <TableCell
        className={`font-mono tabular-nums text-right whitespace-nowrap ${
          isNeg(rollup.available) ? "text-destructive" : ""
        }`}
      >
        {formatTokenAmount(rollup.available, rollup.tokenId)}
      </TableCell>
    </TableRow>
  );
}

function RollupRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-3 w-20" />
      </TableCell>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <TableCell key={i} className="text-right">
          <Skeleton className="h-3 w-20 ml-auto" />
        </TableCell>
      ))}
    </TableRow>
  );
}
