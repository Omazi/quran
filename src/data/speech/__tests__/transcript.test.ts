import { createTranscriptStabilizer, whisperWords } from '../transcript';

describe('whisperWords', () => {
  it('splits what Whisper wrote into Arabic words, keeping their vowels', () => {
    // Whisper tiny, fine-tuned on the Quran, on 36:1–2 (measured, D42).
    expect(whisperWords(' يس وَالْقُرْآنِ الْحَكِيمِ ')).toEqual(['يس', 'وَالْقُرْآنِ', 'الْحَكِيمِ']);
  });

  it('drops what is not Arabic: punctuation, Latin words, bracketed sound labels', () => {
    expect(whisperWords('[Music] قُلْ، هُوَ (applause) اللَّهُ. أَحَدٌ!')).toEqual([
      'قُلْ',
      'هُوَ',
      'اللَّهُ',
      'أَحَدٌ',
    ]);
    expect(whisperWords('♪ ... Thank you.')).toEqual([]);
  });

  it('cuts a word that Whisper repeats in a loop down to two', () => {
    expect(whisperWords('اللَّهُ اللَّهُ اللَّهُ اللَّهُ اللَّهُ أَحَدٌ')).toEqual(['اللَّهُ', 'اللَّهُ', 'أَحَدٌ']);
    // 89:21 repeats a word twice: that stays.
    expect(whisperWords('دَكًّا دَكًّا')).toEqual(['دَكًّا', 'دَكًّا']);
  });
});

describe('createTranscriptStabilizer', () => {
  const words = (text: string) => text.split(' ');

  it('gives a word only once two passes in a row agree on it', () => {
    const stabilizer = createTranscriptStabilizer();
    expect(stabilizer.update(words('قل هو'))).toEqual([]);
    expect(stabilizer.update(words('قل هو الله'))).toEqual(['قل', 'هو']);
    expect(stabilizer.update(words('قل هو الله أحد'))).toEqual(['الله']);
  });

  it('never gives a word twice, and never takes one back', () => {
    const stabilizer = createTranscriptStabilizer();
    stabilizer.update(words('قل هو الله'));
    expect(stabilizer.update(words('قل هو الله'))).toEqual(['قل', 'هو', 'الله']);
    // A later pass changes its mind about words already given: nothing more is given for them.
    expect(stabilizer.update(words('قال هو الله أحد'))).toEqual([]);
    expect(stabilizer.update(words('قال هو الله أحد'))).toEqual(['أحد']);
  });

  it('waits while two passes disagree on the next word', () => {
    const stabilizer = createTranscriptStabilizer();
    stabilizer.update(words('الحمد لله رب'));
    expect(stabilizer.update(words('الحمد لله ربي العالمين'))).toEqual(['الحمد', 'لله']);
    expect(stabilizer.update(words('الحمد لله رب العالمين'))).toEqual([]);
    expect(stabilizer.update(words('الحمد لله رب العالمين'))).toEqual(['رب', 'العالمين']);
  });

  it('compares words by their letters, not their vowels', () => {
    const stabilizer = createTranscriptStabilizer();
    stabilizer.update(words('قُلْ هُوَ'));
    expect(stabilizer.update(words('قل هو اللَّهُ'))).toEqual(['قل', 'هو']);
  });

  it('gives every remaining word of the last pass when the phrase closes, then starts afresh', () => {
    const stabilizer = createTranscriptStabilizer();
    stabilizer.update(words('قل هو'));
    stabilizer.update(words('قل هو الله'));
    expect(stabilizer.close(words('قل هو الله أحد'))).toEqual(['الله', 'أحد']);
    expect(stabilizer.update(words('الله الصمد'))).toEqual([]);
    expect(stabilizer.update(words('الله الصمد'))).toEqual(['الله', 'الصمد']);
  });
});
