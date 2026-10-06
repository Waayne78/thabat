import { fmtClock, fmtDuration, fmtHijri, plural, relativeDue } from "./format";
import { masteryStep, suggestRating } from "./mastery";

describe("masteryStep", () => {
  it("separates untouched verses from weak ones", () => {
    expect(masteryStep(0)).toBe(0);
    expect(masteryStep(0, true)).toBe(1);
    expect(masteryStep(34)).toBe(1);
    expect(masteryStep(35)).toBe(2);
    expect(masteryStep(60)).toBe(3);
    expect(masteryStep(85)).toBe(4);
  });
});

describe("suggestRating", () => {
  it("never suggests 'very easy' on its own and degrades with slips", () => {
    expect(suggestRating(0, 0, 10)).toBe("easy");
    expect(suggestRating(1, 0, 10)).toBe("medium");
    expect(suggestRating(1, 1, 10)).toBe("hard");
    expect(suggestRating(4, 3, 10)).toBe("forgotten");
  });
});

describe("format", () => {
  it("formats durations", () => {
    expect(fmtDuration(45)).toBe("45 s");
    expect(fmtDuration(18 * 60)).toBe("18 min");
    expect(fmtDuration(3900)).toBe("1 h 05");
    expect(fmtClock(125)).toBe("2:05");
  });
  it("pluralises in French", () => {
    expect(plural(1, "verset")).toBe("1 verset");
    expect(plural(8, "nouveau verset", "nouveaux versets")).toBe("8 nouveaux versets");
  });
  it("describes due dates", () => {
    expect(relativeDue("2026-10-06", "2026-10-06")).toBe("aujourd'hui");
    expect(relativeDue("2026-10-07", "2026-10-06")).toBe("demain");
    expect(relativeDue("2026-10-10", "2026-10-06")).toBe("dans 4 jours");
  });
  it("maps the target date to 1 Ramadan 1448", () => {
    expect(fmtHijri("2027-02-08")).toBe("1 Ramaḍān 1448");
  });
});
