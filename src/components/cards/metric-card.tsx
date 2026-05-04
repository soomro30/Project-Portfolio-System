import type { CarbonIconType } from "@carbon/icons-react";
import { Stack, Tag, Tile } from "@carbon/react";

export function MetricCard({
  title,
  value,
  caption,
  label = "Portfolio metric",
  tone = "blue",
  icon: Icon,
}: {
  title: string;
  value: number | string;
  caption: string;
  label?: string;
  tone?: "blue" | "cyan" | "green" | "magenta" | "purple" | "red" | "teal";
  icon?: CarbonIconType;
}) {
  return (
    <Tile>
      <Stack gap={5}>
        <Stack orientation="horizontal" gap={5}>
          {Icon ? <Icon size={24} aria-hidden="true" /> : null}
          <Tag type={tone}>{title}</Tag>
        </Stack>
        <Stack gap={3}>
          <p>{label}</p>
          <h3>{title}</h3>
          <p>{value}</p>
          <p>{caption}</p>
        </Stack>
      </Stack>
    </Tile>
  );
}
