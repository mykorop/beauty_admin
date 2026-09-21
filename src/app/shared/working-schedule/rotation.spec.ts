import { buildRotation, toRotationForm } from './rotation';

describe('Ротація form', () => {
  it('opens a master without a Ротація on «2 через 2» counted from today', () => {
    expect(toRotationForm(null, '2026-10-01')).toEqual({
      anchorDate: '2026-10-01',
      cycleLength: 4,
      working: [true, true, false, false],
    });
  });

  it('opens a stored Ротація as it is', () => {
    const stored = { anchorDate: '2026-09-15', cycleLength: 3, workingOffsets: [0, 2] };

    expect(toRotationForm(stored, '2026-10-01')).toEqual({
      anchorDate: '2026-09-15',
      cycleLength: 3,
      working: [true, false, true],
    });
  });

  it('builds the working days of the cycle, ignoring marks beyond its length', () => {
    expect(
      buildRotation({
        anchorDate: '2026-10-01',
        cycleLength: 3,
        working: [true, false, true, true],
      }),
    ).toEqual({ anchorDate: '2026-10-01', cycleLength: 3, workingOffsets: [0, 2] });
  });

  it('round-trips a stored Ротація', () => {
    const stored = { anchorDate: '2026-09-15', cycleLength: 5, workingOffsets: [0, 1, 2] };

    expect(buildRotation(toRotationForm(stored, '2026-10-01'))).toEqual(stored);
  });

  // The domain's own rules: a cycle of 2–14 days with a day worked and a day off.
  const valid = { anchorDate: '2026-10-01', cycleLength: 4, working: [true, true, false, false] };
  [
    ['no date', { ...valid, anchorDate: '' }],
    ['a cycle of one day', { ...valid, cycleLength: 1 }],
    ['a cycle over a fortnight', { ...valid, cycleLength: 15 }],
    ['a fractional cycle', { ...valid, cycleLength: 2.5 }],
    ['no working day', { ...valid, working: [false, false, false, false] }],
    ['every day worked', { ...valid, working: [true, true, true, true] }],
  ].forEach(([label, value]) => {
    it(`builds nothing from ${label as string}`, () => {
      expect(buildRotation(value as typeof valid)).toBeNull();
    });
  });
});
