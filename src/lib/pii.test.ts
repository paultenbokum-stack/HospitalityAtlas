import { describe, expect, it } from "vitest";
import { findPersonalData, isGenericInbox, personalDataError } from "./pii";

describe("findPersonalData", () => {
  it("flags mobile numbers in common SA formats", () => {
    expect(findPersonalData("call back on 082 555 1234")).toContain("a mobile number");
    expect(findPersonalData("+27 82 555 1234")).toContain("a mobile number");
    expect(findPersonalData("0725551234")).toContain("a mobile number");
  });

  it("flags SA ID numbers", () => {
    expect(findPersonalData("ID 8001015009087")).toContain("an ID number");
  });

  it("flags personal emails but allows role inboxes", () => {
    expect(findPersonalData("emailed jane.doe@restaurant.co.za")).toContain("a personal email address");
    expect(findPersonalData("sent menu to info@restaurant.co.za")).toEqual([]);
    expect(isGenericInbox("bookings@hotel.com")).toBe(true);
    expect(isGenericInbox("thabo@hotel.com")).toBe(false);
  });

  it("leaves business-level notes alone", () => {
    const note = "Spoke to the GM. Uses Pilot POS, 24 tables, wants a demo in March. Switchboard 031 555 1234.";
    expect(findPersonalData(note)).toEqual([]);
    expect(personalDataError(note)).toBeNull();
  });
});
