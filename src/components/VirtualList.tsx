import type { CSSProperties, ReactElement, ReactNode } from "react";
import { List, type RowComponentProps } from "react-window";

export interface VirtualListRenderItemProps {
  index: number;
  style: CSSProperties;
}

export interface VirtualListProps {
  itemCount: number;
  /** px height per row — enforced minimum 44 (touch target). Default 44 if omitted. */
  itemSize?: number;
  renderItem: (props: VirtualListRenderItemProps) => ReactNode;
  height: number;
  width?: number | string;
  testId?: string;
}

const MIN_TOUCH_TARGET_PX = 44;

interface RowProps {
  renderItem: VirtualListProps["renderItem"];
}

function Row({ index, style, renderItem }: RowComponentProps<RowProps>): ReactElement | null {
  return <>{renderItem({ index, style })}</>;
}

export function VirtualList({
  itemCount,
  itemSize,
  renderItem,
  height,
  width,
  testId,
}: VirtualListProps): ReactNode {
  const rowHeight = Math.max(itemSize ?? MIN_TOUCH_TARGET_PX, MIN_TOUCH_TARGET_PX);

  return (
    <List
      rowComponent={Row}
      rowCount={itemCount}
      rowHeight={rowHeight}
      rowProps={{ renderItem }}
      style={{ height, width, overflow: "auto" }}
      data-testid={testId}
    />
  );
}
