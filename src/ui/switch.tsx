// shadcn/ui New York switch, styled by the edition's data-slot selectors.
import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

export function Switch(props: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root data-slot="switch" {...props}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
