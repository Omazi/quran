import { useMemo } from 'react';

import type { GardenStyleId } from '@/domain/levels';
import type { GardenSceneTint } from '@/features/garden';
import { useColorValues } from '@/ui';

import { GARDEN_STYLE_ART } from './garden-style-art';

/** The provisional colour cast of a garden style in the current appearance, or null (D46). */
export function useGardenTint(styleId: GardenStyleId): GardenSceneTint | null {
  const values = useColorValues();
  const tint = GARDEN_STYLE_ART[styleId].provisionalTint;
  return useMemo(
    () => (tint === null ? null : { color: values[tint.role], opacity: tint.opacity }),
    [tint, values],
  );
}
