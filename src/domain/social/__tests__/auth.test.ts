import { parseEmail, parseEmailCode, signInProvidersFor, SOCIAL_CONFIG } from '../index';
import { expectRefusal, NOT_TEXT } from '../test-support/social-test-kit';

describe('Sign-in (AuthGateway rules)', () => {
  describe('e-mail address', () => {
    it.each(['omar@example.com', 'o.mar+quran@mail.example.co.uk', 'a_b-c@x-y.io', '1@a.bc'])(
      'accepts %s as it is',
      (address) => {
        expect(parseEmail(address)).toBe(address);
      },
    );

    it.each([
      ['empty', ''],
      ['without @', 'omar.example.com'],
      ['with two @', 'o@m@example.com'],
      ['without local part', '@example.com'],
      ['without domain', 'omar@'],
      ['without a dot in the domain', 'omar@example'],
      ['with a space inside', 'om ar@example.com'],
      ['with an edge space: nothing is corrected', ' omar@example.com'],
      ['with a line break', 'omar@example.com\n'],
      ['with a dot first in the local part', '.omar@example.com'],
      ['with two dots in a row', 'om..ar@example.com'],
      ['with a hyphen first in a label', 'omar@-example.com'],
      ['with an empty label', 'omar@example..com'],
      ['with a one-letter extension', 'omar@example.c'],
      ['with an extension of digits', 'omar@example.123'],
      ['with a non-ASCII character', 'omár@example.com'],
    ])('refuses an address %s', (_label, address) => {
      expectRefusal(() => parseEmail(address), 'email-malformed');
    });

    it('refuses a local part of 65 characters and an address of more than 254', () => {
      expect(
        parseEmail(`${'a'.repeat(SOCIAL_CONFIG.maxEmailLocalPartLength)}@example.com`),
      ).toContain('@');
      expectRefusal(
        () => parseEmail(`${'a'.repeat(SOCIAL_CONFIG.maxEmailLocalPartLength + 1)}@example.com`),
        'email-malformed',
      );
      expectRefusal(
        () => parseEmail(`a@${'b'.repeat(SOCIAL_CONFIG.maxEmailLength)}.com`),
        'email-malformed',
      );
    });

    it('refuses a value that is not text with a TypeError', () => {
      expect(() => parseEmail(NOT_TEXT)).toThrow(TypeError);
    });
  });

  describe('one-time code sent by e-mail', () => {
    it('is exactly the configured number of digits', () => {
      expect(parseEmailCode('012345')).toBe('012345');
      expect(SOCIAL_CONFIG.emailCodeLength).toBe(6);
    });

    it.each(['', '12345', '1234567', '12345a', ' 123456', '١٢٣٤٥٦'])('refuses %j', (code) => {
      expectRefusal(() => parseEmailCode(code), 'email-code-malformed');
    });

    it('refuses a value that is not text with a TypeError', () => {
      expect(() => parseEmailCode(NOT_TEXT)).toThrow(TypeError);
    });
  });

  describe('store rules (docs/SECURITY.md)', () => {
    it('on iOS, Google offered means Apple offered', () => {
      const providers = signInProvidersFor('ios');

      expect(providers).toEqual(expect.arrayContaining(['google', 'apple', 'email']));
    });

    it('on Android, Apple is not required and e-mail is always there', () => {
      expect(signInProvidersFor('android')).toEqual(['google', 'email']);
    });

    it('refuses an unknown platform', () => {
      expect(() => signInProvidersFor('web' as 'ios')).toThrow(RangeError);
    });
  });
});
