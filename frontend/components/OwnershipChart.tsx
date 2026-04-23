"use client";

import { Doughnut } from "react-chartjs-2";
import { Chart, ArcElement, Tooltip, Legend } from "chart.js";
import { useMemo } from "react";

Chart.register(ArcElement, Tooltip, Legend);

type Slice = { label: string; value: number; color: string };

export function OwnershipChart({ slices }: { slices: Slice[] }) {
  const data = useMemo(
    () => ({
      labels: slices.map((s) => s.label),
      datasets: [
        {
          data: slices.map((s) => s.value),
          backgroundColor: slices.map((s) => s.color),
          borderColor: "hsl(222, 25%, 10%)",
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    }),
    [slices]
  );

  return (
    <div className="relative h-[260px] w-full">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "hsl(215, 14%, 66%)",
                boxWidth: 10,
                padding: 16,
                font: { size: 11 },
              },
            },
            tooltip: {
              backgroundColor: "hsl(222, 25%, 14%)",
              titleColor: "hsl(210, 30%, 98%)",
              bodyColor: "hsl(210, 30%, 98%)",
              borderColor: "hsl(222, 15%, 20%)",
              borderWidth: 1,
              callbacks: {
                label: (ctx) =>
                  `${ctx.label}: ${(ctx.parsed as number).toFixed(2)}%`,
              },
            },
          },
        }}
      />
    </div>
  );
}
