import { hiddenIndexes, splitWords } from "./arabic";

// Placeholder tokens only: tests never embed Quranic text.
const W = (n: number) => `كلمة${n}`;

describe("splitWords", () => {
  it("keeps pause marks attached to the previous word", () => {
    expect(splitWords(`${W(1)} ${W(2)} ۖ ${W(3)}`)).toEqual([W(1), `${W(2)} ۖ`, W(3)]);
  });
  it("ignores extra whitespace", () => {
    expect(splitWords(`  ${W(1)}   ${W(2)} `)).toHaveLength(2);
  });
});

describe("hiddenIndexes", () => {
  it("hides the requested share of words", () => {
    expect(hiddenIndexes(8, 0.25, 1).size).toBe(2);
    expect(hiddenIndexes(8, 1, 1).size).toBe(8);
    expect(hiddenIndexes(8, 0, 1).size).toBe(0);
  });
  it("grows monotonically: a hidden word stays hidden at the next level", () => {
    for (const seed of [1, 42, 6231]) {
      const a = hiddenIndexes(12, 0.25, seed);
      const b = hiddenIndexes(12, 0.5, seed);
      const c = hiddenIndexes(12, 0.75, seed);
      a.forEach((i) => expect(b.has(i)).toBe(true));
      b.forEach((i) => expect(c.has(i)).toBe(true));
    }
  });
  it("differs from one ayah to another", () => {
    expect([...hiddenIndexes(20, 0.5, 1)]).not.toEqual([...hiddenIndexes(20, 0.5, 2)]);
  });
});
