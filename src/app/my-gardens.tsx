import { useSelfDisplayName } from '@/features/friends';
import { MyGardensScreen, useProgression } from '@/features/gardens';
import { useProfileGarden } from '@/features/profile';

/** "Mes jardins", the path of the levels (D46), opened from the profile. */
export default function MyGardensRoute() {
  const progression = useProgression();
  const garden = useProfileGarden();
  const displayName = useSelfDisplayName();
  return <MyGardensScreen progression={progression} garden={garden} displayName={displayName} />;
}
