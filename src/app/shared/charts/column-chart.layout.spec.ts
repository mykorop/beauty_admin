import { labelledIndexes, layoutColumns, niceScale, segmentPath } from './column-chart.layout';

describe('column chart layout', () => {
  describe('niceScale', () => {
    it('rounds the top of the scale up to a clean step', () => {
      expect(niceScale(37)).toEqual({ max: 40, ticks: [0, 10, 20, 30, 40] });
      expect(niceScale(12450)).toEqual({ max: 15000, ticks: [0, 5000, 10000, 15000] });
    });

    it('never splits a count into fractions', () => {
      expect(niceScale(3, { integer: true })).toEqual({ max: 3, ticks: [0, 1, 2, 3] });
      expect(niceScale(10, { integer: true })).toEqual({ max: 10, ticks: [0, 5, 10] });
      expect(niceScale(1, { integer: true })).toEqual({ max: 1, ticks: [0, 1] });
    });

    it('still has a scale when there is nothing to draw', () => {
      expect(niceScale(0, { integer: true })).toEqual({ max: 1, ticks: [0, 1] });
      expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    });
  });

  describe('layoutColumns', () => {
    it('stacks each column from the baseline, with a gap between segments and the top one marked', () => {
      const layout = layoutColumns(
        [
          [2, 1],
          [0, 0],
          [1, 0],
        ],
        { width: 300, height: 100 },
        4,
      );

      expect(layout.band).toBe(100);
      expect(layout.barWidth).toBe(24);
      expect(layout.columns[0]).toEqual({
        x: 38,
        segments: [
          // 2 of 4 → 50px, standing on the baseline, giving its top 2px to the gap.
          { series: 0, y: 52, height: 48, top: false },
          { series: 1, y: 25, height: 25, top: true },
        ],
      });
      expect(layout.columns[1].segments).toEqual([]);
      // A lone segment is the top of its column: nothing above it to leave a gap for.
      expect(layout.columns[2].segments).toEqual([{ series: 0, y: 75, height: 25, top: true }]);
    });

    it('thins the columns rather than letting them touch when the days are many', () => {
      const layout = layoutColumns(
        Array.from({ length: 365 }, () => [1]),
        { width: 730, height: 100 },
        1,
      );

      expect(layout.band).toBe(2);
      expect(layout.barWidth).toBeLessThan(2);
      expect(layout.barWidth).toBeGreaterThan(0);
    });
  });

  describe('segmentPath', () => {
    it('rounds the data end of a column and keeps its foot square', () => {
      expect(segmentPath({ series: 0, y: 10, height: 40, top: true }, 0, 20)).toBe(
        'M0,50V14Q0,10 4,10H16Q20,10 20,14V50Z',
      );
      expect(segmentPath({ series: 0, y: 10, height: 40, top: false }, 0, 20)).toBe(
        'M0,50V10H20V50Z',
      );
    });

    it('never rounds a corner past half the column or the segment', () => {
      expect(segmentPath({ series: 0, y: 10, height: 2, top: true }, 0, 2)).toBe(
        'M0,12V11Q0,10 1,10H1Q2,10 2,11V12Z',
      );
    });
  });

  describe('labelledIndexes', () => {
    it('labels evenly, always including the latest point', () => {
      expect(labelledIndexes(10, 4)).toEqual([0, 3, 6, 9]);
      expect(labelledIndexes(11, 4)).toEqual([1, 4, 7, 10]);
      expect(labelledIndexes(3, 8)).toEqual([0, 1, 2]);
      expect(labelledIndexes(0, 8)).toEqual([]);
    });
  });
});
