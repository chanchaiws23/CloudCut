import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type PanelGroupProps,
  type PanelProps,
  type PanelResizeHandleProps,
} from 'react-resizable-panels';
import { cn } from '../../lib/utils';

export function ResizablePanelGroup({ className, ...props }: PanelGroupProps) {
  return <PanelGroup className={cn('h-full w-full', className)} {...props} />;
}

export function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />;
}

export function ResizableHandle({ className, ...props }: PanelResizeHandleProps) {
  return (
    <PanelResizeHandle
      className={cn('bg-border transition-colors hover:bg-primary/30 data-[panel-group-direction=horizontal]:w-1 data-[panel-group-direction=vertical]:h-1', className)}
      {...props}
    />
  );
}
