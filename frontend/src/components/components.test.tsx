import { fireEvent, render, screen } from "@testing-library/react";

import { AyahText } from "./AyahText";
import { PacePicker } from "./PacePicker";
import { ProgressRing } from "./ProgressRing";

const TEXT = "كلمة1 كلمة2 كلمة3";

describe("AyahText", () => {
  it("renders one button per word and reports clicks", () => {
    const onClick = vi.fn();
    render(<AyahText text={TEXT} onWordClick={onClick} hidden={new Set([1])} />);
    const words = screen.getAllByRole("button");
    expect(words).toHaveLength(3);
    fireEvent.click(words[1]!);
    expect(onClick).toHaveBeenCalledWith(1);
  });
  it("exposes marked mistakes to assistive tech", () => {
    render(<AyahText text={TEXT} onWordClick={() => {}} marked={new Set([2])} />);
    expect(screen.getAllByRole("button")[2]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("ProgressRing", () => {
  it("is an accessible progressbar clamped to 0..100", () => {
    render(<ProgressRing value={140} label="Maîtrise" />);
    expect(screen.getByRole("progressbar", { name: "Maîtrise" })).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("PacePicker", () => {
  it("lets the user pick a pace", () => {
    const onChange = vi.fn();
    const base = { weekly_new: 0, finish_date: "2027-01-25", margin_days: 14, minutes_per_day: 30 };
    render(<PacePicker value={9} onChange={onChange} options={[
      { ...base, key: "gentle", label: "Doux", daily_new: 8, recommended: false },
      { ...base, key: "balanced", label: "Équilibré", daily_new: 9, recommended: true },
    ]} />);
    expect(screen.getByRole("radio", { name: /Équilibré/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Doux/ }));
    expect(onChange).toHaveBeenCalledWith(8);
  });
});
