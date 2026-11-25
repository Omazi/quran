import { getLocales } from 'expo-localization';

import { readDeviceLanguageCodes } from '../device-languages';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

describe('languages of the phone', () => {
  it('are the language codes of its locales, in the order the phone gives them', () => {
    // `as`: only the fields that matter here are given; a full `Locale` has a dozen more.
    jest.mocked(getLocales).mockReturnValue([
      { languageCode: 'de', languageTag: 'de-DE' },
      { languageCode: null, languageTag: 'und' },
      { languageCode: 'ar', languageTag: 'ar-MA' },
    ] as unknown as ReturnType<typeof getLocales>);
    expect(readDeviceLanguageCodes()).toEqual(['de', null, 'ar']);
  });
});
