// shadcn/ui New York slider, styled by the edition's data-slot selectors.
import type { ComponentProps } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

export function Slider({
  "aria-label": label,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root data-slot="slider" {...props}>
      <SliderPrimitive.Track data-slot="slider-track">
        <SliderPrimitive.Range data-slot="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb data-slot="slider-thumb" aria-label={label} />
    </SliderPrimitive.Root>
  );
}
