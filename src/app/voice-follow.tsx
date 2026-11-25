import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseFollowParams } from '@/features/listening';

/**
 * The former trial of the voice following (docs/design/voix.png). The reader follows the
 * recitation itself now (D41, docs/specs/reader.md, 3b): `/voice-follow?page=294&from=18:10`
 * opens the reader on that page, following from that verse; `&scenario=…` is passed on for the
 * simulated recitation of development and test builds. An address that names no page of the
 * mushaf goes home.
 */
export default function VoiceFollowRoute() {
  const { page, from, scenario } = useLocalSearchParams<{
    page?: string;
    from?: string;
    scenario?: string;
  }>();
  const params = parseFollowParams(page, from);
  if (params === null) return <Redirect href="/" />;
  const verse = params.from ?? null;
  return (
    <Redirect
      href={{
        pathname: '/reader/[page]',
        params: {
          page: String(params.page),
          follow: '1',
          ...(verse === null ? {} : { from: `${verse.surah}:${verse.verse}` }),
          ...(scenario === undefined ? {} : { scenario }),
        },
      }}
    />
  );
}
