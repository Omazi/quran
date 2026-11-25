/**
 * A stand-in for expo-camera in tests: a camera permission that answers as the system does, and
 * a preview whose `onBarcodeScanned` a test can call as if a code had been read.
 *
 *   jest.mock('expo-camera', () =>
 *     jest.requireActual<typeof import('../test-support/camera')>('../test-support/camera')
 *       .fakeExpoCamera,
 *   );
 */

import type { PermissionResponse } from 'expo';
import { useCallback, useEffect, useState } from 'react';
import { View, type ViewProps } from 'react-native';

type Status = 'granted' | 'denied' | 'undetermined';

interface CameraSituation {
  /** What the system holds now. */
  status: Status;
  /** What the person answers when the system asks (only asked while `undetermined`). */
  answer: Exclude<Status, 'undetermined'>;
  /** How many times the system question was shown. */
  questionsShown: number;
}

const situation: CameraSituation = { status: 'undetermined', answer: 'granted', questionsShown: 0 };

function response(status: Status): PermissionResponse {
  return {
    status: status as PermissionResponse['status'], // the three values of PermissionStatus
    granted: status === 'granted',
    canAskAgain: status === 'undetermined',
    expires: 'never',
  };
}

/** Sets what the system holds and what the person will answer. */
export function setCamera(status: Status, answer: CameraSituation['answer'] = 'granted'): void {
  situation.status = status;
  situation.answer = answer;
  situation.questionsShown = 0;
}

/** How many times the system's camera question was shown since `setCamera`. */
export function cameraQuestionsShown(): number {
  return situation.questionsShown;
}

export interface FakeCameraViewProps extends ViewProps {
  onBarcodeScanned?: (result: { data: string; type: string }) => void;
  onMountError?: (event: { message: string }) => void;
  barcodeScannerSettings?: { barcodeTypes: string[] };
}

export const fakeExpoCamera = {
  useCameraPermissions({ get = true }: { get?: boolean } = {}) {
    const [permission, setPermission] = useState<PermissionResponse | null>(null);
    useEffect(() => {
      if (get) setPermission(response(situation.status));
    }, [get]);
    const request = useCallback(async () => {
      if (situation.status === 'undetermined') {
        situation.questionsShown += 1;
        situation.status = situation.answer;
      }
      const answered = response(situation.status);
      setPermission(answered);
      return answered;
    }, []);
    const read = useCallback(async () => {
      const read = response(situation.status);
      setPermission(read);
      return read;
    }, []);
    return [permission, request, read] as const;
  },
  CameraView(props: FakeCameraViewProps) {
    return <View testID="camera-view" {...props} />;
  },
};
